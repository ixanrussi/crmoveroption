import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Award, Loader2 } from "lucide-react";

type Row = { brand: string; earning: number; cpaCommission: number; revShareCommission: number };
type ApiResponse = { total: number; pageSize: number; data: Row[] };

function rangeFor(preset: string): { from: string; to: string } {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const f = new Date(today);
  if (preset === "today") return { from: iso(today), to: iso(today) };
  if (preset === "last7") { f.setDate(f.getDate() - 7); return { from: iso(f), to: iso(today) }; }
  if (preset === "thisMonth") { const x = new Date(today.getFullYear(), today.getMonth(), 1); return { from: iso(x), to: iso(today) }; }
  if (preset === "lastMonth") {
    const a = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const b = new Date(today.getFullYear(), today.getMonth(), 0);
    return { from: iso(a), to: iso(b) };
  }
  if (preset === "thisYear") { const x = new Date(today.getFullYear(), 0, 1); return { from: iso(x), to: iso(today) }; }
  f.setDate(f.getDate() - 30); return { from: iso(f), to: iso(today) };
}

const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function TopBrandsCommission() {
  const [preset, setPreset] = useState("last30");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    const { from, to } = rangeFor(preset);
    setLoading(true); setError(null);
    supabase.functions.invoke<ApiResponse>("routy-proxy", {
      body: { from: `${from}T00:00:00`, to: `${to}T23:59:59` },
    }).then(({ data, error }) => {
      if (error) { setError(error.message); setRows([]); }
      else setRows(data?.data ?? []);
    }).finally(() => setLoading(false));
  }, [preset]);

  const top = useMemo(() => {
    const agg = new Map<string, number>();
    for (const r of rows) {
      const brand = (r.brand ?? "").trim() || "—";
      const commission = (Number(r.cpaCommission) || 0) + (Number(r.revShareCommission) || 0)
        || (Number(r.earning) || 0);
      agg.set(brand, (agg.get(brand) ?? 0) + commission);
    }
    return Array.from(agg.entries())
      .map(([name, total]) => ({ name, total }))
      .filter(x => x.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [rows]);

  const max = top[0]?.total ?? 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <div className="flex items-center gap-2">
          <Award className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Top 10 Marcas por Comisión</CardTitle>
        </div>
        <Select value={preset} onValueChange={setPreset}>
          <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Hoy</SelectItem>
            <SelectItem value="last7">Últimos 7 días</SelectItem>
            <SelectItem value="last30">Últimos 30 días</SelectItem>
            <SelectItem value="thisMonth">Este mes</SelectItem>
            <SelectItem value="lastMonth">Mes pasado</SelectItem>
            <SelectItem value="thisYear">Este año</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
          </div>
        ) : error ? (
          <div className="text-sm text-destructive">{error}</div>
        ) : top.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center">Sin datos en el período.</div>
        ) : (
          <ol className="space-y-2">
            {top.map((t, i) => (
              <li key={t.name} className="flex items-center gap-3">
                <span className="w-6 text-xs font-semibold text-muted-foreground text-right">{i + 1}.</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate font-medium">{t.name}</span>
                    <span className="font-semibold tabular-nums">{fmt(t.total)}</span>
                  </div>
                  <div className="h-1.5 mt-1 rounded bg-muted overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: max ? `${(t.total / max) * 100}%` : "0%" }} />
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
