import { useEffect, useMemo, useState } from "react";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import { supabase } from "@/integrations/supabase/client";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// ISO 3166-1 alpha-2 -> numeric (string, with leading zeros) for our supported countries
const ISO2_TO_NUMERIC: Record<string, string> = {
  AR: "032", BR: "076", CL: "152", CO: "170", CR: "188", EC: "218",
  SV: "222", ES: "724", GT: "320", HN: "340", MX: "484", NI: "558",
  PA: "591", PY: "600", PE: "604", DO: "214", UY: "858", VE: "862",
};

type Region = "world" | "latam" | "europa";

const LATAM_NUMERIC = new Set([
  "032","076","152","170","188","218","222","320","340","484","558","591","600","604","214","858","862",
]);
const EUROPA_NUMERIC = new Set([
  "724","620","250","276","380","442","056","528","040","752","208","246","372","705","703","616","203","348","100","642","191","705","070","688","807","499","498","804","112","233","428","440","233","756","826",
]);

const REGION_VIEW: Record<Region, { center: [number, number]; scale: number }> = {
  world: { center: [0, 20], scale: 140 },
  latam: { center: [-65, -15], scale: 380 },
  europa: { center: [15, 52], scale: 600 },
};

type CountryActivity = {
  name: string;
  code: string;
  brands: Set<string>;
};

export default function WorldActivityMap() {
  const [byNumeric, setByNumeric] = useState<Record<string, CountryActivity>>({});
  const [hovered, setHovered] = useState<{ x: number; y: number; data: CountryActivity } | null>(null);
  const [region, setRegion] = useState<Region>("latam");

  useEffect(() => {
    (async () => {
      const [{ data: countries }, { data: plans }, { data: clients }] = await Promise.all([
        supabase.from("countries").select("id, name, code"),
        supabase.from("client_commission_plans").select("client_id, brand, country_id, country_ids"),
        supabase.from("clients").select("id, company_name, status"),
      ]);
      if (!countries) return;

      const clientById = new Map<string, any>();
      (clients ?? []).forEach((c: any) => clientById.set(c.id, c));

      const byCountryId = new Map<string, CountryActivity>();
      countries.forEach((c: any) => {
        if (!c.code || !ISO2_TO_NUMERIC[c.code]) return;
        byCountryId.set(c.id, { name: c.name, code: c.code, brands: new Set<string>() });
      });

      (plans ?? []).forEach((p: any) => {
        const client = clientById.get(p.client_id);
        if (!client || client.status === "inactive") return;
        const brand = (p.brand && p.brand.trim()) ? p.brand.trim() : client.company_name;
        if (!brand) return;
        const cids: string[] = [
          ...(p.country_ids ?? []),
          ...(p.country_id ? [p.country_id] : []),
        ];
        cids.forEach((cid) => {
          const entry = byCountryId.get(cid);
          if (entry) entry.brands.add(brand);
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

  const view = REGION_VIEW[region];
  const regionFilter = (id: string) =>
    region === "world" ? true : region === "latam" ? LATAM_NUMERIC.has(id) : EUROPA_NUMERIC.has(id);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">Mapa de actividad</CardTitle>
        <Tabs value={region} onValueChange={(v) => setRegion(v as Region)}>
          <TabsList>
            <TabsTrigger value="latam">LATAM</TabsTrigger>
            <TabsTrigger value="europa">Europa</TabsTrigger>
            <TabsTrigger value="world">Mundo</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <ComposableMap
            projection="geoMercator"
            projectionConfig={{ scale: view.scale, center: view.center }}
            style={{ width: "100%", height: "auto" }}
          >
            <Geographies geography={GEO_URL}>
              {({ geographies }) =>
                geographies
                  .filter((geo) => regionFilter(String(geo.id).padStart(3, "0")))
                  .map((geo) => {
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
