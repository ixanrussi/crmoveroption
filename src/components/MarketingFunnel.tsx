import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter, Loader2 } from "lucide-react";

type Row = {
  tracker: string;
  brand: string;
  visits: number;
  signups: number;
  firstTimeDeposits: number;
  cpaCount: number;
};
type ApiResponse = { total: number; pageSize: number; data: Row[] };
type Affiliate = { id: string; fixed_name: string; aliases: string[] | null };

const normalize = (s: string) =>
  (s ?? "").toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

const iso = (d: Date) => d.toISOString().slice(0, 10);
function rangeFor(preset: string) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
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

const pct = (num: number, den: number) => (den > 0 ? (num / den) * 100 : 0);
const fmtPct = (n: number) => `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
const fmtInt = (n: number) => Math.round(n).toLocaleString();

type Stage = { key: string; label: string; value: number; color: string };

export default function MarketingFunnel() {
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

  const totals = useMemo(() => {
    let v = 0, s = 0, f = 0, c = 0;
    for (const r of rows) {
      v += Number(r.visits) || 0;
      s += Number(r.signups) || 0;
      f += Number(r.firstTimeDeposits) || 0;
      c += Number(r.cpaCount) || 0;
    }
    return { v, s, f, c };
  }, [rows]);

  const stages: Stage[] = [
    { key: "v", label: "Visitas", value: totals.v, color: "hsl(var(--primary))" },
    { key: "s", label: "Registros", value: totals.s, color: "hsl(var(--primary) / 0.85)" },
    { key: "f", label: "FTDs", value: totals.f, color: "hsl(var(--primary) / 0.7)" },
    { key: "c", label: "CPAs validados", value: totals.c, color: "hsl(var(--primary) / 0.55)" },
  ];
  const maxStage = stages[0].value || 1;

  const transitions = [
    { label: "Visit → Signup", value: pct(totals.s, totals.v) },
    { label: "Signup → FTD", value: pct(totals.f, totals.s) },
    { label: "FTD → CPA validado", value: pct(totals.c, totals.f) },
  ];
  const overall = pct(totals.c, totals.v);

  // Aggregate by brand and by affiliate
  const byBrand = useMemo(() => {
    const m = new Map<string, { v: number; s: number; f: number; c: number }>();
    for (const r of rows) {
      const b = (r.brand ?? "").trim() || "—";
      const o = m.get(b) ?? { v: 0, s: 0, f: 0, c: 0 };
      o.v += +r.visits || 0; o.s += +r.signups || 0; o.f += +r.firstTimeDeposits || 0; o.c += +r.cpaCount || 0;
      m.set(b, o);
    }
    return Array.from(m.entries()).map(([name, t]) => ({
      name, ...t,
      visitToFtd: pct(t.f, t.v),
      signupToFtd: pct(t.f, t.s),
      ftdToCpa: pct(t.c, t.f),
      visitToCpa: pct(t.c, t.v),
    }));
  }, [rows]);

  const byAffiliate = useMemo(() => {
    const m = new Map<string, { v: number; s: number; f: number; c: number }>();
    for (const r of rows) {
      const name = aliasMap.get(normalize(r.tracker));
      if (!name) continue;
      const o = m.get(name) ?? { v: 0, s: 0, f: 0, c: 0 };
      o.v += +r.visits || 0; o.s += +r.signups || 0; o.f += +r.firstTimeDeposits || 0; o.c += +r.cpaCount || 0;
      m.set(name, o);
    }
    return Array.from(m.entries()).map(([name, t]) => ({
      name, ...t,
      visitToFtd: pct(t.f, t.v),
      signupToFtd: pct(t.f, t.s),
      ftdToCpa: pct(t.c, t.f),
      visitToCpa: pct(t.c, t.v),
    }));
  }, [rows, aliasMap]);

  // Operadores con funnel mas optimizado: Signup→FTD (operador controla onboarding) + FTD→CPA, con minimo de volumen
  const minSignups = 20;
  const topBrands = useMemo(() => {
    return byBrand
      .filter(b => b.s >= minSignups)
      .sort((a, b) => (b.signupToFtd * 0.6 + b.ftdToCpa * 0.4) - (a.signupToFtd * 0.6 + a.ftdToCpa * 0.4))
      .slice(0, 5);
  }, [byBrand]);

  // Afiliados que traen mejor calidad de tráfico: Visit→FTD (volumen útil) con min de visitas
  const minVisits = 200;
  const topAffs = useMemo(() => {
    return byAffiliate
      .filter(a => a.v >= minVisits)
      .sort((a, b) => b.visitToFtd - a.visitToFtd)
      .slice(0, 5);
  }, [byAffiliate]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Funnel global de conversión</CardTitle>
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
      <CardContent className="space-y-6">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-12 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
          </div>
        ) : error ? (
          <div className="text-sm text-destructive">{error}</div>
        ) : (
          <>
            {/* Funnel visual SVG */}
            {(() => {
              const W = 1000, H = 220, cy = H / 2, maxH = 170;
              const segW = W / stages.length;
              const heightFor = (v: number) => (maxStage ? Math.max(8, (v / maxStage) * maxH) : 8);
              const colors = [
                "hsl(210 90% 75%)",
                "hsl(212 85% 65%)",
                "hsl(215 80% 55%)",
                "hsl(218 75% 45%)",
              ];
              return (
                <div className="w-full">
                  <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
                    <defs>
                      {colors.map((c, i) => (
                        <linearGradient key={i} id={`grad-${i}`} x1="0" x2="1" y1="0" y2="0">
                          <stop offset="0%" stopColor={c} stopOpacity="0.7" />
                          <stop offset="100%" stopColor={colors[i + 1] ?? c} stopOpacity="0.7" />
                        </linearGradient>
                      ))}
                    </defs>
                    {stages.map((st, i) => {
                      const next = stages[i + 1];
                      const h1 = heightFor(st.value) / 2;
                      const h2 = heightFor(next ? next.value : st.value * 0.6) / 2;
                      const x1 = i * segW, x2 = (i + 1) * segW;
                      const points = [
                        `${x1},${cy - h1}`,
                        `${x2},${cy - h2}`,
                        `${x2},${cy + h2}`,
                        `${x1},${cy + h1}`,
                      ].join(" ");
                      const cx = (x1 + x2) / 2;
                      return (
                        <g key={st.key}>
                          <polygon points={points} fill={`url(#grad-${i})`} />
                          {/* value */}
                          <text x={cx} y={cy - 6} textAnchor="middle" className="fill-white" style={{ fontSize: 26, fontWeight: 700 }}>
                            {fmtInt(st.value)}
                          </text>
                          <text x={cx} y={cy + 18} textAnchor="middle" className="fill-white/90" style={{ fontSize: 13, fontWeight: 500 }}>
                            {st.label}
                          </text>
                          {/* conversion chip between stages */}
                          {i > 0 && (
                            <g transform={`translate(${x1}, ${cy - h1 - 30})`}>
                              <rect x={-46} y={-16} width={92} height={28} rx={14}
                                className="fill-background stroke-border" strokeWidth={1} />
                              <text x={0} y={4} textAnchor="middle" className="fill-foreground" style={{ fontSize: 13, fontWeight: 600 }}>
                                {fmtPct(pct(st.value, stages[i - 1].value))}
                              </text>
                            </g>
                          )}
                        </g>
                      );
                    })}
                  </svg>
                  <div className="mt-3 flex items-center justify-center">
                    <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-4 py-1.5 text-sm">
                      <span className="text-muted-foreground">Conversión global Visit → CPA</span>
                      <span className="font-bold text-primary">{fmtPct(overall)}</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="grid gap-4 md:grid-cols-2">
              {/* Top operadores */}
              <div>
                <div className="text-sm font-semibold mb-2">Operadores con funnel más optimizado</div>
                <div className="text-[11px] text-muted-foreground mb-2">Mín. {minSignups} signups · score = 60% Signup→FTD + 40% FTD→CPA</div>
                {topBrands.length === 0 ? (
                  <div className="text-xs text-muted-foreground">Sin datos suficientes.</div>
                ) : (
                  <table className="w-full text-xs">
                    <thead className="text-muted-foreground">
                      <tr className="border-b">
                        <th className="text-left font-medium py-1">Marca</th>
                        <th className="text-right font-medium">S→F</th>
                        <th className="text-right font-medium">F→CPA</th>
                        <th className="text-right font-medium">V→CPA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topBrands.map(b => (
                        <tr key={b.name} className="border-b last:border-0">
                          <td className="py-1.5 truncate max-w-[140px]">{b.name}</td>
                          <td className="text-right tabular-nums">{fmtPct(b.signupToFtd)}</td>
                          <td className="text-right tabular-nums">{fmtPct(b.ftdToCpa)}</td>
                          <td className="text-right tabular-nums font-semibold">{fmtPct(b.visitToCpa)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Top afiliados por calidad */}
              <div>
                <div className="text-sm font-semibold mb-2">Afiliados con mejor calidad de tráfico</div>
                <div className="text-[11px] text-muted-foreground mb-2">Mín. {minVisits} visitas · ordenado por Visit → FTD</div>
                {topAffs.length === 0 ? (
                  <div className="text-xs text-muted-foreground">Sin datos suficientes.</div>
                ) : (
                  <table className="w-full text-xs">
                    <thead className="text-muted-foreground">
                      <tr className="border-b">
                        <th className="text-left font-medium py-1">Afiliado</th>
                        <th className="text-right font-medium">Visitas</th>
                        <th className="text-right font-medium">FTDs</th>
                        <th className="text-right font-medium">V→FTD</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topAffs.map(a => (
                        <tr key={a.name} className="border-b last:border-0">
                          <td className="py-1.5 truncate max-w-[140px]">{a.name}</td>
                          <td className="text-right tabular-nums">{fmtInt(a.v)}</td>
                          <td className="text-right tabular-nums">{fmtInt(a.f)}</td>
                          <td className="text-right tabular-nums font-semibold">{fmtPct(a.visitToFtd)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
