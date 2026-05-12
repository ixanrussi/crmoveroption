import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Save, ShieldAlert, ShieldCheck, AlertTriangle, TrendingUp, Activity } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useCurrencies } from "@/lib/currencies";

type Affiliate = { id: string; fixed_name: string; unique_id: string };

type PlanLite = {
  id: string;
  description: string | null;
  brand: string | null;
  currency: string | null;
  cpa: number | null;
  overoption_retention: number | null;
};

type OperatorLite = {
  id: string;
  company_name: string;
  client_commission_plans: PlanLite[];
};

type SalarySelection = {
  uid: string;
  opId: string;
  planId: string;
  weight: number; // % de mix esperado
};

type Deal = {
  id: string;
  affiliate_id: string;
  name: string;
  status: "active" | "paused" | "ended";
  start_date: string;
  end_date: string | null;
  salary_amount: number;
  salary_currency: string;
  cpa_bonus_amount: number | null;
  cpa_bonus_threshold: number | null;
  selections: SalarySelection[];
  breakeven_ftd_monthly: number | null;
  trigger_min_ftd_monthly: number | null;
  trigger_breakeven_pct: number | null;
  trigger_min_ngr_per_ftd: number | null;
  trial_months: number | null;
  notes: string | null;
  created_at: string;
};

const newSel = (): SalarySelection => ({ uid: Math.random().toString(36).slice(2), opId: "", planId: "", weight: 100 });

const fmt = (n: number, cur?: string) =>
  new Intl.NumberFormat("es-ES", { style: cur ? "currency" : "decimal", currency: cur, maximumFractionDigits: 0 }).format(Math.round(n));

export default function SalaryDealMode({ operators }: { operators: OperatorLite[] }) {
  const { user, isSuperAdmin } = useAuth();
  const currencies = useCurrencies();
  const isAdmin = isSuperAdmin; // also admins can write per RLS; this just gates UI

  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [affiliateId, setAffiliateId] = useState<string>("");
  const [name, setName] = useState("");
  const [salary, setSalary] = useState<string>("");
  const [salaryCurrency, setSalaryCurrency] = useState<string>("EUR");
  const [bonusAmount, setBonusAmount] = useState<string>("");
  const [bonusThreshold, setBonusThreshold] = useState<string>("");
  const [trialMonths, setTrialMonths] = useState<string>("0");
  const [trgMinFtd, setTrgMinFtd] = useState<string>("");
  const [trgBreakevenPct, setTrgBreakevenPct] = useState<string>("80");
  const [trgMinNgr, setTrgMinNgr] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [selections, setSelections] = useState<SalarySelection[]>([newSel()]);
  const [saving, setSaving] = useState(false);

  const [deals, setDeals] = useState<Deal[]>([]);
  const [analysis, setAnalysis] = useState<{ months: { period: string; ftd: number; ngrPerFtd: number }[] } | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("affiliates")
        .select("id, fixed_name, unique_id")
        .order("fixed_name");
      setAffiliates((data ?? []) as any);
    })();
  }, []);

  const loadDeals = async (affId: string) => {
    const { data } = await supabase
      .from("affiliate_salary_deals")
      .select("*")
      .eq("affiliate_id", affId)
      .order("created_at", { ascending: false });
    setDeals((data ?? []) as any);
  };

  const loadAnalysis = async (affId: string) => {
    // FTDs y NGR mensual desde los cierres de comisión
    const { data: items } = await supabase
      .from("commission_closure_items")
      .select("closure_id, qualified_players, sports_ngr, casino_ngr")
      .eq("affiliate_id", affId);
    if (!items?.length) { setAnalysis({ months: [] }); return; }
    const closureIds = Array.from(new Set(items.map((i: any) => i.closure_id)));
    const { data: closures } = await supabase
      .from("commission_closures")
      .select("id, period")
      .in("id", closureIds);
    const periodMap = new Map<string, string>();
    (closures ?? []).forEach((c: any) => periodMap.set(c.id, c.period));

    const acc = new Map<string, { ftd: number; ngr: number }>();
    items.forEach((i: any) => {
      const p = periodMap.get(i.closure_id) || "?";
      const cur = acc.get(p) || { ftd: 0, ngr: 0 };
      cur.ftd += i.qualified_players || 0;
      cur.ngr += (Number(i.sports_ngr) || 0) + (Number(i.casino_ngr) || 0);
      acc.set(p, cur);
    });
    const months = Array.from(acc.entries())
      .map(([period, v]) => ({ period, ftd: v.ftd, ngrPerFtd: v.ftd > 0 ? v.ngr / v.ftd : 0 }))
      .sort((a, b) => a.period.localeCompare(b.period));
    setAnalysis({ months });
  };

  useEffect(() => {
    if (affiliateId) { loadDeals(affiliateId); loadAnalysis(affiliateId); }
    else { setDeals([]); setAnalysis(null); }
  }, [affiliateId]);

  // Cálculo de breakeven: salary / weighted CPA neto
  const breakeven = useMemo(() => {
    const sal = parseFloat(salary) || 0;
    if (!sal) return { weightedCpa: 0, ftdNeeded: 0 };
    const totalW = selections.reduce((s, x) => s + (Number(x.weight) || 0), 0);
    if (totalW <= 0) return { weightedCpa: 0, ftdNeeded: 0 };
    let weighted = 0;
    selections.forEach((s) => {
      const op = operators.find((o) => o.id === s.opId);
      const plan = op?.client_commission_plans.find((p) => p.id === s.planId);
      if (!plan) return;
      const cpaNeto = Math.max(0, (plan.cpa ?? 0) - (plan.overoption_retention ?? 0));
      weighted += cpaNeto * ((Number(s.weight) || 0) / totalW);
    });
    if (weighted <= 0) return { weightedCpa: 0, ftdNeeded: 0 };
    return { weightedCpa: weighted, ftdNeeded: Math.ceil(sal / weighted) };
  }, [salary, selections, operators]);

  const updateSel = (uid: string, patch: Partial<SalarySelection>) =>
    setSelections((p) => p.map((s) => (s.uid === uid ? { ...s, ...patch } : s)));

  const handleSave = async () => {
    if (!user) return toast.error("Inicia sesión");
    if (!affiliateId) return toast.error("Selecciona un afiliado");
    if (!name.trim()) return toast.error("Nombra el deal");
    if (!parseFloat(salary)) return toast.error("Indica el salario");
    setSaving(true);
    const { error } = await supabase.from("affiliate_salary_deals").insert({
      affiliate_id: affiliateId,
      name: name.trim(),
      salary_amount: parseFloat(salary) || 0,
      salary_currency: salaryCurrency,
      cpa_bonus_amount: parseFloat(bonusAmount) || 0,
      cpa_bonus_threshold: parseInt(bonusThreshold) || 0,
      selections: selections as any,
      breakeven_ftd_monthly: breakeven.ftdNeeded,
      trigger_min_ftd_monthly: trgMinFtd ? parseInt(trgMinFtd) : null,
      trigger_breakeven_pct: trgBreakevenPct ? parseFloat(trgBreakevenPct) : null,
      trigger_min_ngr_per_ftd: trgMinNgr ? parseFloat(trgMinNgr) : null,
      trial_months: parseInt(trialMonths) || 0,
      notes: notes || null,
      created_by: user.id,
    });
    setSaving(false);
    if (error) return toast.error("No se pudo guardar el deal");
    toast.success("Deal de salario guardado y atribuido al afiliado");
    loadDeals(affiliateId);
  };

  // Evaluación de salud para cada deal activo
  const evaluateDeal = (d: Deal) => {
    if (!analysis) return null;
    const months = analysis.months;
    const lastMonths = months.slice(-6); // últimos 6 cierres
    const avgFtd = lastMonths.length ? lastMonths.reduce((s, m) => s + m.ftd, 0) / lastMonths.length : 0;
    const avgNgrPerFtd = lastMonths.length ? lastMonths.reduce((s, m) => s + m.ngrPerFtd, 0) / lastMonths.length : 0;
    const breakevenFtd = d.breakeven_ftd_monthly || 0;
    const pctBreakeven = breakevenFtd > 0 ? (avgFtd / breakevenFtd) * 100 : 0;

    const alerts: { level: "ok" | "warn" | "danger"; label: string }[] = [];
    if (d.trigger_min_ftd_monthly != null) {
      const ok = avgFtd >= d.trigger_min_ftd_monthly;
      alerts.push({
        level: ok ? "ok" : "danger",
        label: `FTD mín mensual: ${avgFtd.toFixed(0)} / ${d.trigger_min_ftd_monthly}`,
      });
    }
    if (d.trigger_breakeven_pct != null && breakevenFtd > 0) {
      const ok = pctBreakeven >= d.trigger_breakeven_pct;
      alerts.push({
        level: ok ? "ok" : pctBreakeven >= d.trigger_breakeven_pct * 0.8 ? "warn" : "danger",
        label: `Breakeven: ${pctBreakeven.toFixed(0)}% / ${d.trigger_breakeven_pct}%`,
      });
    }
    if (d.trigger_min_ngr_per_ftd != null) {
      const ok = avgNgrPerFtd >= d.trigger_min_ngr_per_ftd;
      alerts.push({
        level: ok ? "ok" : "warn",
        label: `Calidad NGR/FTD: ${fmt(avgNgrPerFtd)} / ${fmt(d.trigger_min_ngr_per_ftd)}`,
      });
    }
    return { avgFtd, avgNgrPerFtd, pctBreakeven, alerts, monthsAnalyzed: lastMonths.length };
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5" /> Oferta Salario + CPA
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            El afiliado siente seguridad de un salario fijo mensual. Define triggers para vigilar que la entrega real
            mantenga la negociación saludable.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Afiliado</Label>
              <Select value={affiliateId} onValueChange={setAffiliateId}>
                <SelectTrigger><SelectValue placeholder="Selecciona afiliado" /></SelectTrigger>
                <SelectContent>
                  {affiliates.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.fixed_name} · {a.unique_id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Nombre del deal</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Salario Q1 2026" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Salario mensual</Label>
              <Input type="number" min="0" value={salary} onChange={(e) => setSalary(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Moneda</Label>
              <Select value={salaryCurrency} onValueChange={setSalaryCurrency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {currencies.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Meses de prueba</Label>
              <Input type="number" min="0" value={trialMonths} onChange={(e) => setTrialMonths(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Bono por CPA adicional</Label>
              <Input type="number" min="0" value={bonusAmount} onChange={(e) => setBonusAmount(e.target.value)}
                placeholder="Pago por cada FTD sobre el umbral" />
            </div>
            <div className="space-y-1">
              <Label>Umbral de FTDs cubierto por salario</Label>
              <Input type="number" min="0" value={bonusThreshold} onChange={(e) => setBonusThreshold(e.target.value)}
                placeholder={breakeven.ftdNeeded ? `Sugerido: ${breakeven.ftdNeeded}` : ""} />
            </div>
          </div>

          {/* Mix de operadores para calcular breakeven */}
          <div className="space-y-2">
            <Label>Mix esperado de operadores (para calcular breakeven)</Label>
            {selections.map((s) => {
              const op = operators.find((o) => o.id === s.opId);
              return (
                <div key={s.uid} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5">
                    <Select value={s.opId} onValueChange={(v) => updateSel(s.uid, { opId: v, planId: "" })}>
                      <SelectTrigger><SelectValue placeholder="Operador" /></SelectTrigger>
                      <SelectContent>
                        {operators.map((o) => <SelectItem key={o.id} value={o.id}>{o.company_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-5">
                    <Select value={s.planId} onValueChange={(v) => updateSel(s.uid, { planId: v })} disabled={!op}>
                      <SelectTrigger><SelectValue placeholder="Plan" /></SelectTrigger>
                      <SelectContent>
                        {(op?.client_commission_plans ?? []).map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.brand ? `${p.brand} · ` : ""}{p.description || "—"}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Input type="number" min="0" max="100" value={s.weight}
                      onChange={(e) => updateSel(s.uid, { weight: parseFloat(e.target.value) || 0 })} placeholder="%" />
                  </div>
                </div>
              );
            })}
            <Button variant="outline" size="sm" onClick={() => setSelections((p) => [...p, newSel()])}>
              + Añadir operador al mix
            </Button>
          </div>

          {/* Breakeven snapshot */}
          {breakeven.ftdNeeded > 0 && (
            <div className="rounded-lg border-2 border-primary/40 bg-primary/5 p-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs uppercase text-muted-foreground">CPA neto medio</div>
                <div className="font-bold text-lg">{fmt(breakeven.weightedCpa, salaryCurrency)}</div>
              </div>
              <div>
                <div className="text-xs uppercase text-muted-foreground">Breakeven FTDs/mes</div>
                <div className="font-bold text-lg">{breakeven.ftdNeeded}</div>
              </div>
            </div>
          )}

          {/* Triggers de seguridad */}
          <div className="space-y-2 border-t pt-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-600" />
              <span className="font-semibold text-sm">Triggers de seguridad</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">FTDs mínimos / mes</Label>
                <Input type="number" min="0" value={trgMinFtd} onChange={(e) => setTrgMinFtd(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">% mín. vs breakeven</Label>
                <Input type="number" min="0" max="200" value={trgBreakevenPct} onChange={(e) => setTrgBreakevenPct(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">NGR mín. por FTD</Label>
                <Input type="number" min="0" value={trgMinNgr} onChange={(e) => setTrgMinNgr(e.target.value)} />
              </div>
            </div>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas / cláusulas extra de la negociación" />
          </div>

          <Button onClick={handleSave} disabled={saving || !affiliateId} className="w-full">
            <Save className="h-4 w-4 mr-2" /> {saving ? "Guardando..." : "Atribuir deal al afiliado"}
          </Button>
        </CardContent>
      </Card>

      {/* Análisis de salud */}
      {affiliateId && deals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5" /> Análisis de salud de los deals
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Cruzamos los FTDs reales del afiliado (cierres de comisión) con los triggers definidos.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {deals.map((d) => {
              const ev = evaluateDeal(d);
              const dangerCount = ev?.alerts.filter((a) => a.level === "danger").length ?? 0;
              const warnCount = ev?.alerts.filter((a) => a.level === "warn").length ?? 0;
              const overall = dangerCount ? "danger" : warnCount ? "warn" : "ok";
              return (
                <div key={d.id} className="rounded-lg border p-3 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <div className="font-semibold">{d.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {fmt(d.salary_amount, d.salary_currency)} / mes · breakeven {d.breakeven_ftd_monthly} FTDs
                        {d.trial_months ? ` · prueba ${d.trial_months}m` : ""}
                      </div>
                    </div>
                    <Badge variant={overall === "ok" ? "default" : overall === "warn" ? "secondary" : "destructive"}>
                      {overall === "ok" ? <ShieldCheck className="h-3 w-3 mr-1" /> : <AlertTriangle className="h-3 w-3 mr-1" />}
                      {overall === "ok" ? "Saludable" : overall === "warn" ? "Atención" : "Riesgo"}
                    </Badge>
                  </div>

                  {ev && ev.monthsAnalyzed === 0 && (
                    <p className="text-xs text-muted-foreground">Sin cierres de comisión todavía para este afiliado.</p>
                  )}

                  {ev && ev.monthsAnalyzed > 0 && (
                    <>
                      <div className="grid grid-cols-3 gap-2 text-center text-sm">
                        <div className="rounded border p-2 bg-muted/40">
                          <div className="text-[10px] uppercase text-muted-foreground">FTD/mes (avg)</div>
                          <div className="font-bold">{ev.avgFtd.toFixed(0)}</div>
                        </div>
                        <div className="rounded border p-2 bg-muted/40">
                          <div className="text-[10px] uppercase text-muted-foreground">% breakeven</div>
                          <div className="font-bold">{ev.pctBreakeven.toFixed(0)}%</div>
                        </div>
                        <div className="rounded border p-2 bg-muted/40">
                          <div className="text-[10px] uppercase text-muted-foreground">NGR / FTD</div>
                          <div className="font-bold">{fmt(ev.avgNgrPerFtd)}</div>
                        </div>
                      </div>
                      <div className="space-y-1">
                        {ev.alerts.map((a, i) => (
                          <div key={i} className={`text-xs rounded px-2 py-1 flex items-center gap-2 ${
                            a.level === "ok" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" :
                            a.level === "warn" ? "bg-amber-500/10 text-amber-700 dark:text-amber-400" :
                            "bg-destructive/10 text-destructive"
                          }`}>
                            {a.level === "ok" ? <ShieldCheck className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                            {a.label}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
