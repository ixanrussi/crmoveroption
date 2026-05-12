import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, BarChart3, Loader2 } from "lucide-react";
import {
  ResponsiveContainer, LineChart as RLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";

type Row = { date: string; cpaCount: number };
type ApiResponse = { total: number; pageSize: number; data: Row[] };

const iso = (d: Date) => d.toISOString().slice(0, 10);

function monthRange(year: number, month: number) {
  // month 0-indexed
  const from = new Date(year, month, 1);
  const to = new Date(year, month + 1, 0);
  return { from: iso(from), to: iso(to), days: to.getDate() };
}

export default function MonthlyCpaChart() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thisMonthRows, setThisMonthRows] = useState<Row[]>([]);
  const [lastMonthRows, setLastMonthRows] = useState<Row[]>([]);

  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const todayDay = today.getDate();

  const thisM = useMemo(() => monthRange(today.getFullYear(), today.getMonth()), [today]);
  const lastM = useMemo(() => monthRange(today.getFullYear(), today.getMonth() - 1), [today]);

  useEffect(() => {
    setLoading(true); setError(null);
    Promise.all([
      supabase.functions.invoke<ApiResponse>("routy-proxy", {
        body: { from: `${thisM.from}T00:00:00`, to: `${thisM.to}T23:59:59` },
      }),
      supabase.functions.invoke<ApiResponse>("routy-proxy", {
        body: { from: `${lastM.from}T00:00:00`, to: `${lastM.to}T23:59:59` },
      }),
    ]).then(([a, b]) => {
      if (a.error) throw a.error;
      if (b.error) throw b.error;
      setThisMonthRows(a.data?.data ?? []);
      setLastMonthRows(b.data?.data ?? []);
    }).catch((e) => setError(e?.message || "Error al cargar")).finally(() => setLoading(false));
  }, [thisM.from, thisM.to, lastM.from, lastM.to]);

  const chartData = useMemo(() => {
    const sumByDay = (rows: Row[]) => {
      const m = new Map<number, number>();
      for (const r of rows) {
        const d = new Date(r.date);
        if (Number.isNaN(d.getTime())) continue;
        const day = d.getDate();
        m.set(day, (m.get(day) ?? 0) + (Number(r.cpaCount) || 0));
      }
      return m;
    };
    const t = sumByDay(thisMonthRows);
    const l = sumByDay(lastMonthRows);
    const days = Math.max(thisM.days, lastM.days);
    const out: { day: number; "Este mes": number | null; "Mes pasado": number }[] = [];
    for (let d = 1; d <= days; d++) {
      out.push({
        day: d,
        "Este mes": d <= todayDay && d <= thisM.days ? (t.get(d) ?? 0) : null,
        "Mes pasado": l.get(d) ?? 0,
      });
    }
    return out;
  }, [thisMonthRows, lastMonthRows, thisM.days, lastM.days, todayDay]);

  const totals = useMemo(() => {
    const sum = (rows: Row[]) => rows.reduce((s, r) => s + (Number(r.cpaCount) || 0), 0);
    const lastUpToToday = lastMonthRows.reduce((s, r) => {
      const d = new Date(r.date);
      if (Number.isNaN(d.getTime())) return s;
      return d.getDate() <= todayDay ? s + (Number(r.cpaCount) || 0) : s;
    }, 0);
    return { thisTotal: sum(thisMonthRows), lastUpToToday };
  }, [thisMonthRows, lastMonthRows, todayDay]);

  const diff = totals.thisTotal - totals.lastUpToToday;
  const diffPct = totals.lastUpToToday ? (diff / totals.lastUpToToday) * 100 : 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">CPAs validados — Este mes vs Mes pasado</CardTitle>
        </div>
        {!loading && !error && (
          <div className="text-xs text-muted-foreground">
            Hoy (acumulado): <span className="font-semibold text-foreground">{totals.thisTotal}</span>
            {" · "}Mismo día mes pasado: <span className="font-semibold text-foreground">{totals.lastUpToToday}</span>
            {totals.lastUpToToday > 0 && (
              <span className={`ml-1 ${diff >= 0 ? "text-success" : "text-destructive"}`}>
                ({diff >= 0 ? "+" : ""}{diffPct.toFixed(1)}%)
              </span>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-12 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
          </div>
        ) : error ? (
          <div className="text-sm text-destructive">{error}</div>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RLineChart data={chartData} margin={{ top: 5, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }}
                  labelFormatter={(d) => `Día ${d}`}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="Mes pasado" stroke="hsl(var(--muted-foreground))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Este mes" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 2 }} connectNulls={false} />
              </RLineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
