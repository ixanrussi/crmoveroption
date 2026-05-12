import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy, Loader2 } from "lucide-react";

type Row = { tracker: string; firstTimeDeposits: number };
type ApiResponse = { total: number; pageSize: number; data: Row[] };
type Affiliate = { id: string; fixed_name: string; aliases: string[] | null };

const normalize = (s: string) =>
  (s ?? "").toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

const UNDEF = "Affiliate Undefined";

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
  // last30 default
  f.setDate(f.getDate() - 30); return { from: iso(f), to: iso(today) };
}

export default function TopAffiliatesFTD() {
  const [preset, setPreset] = useState("last30");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);

  useEffect(() => {
    supabase.from("affiliates").select("id, fixed_name, aliases")
      .then(({ data }) => setAffiliates((data ?? []) as Affiliate[]));
  }, []);

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

  const aliasMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of affiliates) {
      for (const al of a.aliases ?? []) {
        const k = normalize(al);
        if (k) m.set(k, a.fixed_name);
      }
      const fk = normalize(a.fixed_name);
      if (fk && !m.has(fk)) m.set(fk, a.fixed_name);
    }
    return m;
  }, [affiliates]);

  const top = useMemo(() => {
    const agg = new Map<string, number>();
    for (const r of rows) {
      const name = aliasMap.get(normalize(r.tracker)) ?? UNDEF;
      if (name === UNDEF) continue;
      agg.set(name, (agg.get(name) ?? 0) + (Number(r.firstTimeDeposits) || 0));
    }
    return Array.from(agg.entries())
      .map(([name, ftd]) => ({ name, ftd }))
      .filter(x => x.ftd > 0)
      .sort((a, b) => b.ftd - a.ftd)
      .slice(0, 10);
  }, [rows, aliasMap]);

  const maxFtd = top[0]?.ftd ?? 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Top 10 Afiliados por FTDs</CardTitle>
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
                    <span className="font-semibold tabular-nums">{t.ftd.toLocaleString()}</span>
                  </div>
                  <div className="h-1.5 mt-1 rounded bg-muted overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: maxFtd ? `${(t.ftd / maxFtd) * 100}%` : "0%" }} />
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
