import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Download, FileSpreadsheet, FileText, Package } from "lucide-react";
import * as XLSX from "xlsx";
import { BUNDLES, buildBundleZip, type Bundle } from "@/lib/importBundles";


type AreaKey = "afiliados";

const AREAS: { key: AreaKey; label: string }[] = [
  { key: "afiliados", label: "Afiliados" },
];

type FieldDef = {
  key: string;
  label: string;
  // optional transform applied to row before export
  resolve?: (row: any, ctx: { countries: Map<string, string> }) => any;
};

const AFFILIATE_FIELDS: FieldDef[] = [
  { key: "unique_id", label: "ID único" },
  { key: "fixed_name", label: "Nombre fijo" },
  { key: "alias", label: "Alias" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Teléfono" },
  { key: "status", label: "Estado" },
  { key: "ext_id_oo", label: "EXT_UUID" },
  { key: "slug", label: "Slug" },
  {
    key: "country",
    label: "País principal",
    resolve: (r, { countries }) => (r.country_id ? countries.get(r.country_id) ?? "" : ""),
  },
  {
    key: "countries",
    label: "Países",
    resolve: (r, { countries }) =>
      (r.country_ids ?? []).map((id: string) => countries.get(id) ?? id).join(", "),
  },
  { key: "brands", label: "Marcas", resolve: (r) => (r.brands ?? []).join(", ") },
  { key: "aliases", label: "Aliases", resolve: (r) => (r.aliases ?? []).join(", ") },
  { key: "commission_pct", label: "% Comisión" },
  { key: "payment_method", label: "Método de pago" },
  { key: "bank_details", label: "Datos bancarios" },
  { key: "tax_id", label: "NIF / Tax ID" },
  { key: "fixed_remuneration", label: "Remuneración fija" },
  { key: "fixed_remuneration_currency", label: "Moneda rem. fija" },
  { key: "fixed_remuneration_min_ftd", label: "Min FTD rem. fija" },
  { key: "fixed_remuneration_fallback_cpa", label: "Fallback CPA" },
  { key: "fixed_remuneration_fallback_cpa_currency", label: "Moneda fallback CPA" },
  { key: "notes", label: "Notas" },
  { key: "created_at", label: "Fecha creación" },
  { key: "updated_at", label: "Fecha actualización" },
];

const FIELDS_BY_AREA: Record<AreaKey, FieldDef[]> = {
  afiliados: AFFILIATE_FIELDS,
};

export default function ExportData() {
  const [area, setArea] = useState<AreaKey>("afiliados");
  const [selected, setSelected] = useState<Set<string>>(
    new Set(AFFILIATE_FIELDS.slice(0, 8).map((f) => f.key)),
  );
  const [loading, setLoading] = useState(false);

  const fields = FIELDS_BY_AREA[area];

  useEffect(() => {
    setSelected(new Set(FIELDS_BY_AREA[area].slice(0, 8).map((f) => f.key)));
  }, [area]);

  const toggle = (k: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });
  };

  const allSelected = selected.size === fields.length;
  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(fields.map((f) => f.key)));
  };

  const buildRows = async () => {
    if (area === "afiliados") {
      const [{ data: affs, error }, { data: countries }] = await Promise.all([
        supabase.from("affiliates").select("*").order("fixed_name"),
        supabase.from("countries").select("id, name"),
      ]);
      if (error) throw error;
      const cMap = new Map<string, string>((countries ?? []).map((c: any) => [c.id, c.name]));
      const chosen = fields.filter((f) => selected.has(f.key));
      return (affs ?? []).map((row: any) => {
        const out: Record<string, any> = {};
        chosen.forEach((f) => {
          out[f.label] = f.resolve ? f.resolve(row, { countries: cMap }) : row[f.key] ?? "";
        });
        return out;
      });
    }
    return [];
  };

  const download = async (format: "csv" | "xlsx") => {
    if (selected.size === 0) {
      toast({ title: "Selecciona al menos un campo", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const rows = await buildRows();
      if (rows.length === 0) {
        toast({ title: "No hay datos para exportar" });
        return;
      }
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, area);
      const ts = new Date().toISOString().slice(0, 10);
      const filename = `${area}_${ts}.${format}`;
      if (format === "csv") {
        XLSX.writeFile(wb, filename, { bookType: "csv" });
      } else {
        XLSX.writeFile(wb, filename, { bookType: "xlsx" });
      }
      toast({ title: `Exportados ${rows.length} registros` });
    } catch (e: any) {
      toast({ title: "Error al exportar", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold">Descarga de datos</h1>
        <p className="text-muted-foreground text-sm">
          Selecciona el área y los campos que deseas exportar.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>1. Área</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-w-xs">
            <Label className="mb-2 block">Área</Label>
            <Select value={area} onValueChange={(v) => setArea(v as AreaKey)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AREAS.map((a) => (
                  <SelectItem key={a.key} value={a.key}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>2. Campos a exportar</CardTitle>
          <Button variant="outline" size="sm" onClick={toggleAll}>
            {allSelected ? "Deseleccionar todo" : "Seleccionar todo"}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {fields.map((f) => (
              <label
                key={f.key}
                className="flex items-center gap-2 p-2 rounded border hover:bg-muted cursor-pointer"
              >
                <Checkbox checked={selected.has(f.key)} onCheckedChange={() => toggle(f.key)} />
                <span className="text-sm">{f.label}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            {selected.size} de {fields.length} campos seleccionados
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>3. Descargar</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Button onClick={() => download("xlsx")} disabled={loading}>
            <FileSpreadsheet className="h-4 w-4" />
            Descargar Excel
          </Button>
          <Button variant="outline" onClick={() => download("csv")} disabled={loading}>
            <FileText className="h-4 w-4" />
            Descargar CSV
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
