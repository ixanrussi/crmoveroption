import { useEffect, useMemo, useState } from "react";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import { supabase } from "@/integrations/supabase/client";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// ISO 3166-1 alpha-2 -> numeric (string, with leading zeros) for our supported countries
const ISO2_TO_NUMERIC: Record<string, string> = {
  AR: "032", BR: "076", CL: "152", CO: "170", CR: "188", EC: "218",
  SV: "222", ES: "724", GT: "320", HN: "340", MX: "484", NI: "558",
  PA: "591", PY: "600", PE: "604", DO: "214", UY: "858", VE: "862",
};

type CountryActivity = {
  name: string;
  code: string;
  brands: Set<string>;
};

export default function WorldActivityMap() {
  const [byNumeric, setByNumeric] = useState<Record<string, CountryActivity>>({});
  const [hovered, setHovered] = useState<{ x: number; y: number; data: CountryActivity } | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: countries }, { data: clients }] = await Promise.all([
        supabase.from("countries").select("id, name, code"),
        supabase.from("clients").select("company_name, brands, country_ids, status"),
      ]);
      if (!countries) return;

      const byCountryId = new Map<string, CountryActivity>();
      countries.forEach((c: any) => {
        if (!c.code || !ISO2_TO_NUMERIC[c.code]) return;
        byCountryId.set(c.id, { name: c.name, code: c.code, brands: new Set<string>() });
      });

      (clients ?? []).forEach((cl: any) => {
        if (cl.status === "inactive") return;
        const rawBrands: string[] = (cl.brands ?? []).filter((b: string) => b && b.trim());
        const brands: string[] = rawBrands.length > 0 ? rawBrands : (cl.company_name ? [cl.company_name] : []);
        const countryIds: string[] = cl.country_ids ?? [];
        countryIds.forEach((cid) => {
          const entry = byCountryId.get(cid);
          if (entry) brands.forEach((b) => entry.brands.add(b));
        });
      });

      const result: Record<string, CountryActivity> = {};
      byCountryId.forEach((v, id) => {
        const country = countries.find((c: any) => c.id === id);
        if (!country?.code) return;
        const num = ISO2_TO_NUMERIC[country.code];
        if (num) result[num] = v;
      });
      setByNumeric(result);
    })();
  }, []);

  const activeColor = "hsl(var(--primary))";
  const inactiveColor = "hsl(var(--muted))";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Mapa de actividad</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <ComposableMap projectionConfig={{ scale: 140 }} style={{ width: "100%", height: "auto" }}>
            <Geographies geography={GEO_URL}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const id = String(geo.id).padStart(3, "0");
                  const activity = byNumeric[id];
                  const isActive = !!activity;
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={isActive ? activeColor : "hsl(var(--background))"}
                      stroke="hsl(var(--border))"
                      strokeWidth={0.5}
                      style={{
                        default: { outline: "none" },
                        hover: { outline: "none", fill: isActive ? activeColor : inactiveColor, cursor: isActive ? "pointer" : "default", opacity: isActive ? 0.85 : 1 },
                        pressed: { outline: "none" },
                      }}
                      onMouseEnter={(e) => {
                        if (activity) {
                          setHovered({ x: e.clientX, y: e.clientY, data: activity });
                        }
                      }}
                      onMouseMove={(e) => {
                        if (activity) {
                          setHovered({ x: e.clientX, y: e.clientY, data: activity });
                        }
                      }}
                      onMouseLeave={() => setHovered(null)}
                    />
                  );
                })
              }
            </Geographies>
          </ComposableMap>
          {hovered && (
            <div
              className="fixed pointer-events-none z-50 rounded-md border bg-popover text-popover-foreground shadow-md p-3 text-sm"
              style={{ left: hovered.x + 12, top: hovered.y + 12 }}
            >
              <div className="font-medium mb-1">{hovered.data.name}</div>
              {hovered.data.brands.size > 0 ? (
                <div className="flex flex-wrap gap-1 max-w-[240px]">
                  {Array.from(hovered.data.brands).map((b) => (
                    <Badge key={b} variant="secondary" className="text-xs">{b}</Badge>
                  ))}
                </div>
              ) : (
                <div className="text-muted-foreground text-xs">Sin marcas registradas</div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
