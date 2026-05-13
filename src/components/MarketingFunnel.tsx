import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, Filter, Loader2 } from "lucide-react";

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
  const [showByBrand, setShowByBrand] = useState(false);

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
            {/* Funnel horizontal 3D inspirado en cono apilado */}
            {(() => {
              const W = 1000, H = 280, cy = H / 2, maxH = 230, minH = 90;
              const segW = W / stages.length;
              const scale = (v: number) => (maxStage ? Math.sqrt(Math.max(0, v) / maxStage) : 0);
              const heightFor = (v: number) => Math.max(minH, scale(v) * maxH);

              // Multicolor palette inspired by the reference (warm → cool)
              const palette = [
                { face: "hsl(210 90% 72%)", ring: "hsl(210 80% 58%)" },
                { face: "hsl(220 85% 64%)", ring: "hsl(220 78% 50%)" },
                { face: "hsl(232 75% 58%)", ring: "hsl(232 70% 44%)" },
                { face: "hsl(248 70% 52%)", ring: "hsl(248 65% 40%)" },
              ];

              const halves = stages.map(s => heightFor(s.value) / 2);
              const xs = stages.map((_, i) => i * segW);
              xs.push(W);
              halves.push(halves[halves.length - 1] * 0.55);

              // Build each slice as a 3D-looking band with bulged right ellipse
              const segments = stages.map((st, i) => {
                const xL = xs[i], xR = xs[i + 1];
                const hL = halves[i], hR = halves[i + 1];
                const rxR = Math.min(28, (xR - xL) * 0.18);
                const rxL = i === 0 ? Math.min(36, (xR - xL) * 0.22) : 0;
                // Body: top edge L→R, right ellipse front (bulge right), bottom edge R→L, left ellipse back (concave) for 1st only
                let d = `M ${xL} ${cy - hL}`;
                d += ` L ${xR} ${cy - hR}`;
                d += ` A ${rxR} ${hR} 0 0 1 ${xR} ${cy + hR}`;
                d += ` L ${xL} ${cy + hL}`;
                if (i === 0) {
                  // open bowl on the left (concave back)
                  d += ` A ${rxL} ${hL} 0 0 1 ${xL} ${cy - hL}`;
                } else {
                  d += ` Z`;
                }
                return { st, i, xL, xR, hL, hR, rxR, d };
              });

              return (
                <div className="w-full">
                  <button
                    type="button"
                    onClick={() => setShowByBrand(v => !v)}
                    className="w-full text-left rounded-lg transition hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
                    aria-expanded={showByBrand}
                    title="Click para ver el funnel por marca"
                  >
                  <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
                    <defs>
                      {/* Very subtle blue gradient for fill */}
                      <linearGradient id="funnel-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(210 80% 65%)" stopOpacity="0.15" />
                        <stop offset="50%" stopColor="hsl(210 80% 60%)" stopOpacity="0.22" />
                        <stop offset="100%" stopColor="hsl(215 80% 55%)" stopOpacity="0.10" />
                      </linearGradient>
                      {/* Soft top highlight line */}
                      <linearGradient id="funnel-stroke" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="hsl(210 90% 72%)" stopOpacity="0.7" />
                        <stop offset="50%" stopColor="hsl(210 80% 60%)" stopOpacity="1" />
                        <stop offset="100%" stopColor="hsl(220 85% 55%)" stopOpacity="0.7" />
                      </linearGradient>
                    </defs>

                    {/* Build funnel outline as a single smooth shape */}
                    {(() => {
                      // Top edge
                      let topD = `M ${xs[0]} ${cy - halves[0]}`;
                      for (let i = 1; i <= stages.length; i++) {
                        const xL = xs[i - 1], xR = xs[i];
                        const hL = halves[i - 1], hR = halves[i];
                        const cx = (xL + xR) / 2;
                        topD += ` Q ${cx} ${cy - (hL + hR) / 2 - 2} ${xR} ${cy - hR}`;
                      }
                      // Bottom edge (reverse)
                      for (let i = stages.length; i >= 1; i--) {
                        const xL = xs[i - 1], xR = xs[i];
                        const hL = halves[i - 1], hR = halves[i];
                        const cx = (xL + xR) / 2;
                        topD += ` Q ${cx} ${cy + (hL + hR) / 2 + 2} ${xL} ${cy + hL}`;
                      }
                      topD += " Z";
                      return (
                        <>
                          {/* Faint fill */}
                          <path d={topD} fill="url(#funnel-fill)" stroke="none" />
                          {/* Top contour line */}
                          <path
                            d={(() => {
                              let d = `M ${xs[0]} ${cy - halves[0]}`;
                              for (let i = 1; i <= stages.length; i++) {
                                const xL = xs[i - 1], xR = xs[i];
                                const hL = halves[i - 1], hR = halves[i];
                                const cx = (xL + xR) / 2;
                                d += ` Q ${cx} ${cy - (hL + hR) / 2 - 2} ${xR} ${cy - hR}`;
                              }
                              return d;
                            })()}
                            fill="none"
                            stroke="url(#funnel-stroke)"
                            strokeWidth={1.5}
                          />
                          {/* Bottom contour line */}
                          <path
                            d={(() => {
                              let d = `M ${xs[stages.length]} ${cy + halves[stages.length]}`;
                              for (let i = stages.length; i >= 1; i--) {
                                const xL = xs[i - 1], xR = xs[i];
                                const hL = halves[i - 1], hR = halves[i];
                                const cx = (xL + xR) / 2;
                                d += ` Q ${cx} ${cy + (hL + hR) / 2 + 2} ${xL} ${cy + hL}`;
                              }
                              return d;
                            })()}
                            fill="none"
                            stroke="url(#funnel-stroke)"
                            strokeWidth={1.5}
                          />
                          {/* Vertical dividing lines between stages */}
                          {stages.map((st, i) => {
                            if (i === 0) return null;
                            const x = xs[i];
                            return (
                              <line
                                key={`div-${st.key}`}
                                x1={x}
                                y1={cy - halves[i] - 2}
                                x2={x}
                                y2={cy + halves[i] + 2}
                                stroke="hsl(210 80% 60%)"
                                strokeWidth={1}
                                strokeOpacity={0.4}
                                strokeDasharray="4 3"
                              />
                            );
                          })}
                          {/* Soft horizontal midline for each stage */}
                          {stages.map((st, i) => {
                            const xL = xs[i], xR = xs[i + 1];
                            return (
                              <line
                                key={`mid-${st.key}`}
                                x1={xL + 8}
                                y1={cy}
                                x2={xR - 8}
                                y2={cy}
                                stroke="hsl(210 80% 65%)"
                                strokeWidth={0.5}
                                strokeOpacity={0.15}
                              />
                            );
                          })}
                        </>
                      );
                    })()}

                    {/* Labels - kept at same approximate positions */}
                    {stages.map((st, i) => {
                      const xL = xs[i], xR = xs[i + 1];
                      const cx = (xL + xR) / 2;
                      return (
                        <g key={st.key}>
                          <text x={cx} y={cy - 6} textAnchor="middle" className="fill-foreground" style={{ fontSize: 26, fontWeight: 800, letterSpacing: 0.3 }}>
                            {fmtInt(st.value)}
                          </text>
                          <text x={cx} y={cy + 18} textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 12, fontWeight: 600 }}>
                            {st.label}
                          </text>
                        </g>
                      );
                    })}

                    {/* Conversion chips between stages */}
                    {stages.slice(1).map((st, idx) => {
                      const i = idx + 1;
                      const xPrev = (xs[i - 1] + xs[i]) / 2;
                      const xCur = (xs[i] + xs[i + 1]) / 2;
                      const x = (xPrev + xCur) / 2;
                      return (
                        <g key={`chip-${st.key}`} transform={`translate(${x}, ${cy})`}>
                          <rect x={-40} y={-13} width={80} height={26} rx={13}
                            className="fill-background stroke-border" strokeWidth={1} />
                          <text x={0} y={4} textAnchor="middle" className="fill-foreground" style={{ fontSize: 12, fontWeight: 700 }}>
                            {fmtPct(pct(st.value, stages[i - 1].value))}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                  </button>
                  <div className="mt-3 flex items-center justify-center gap-3">
                    <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-4 py-1.5 text-sm">
                      <span className="text-muted-foreground">Conversión global Visit → CPA</span>
                      <span className="font-bold text-primary">{fmtPct(overall)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowByBrand(v => !v)}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showByBrand ? "rotate-180" : ""}`} />
                      {showByBrand ? "Ocultar funnel por marca" : "Ver funnel por marca"}
                    </button>
                  </div>

                  {showByBrand && (
                    <div className="mt-4 rounded-lg border bg-card/50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
                      <div className="max-h-72 overflow-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-muted/40 text-muted-foreground sticky top-0">
                            <tr>
                              <th className="text-left font-medium py-2 px-3">Marca</th>
                              <th className="text-right font-medium px-2">Visitas</th>
                              <th className="text-right font-medium px-2 text-muted-foreground/80">V→R</th>
                              <th className="text-right font-medium px-2">Registros</th>
                              <th className="text-right font-medium px-2 text-muted-foreground/80">R→F</th>
                              <th className="text-right font-medium px-2">FTDs</th>
                              <th className="text-right font-medium px-2 text-muted-foreground/80">F→CPA</th>
                              <th className="text-right font-medium px-2">CPAs</th>
                              <th className="text-right font-medium px-3">V→CPA</th>
                            </tr>
                          </thead>
                          <tbody>
                            {byBrand
                              .slice()
                              .sort((a, b) => b.v - a.v)
                              .map(b => (
                                <tr key={b.name} className="border-t hover:bg-muted/30">
                                  <td className="py-1.5 px-3 truncate max-w-[180px]">{b.name}</td>
                                  <td className="text-right tabular-nums px-2">{fmtInt(b.v)}</td>
                                  <td className="text-right tabular-nums px-2 text-muted-foreground">{fmtPct(pct(b.s, b.v))}</td>
                                  <td className="text-right tabular-nums px-2">{fmtInt(b.s)}</td>
                                  <td className="text-right tabular-nums px-2 text-muted-foreground">{fmtPct(b.signupToFtd)}</td>
                                  <td className="text-right tabular-nums px-2">{fmtInt(b.f)}</td>
                                  <td className="text-right tabular-nums px-2 text-muted-foreground">{fmtPct(b.ftdToCpa)}</td>
                                  <td className="text-right tabular-nums px-2">{fmtInt(b.c)}</td>
                                  <td className="text-right tabular-nums px-3 font-semibold">{fmtPct(b.visitToCpa)}</td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
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
