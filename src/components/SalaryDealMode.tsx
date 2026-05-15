import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Save, ShieldAlert, ShieldCheck, AlertTriangle, TrendingUp, Activity,
  Plus, Trash2, Sparkles, Calculator, Clock, Target, Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useCurrencies } from "@/lib/currencies";

type Affiliate = { id: string; fixed_name: string; unique_id: string };
type Country = { id: string; name: string; code: string | null };

type PlanLite = {
  id: string;
  description: string | null;
  brand: string | null;
  currency: string | null;
  cpa: number | null;
  overoption_retention: number | null;
  country_ids?: string[] | null;
};

type OperatorLite = {
  id: string;
  company_name: string;
  brands?: string[] | null;
  login?: string | null;
  country_ids?: string[] | null;
  client_commission_plans: PlanLite[];
};

type SalarySelection = {
  uid: string;
  opId: string;
  planId: string;
  countryId: string;
  targetFtd: number;     // CPAs/mes objetivo en este país/marca
  autoSuggested?: boolean;
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
  selections: any;
  breakeven_ftd_monthly: number | null;
  trigger_min_ftd_monthly: number | null;
  trigger_breakeven_pct: number | null;
  trigger_min_activity_ratio: number | null;
  trigger_min_conversion_pct: number | null;
  trigger_min_net_margin: number | null;
  trial_months: number | null;
  notes: string | null;
  created_at: string;
};

const newSel = (): SalarySelection => ({
  uid: Math.random().toString(36).slice(2),
  opId: "", planId: "", countryId: "", targetFtd: 0,
});

const fmt = (n: number, cur?: string) =>
  new Intl.NumberFormat("es-ES", { style: cur ? "currency" : "decimal", currency: cur, maximumFractionDigits: 0 }).format(
    isFinite(n) ? Math.round(n) : 0
  );

export default function SalaryDealMode({ operators }: { operators: OperatorLite[] }) {
  const { user } = useAuth();
  const currencies = useCurrencies();

  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [affiliateId, setAffiliateId] = useState<string>("");
  const [name, setName] = useState("");
  const [salaryCurrency, setSalaryCurrency] = useState<string>("EUR");

  // Slider de seguridad: % del CPA neto esperado que se paga como salario fijo
  const [safetyPct, setSafetyPct] = useState<number>(75);
  // % del CPA neto que se paga al afiliado como bonus por cada CPA por encima del objetivo
  const [bonusPct, setBonusPct] = useState<number>(70);

  const [trialMonths, setTrialMonths] = useState<string>("3");
  const [notes, setNotes] = useState("");
  const [selections, setSelections] = useState<SalarySelection[]>([newSel()]);
  const [saving, setSaving] = useState(false);

  // Triggers de seguridad (post-firma)
  const [trgMinFtd, setTrgMinFtd] = useState<string>("");
  const [trgBreakevenPct, setTrgBreakevenPct] = useState<string>("80");
  const [trgActivityRatio, setTrgActivityRatio] = useState<string>("50");
  const [trgConversionPct, setTrgConversionPct] = useState<string>("");
  const [trgNetMargin, setTrgNetMargin] = useState<string>("0");
  // Touched flags: una vez que el usuario edita un trigger manualmente, dejamos de auto-rellenar
  const [trgTouched, setTrgTouched] = useState<{ minFtd?: boolean; breakevenPct?: boolean; activity?: boolean; conversion?: boolean; netMargin?: boolean }>({});

  // Modo inverso: defines salario → propongo volumen y meses de recuperación
  const [mode, setMode] = useState<"forward" | "inverse">("forward");
  const [inverseSalary, setInverseSalary] = useState<string>("");

  // Histórico para sugerencias automáticas
  const [historyByBrandCountry, setHistoryByBrandCountry] = useState<Record<string, number>>({});

  const [deals, setDeals] = useState<Deal[]>([]);
  const [analysis, setAnalysis] = useState<{
    months: { period: string; ftd: number; activeAccounts: number; newAccounts: number; cpaIncome: number; revshareIncome: number }[];
  } | null>(null);

  useEffect(() => {
    (async () => {
      const [a, c] = await Promise.all([
        supabase.from("affiliates").select("id, fixed_name, unique_id").order("fixed_name"),
        supabase.from("countries").select("id, name, code").order("name"),
      ]);
      setAffiliates((a.data ?? []) as any);
      setCountries((c.data ?? []) as any);
    })();
  }, []);

  const loadDeals = async (affId: string) => {
    const { data } = await supabase.from("affiliate_salary_deals").select("*").eq("affiliate_id", affId)
      .order("created_at", { ascending: false });
    setDeals((data ?? []) as any);
  };

  const loadAnalysis = async (affId: string) => {
    const { data: items } = await supabase
      .from("commission_closure_items")
      .select("closure_id, qualified_players, active_accounts, new_accounts, cpa_amount, revshare_amount, brand")
      .eq("affiliate_id", affId);
    if (!items?.length) { setAnalysis({ months: [] }); setHistoryByBrandCountry({}); return; }
    const closureIds = Array.from(new Set(items.map((i: any) => i.closure_id)));
    const { data: closures } = await supabase.from("commission_closures").select("id, period").in("id", closureIds);
    const periodMap = new Map<string, string>();
    (closures ?? []).forEach((c: any) => periodMap.set(c.id, c.period));

    const acc = new Map<string, { ftd: number; activeAccounts: number; newAccounts: number; cpaIncome: number; revshareIncome: number }>();
    const brandFtdByPeriod = new Map<string, Map<string, number>>(); // brand -> period -> ftd
    items.forEach((i: any) => {
      const p = periodMap.get(i.closure_id) || "?";
      const cur = acc.get(p) || { ftd: 0, activeAccounts: 0, newAccounts: 0, cpaIncome: 0, revshareIncome: 0 };
      cur.ftd += i.qualified_players || 0;
      cur.activeAccounts += i.active_accounts || 0;
      cur.newAccounts += i.new_accounts || 0;
      cur.cpaIncome += Number(i.cpa_amount) || 0;
      cur.revshareIncome += Number(i.revshare_amount) || 0;
      acc.set(p, cur);
      const b = i.brand || "—";
      const m = brandFtdByPeriod.get(b) || new Map();
      m.set(p, (m.get(p) || 0) + (i.qualified_players || 0));
      brandFtdByPeriod.set(b, m);
    });
    const months = Array.from(acc.entries()).map(([period, v]) => ({ period, ...v }))
      .sort((a, b) => a.period.localeCompare(b.period));
    setAnalysis({ months });

    // promedio mensual FTDs por brand (últimos 6 meses)
    const map: Record<string, number> = {};
    brandFtdByPeriod.forEach((perPeriod, brand) => {
      const vals = Array.from(perPeriod.values()).slice(-6);
      if (vals.length) map[brand.toLowerCase()] = Math.round(vals.reduce((s, x) => s + x, 0) / vals.length);
    });
    setHistoryByBrandCountry(map);
  };

  useEffect(() => {
    if (affiliateId) { loadDeals(affiliateId); loadAnalysis(affiliateId); }
    else { setDeals([]); setAnalysis(null); setHistoryByBrandCountry({}); }
  }, [affiliateId]);

  const updateSel = (uid: string, patch: Partial<SalarySelection>) =>
    setSelections((p) => p.map((s) => (s.uid === uid ? { ...s, ...patch } : s)));
  const removeSel = (uid: string) => setSelections((p) => p.filter((s) => s.uid !== uid));

  const planOf = (s: SalarySelection) => {
    const op = operators.find((o) => o.id === s.opId);
    return { op, plan: op?.client_commission_plans.find((p) => p.id === s.planId) };
  };

  // Expansión WW / LATAM (igual que CalculadoraFijos)
  const wwId = useMemo(
    () => countries.find((c) => c.code === "WW" || c.name.toLowerCase().includes("world"))?.id,
    [countries],
  );
  const latamId = useMemo(
    () => countries.find((c) => c.name.toLowerCase() === "latam")?.id,
    [countries],
  );
  const latamCountryIds = useMemo(
    () => countries.filter((c) => c.id !== wwId && c.id !== latamId && c.name.toLowerCase() !== "españa").map((c) => c.id),
    [countries, wwId, latamId],
  );
  const expandCountryIds = (ids?: string[] | null): string[] => {
    const arr = ids ?? [];
    if (!arr.length) return [];
    if (wwId && arr.includes(wwId)) return countries.map((c) => c.id);
    const set = new Set<string>(arr);
    if (latamId && arr.includes(latamId)) latamCountryIds.forEach((id) => set.add(id));
    return Array.from(set);
  };

  // Países disponibles para una selección: usa los del plan; si está vacío, hereda los del operador
  const availableCountriesFor = (s: SalarySelection): Country[] => {
    const { op, plan } = planOf(s);
    const planExpanded = expandCountryIds(plan?.country_ids);
    const opExpanded = expandCountryIds(op?.country_ids);
    const ids = planExpanded.length ? planExpanded : opExpanded;
    if (!ids.length) return [];
    return countries.filter((c) => ids.includes(c.id));
  };

  // Etiqueta legible para un plan
  const planLabel = (p: PlanLite): string => {
    const brand = p.brand?.trim();
    const desc = p.description?.trim();
    if (brand && desc && brand.toLowerCase() !== desc.toLowerCase()) return `${brand} · ${desc}`;
    return brand || desc || "Plan sin nombre";
  };

  // Etiqueta legible para un operador (diferencia duplicados por marca/login)
  const operatorLabel = (o: OperatorLite): string => {
    const brands = (o.brands ?? []).filter(Boolean);
    if (brands.length) return `${o.company_name} · ${brands.join(", ")}`;
    if (o.login) return `${o.company_name} (${o.login})`;
    return o.company_name;
  };

  const cpaNetoOf = (plan?: PlanLite) =>
    plan ? Math.max(0, (plan.cpa ?? 0) - (plan.overoption_retention ?? 0)) : 0;

  // Sugerir volumen automático cuando se elige plan+país (basado en histórico de marca)
  const suggestVolume = (s: SalarySelection): number => {
    const { plan } = planOf(s);
    if (!plan?.brand) return 0;
    return historyByBrandCountry[plan.brand.toLowerCase()] || 0;
  };

  const applySuggestion = (uid: string) => {
    setSelections((p) => p.map((s) => {
      if (s.uid !== uid) return s;
      const v = suggestVolume(s);
      return v > 0 ? { ...s, targetFtd: v, autoSuggested: true } : s;
    }));
  };

  // === FORWARD: dado mix → propone salario + bonus ===
  const forward = useMemo(() => {
    let totalExpectedNet = 0;
    let totalCpaGross = 0;
    let totalFtd = 0;
    const perRow = selections.map((s) => {
      const { plan } = planOf(s);
      const cpaNeto = cpaNetoOf(plan);
      const ftd = Number(s.targetFtd) || 0;
      const incomeNet = cpaNeto * ftd;
      const bonusPerExtra = cpaNeto * (bonusPct / 100);
      const cpaGross = bonusPerExtra * ftd;
      totalExpectedNet += incomeNet;
      totalCpaGross += cpaGross;
      totalFtd += ftd;
      return { s, plan, cpaNeto, ftd, incomeNet, cpaGross, bonusPerExtraFtd: bonusPerExtra };
    });
    const proposedSalary = totalExpectedNet * (safetyPct / 100);
    // Escenarios de riesgo
    const scenarios = [100, 90, 80, 70, 60].map((pct) => {
      const inc = totalExpectedNet * (pct / 100);
      const margin = inc - proposedSalary;
      return { pct, income: inc, margin, ok: margin >= 0 };
    });
    const distinctBrands = new Set(perRow.filter(r => r.plan?.brand).map(r => r.plan!.brand!.toLowerCase())).size;
    const distinctCountries = new Set(selections.filter(s => s.countryId).map(s => s.countryId)).size;
    return { perRow, totalExpectedNet, totalCpaGross, totalFtd, proposedSalary, scenarios, distinctBrands, distinctCountries };
  }, [selections, operators, safetyPct, bonusPct]);

  // === INVERSE: dado salario → propone CPAs/mes y meses para recuperar ===
  const inverse = useMemo(() => {
    const sal = parseFloat(inverseSalary) || 0;
    const trial = parseInt(trialMonths) || 0;
    if (!sal) return null;
    const rowsWithCpa = selections.map((s) => {
      const { plan } = planOf(s);
      const cpaNeto = cpaNetoOf(plan);
      const weight = Number(s.targetFtd) || 1; // si no hay objetivo, peso 1
      return { s, plan, cpaNeto, weight };
    }).filter(r => r.cpaNeto > 0);
    if (!rowsWithCpa.length) return null;
    const totalW = rowsWithCpa.reduce((a, r) => a + r.weight, 0);
    const weightedCpa = rowsWithCpa.reduce((a, r) => a + r.cpaNeto * (r.weight / totalW), 0);
    if (weightedCpa <= 0) return null;
    // Para cubrir salario con margen de seguridad: salario debe ser safetyPct% del ingreso neto mensual
    // ⇒ ingreso neto mensual requerido = salario / (safetyPct/100)
    const requiredMonthlyNet = sal / (safetyPct / 100);
    const totalFtdNeeded = Math.ceil(requiredMonthlyNet / weightedCpa);
    const distribution = rowsWithCpa.map((r) => ({
      ...r,
      ftdMonthly: Math.ceil(totalFtdNeeded * (r.weight / totalW)),
    }));
    const totalCpaGross = distribution.reduce((a, r) => a + r.cpaNeto * (bonusPct / 100) * r.ftdMonthly, 0);
    // Meses para recuperar lo invertido durante el periodo de prueba (salario × trial)
    const monthlySurplus = requiredMonthlyNet - sal; // = sal × (1 - safety)/safety
    const totalInvested = sal * Math.max(trial, 0);
    const monthsToRecoup = monthlySurplus > 0 && totalInvested > 0
      ? Math.ceil(totalInvested / monthlySurplus)
      : 0;
    return { weightedCpa, requiredMonthlyNet, totalFtdNeeded, totalCpaGross, distribution, monthsToRecoup, totalInvested, monthlySurplus };
  }, [inverseSalary, selections, operators, safetyPct, trialMonths, bonusPct]);

  // === Producción objetivo (mensual / diaria) para los triggers ===
  const targetMonthlyFtd = mode === "inverse" ? (inverse?.totalFtdNeeded ?? 0) : forward.totalFtd;
  const targetDailyFtd = targetMonthlyFtd / 30;
  const expectedMonthlyNet = mode === "inverse" ? (inverse?.requiredMonthlyNet ?? 0) : forward.totalExpectedNet;
  const proposedSalaryAmt = mode === "inverse" ? (parseFloat(inverseSalary) || 0) : forward.proposedSalary;
  const expectedMonthlyMargin = Math.max(0, expectedMonthlyNet - proposedSalaryAmt);

  // Auto-rellenar triggers a partir de la meta mensual (si el usuario no los tocó manualmente)
  useEffect(() => {
    if (targetMonthlyFtd <= 0) return;
    const minFtdSugg = Math.max(1, Math.round(targetMonthlyFtd * 0.8));
    const netMarginSugg = Math.round(expectedMonthlyMargin * 0.5);
    setTrgMinFtd((prev) => (trgTouched.minFtd ? prev : String(minFtdSugg)));
    setTrgBreakevenPct((prev) => (trgTouched.breakevenPct ? prev : "80"));
    setTrgActivityRatio((prev) => (trgTouched.activity ? prev : "50"));
    setTrgNetMargin((prev) => (trgTouched.netMargin ? prev : String(netMarginSugg)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetMonthlyFtd, expectedMonthlyMargin]);


  const handleSave = async () => {
    if (!user) return toast.error("Inicia sesión");
    if (!affiliateId) return toast.error("Selecciona un afiliado");
    if (!name.trim()) return toast.error("Nombra el deal");
    const finalSalary = mode === "inverse" ? (parseFloat(inverseSalary) || 0) : forward.proposedSalary;
    if (!finalSalary) return toast.error("No hay salario calculado");
    setSaving(true);
    const { error } = await supabase.from("affiliate_salary_deals").insert({
      affiliate_id: affiliateId,
      name: name.trim(),
      salary_amount: Math.round(finalSalary),
      salary_currency: salaryCurrency,
      cpa_bonus_amount: bonusPct, // guardamos el % aplicado
      cpa_bonus_threshold: forward.totalFtd,
      selections: selections as any,
      breakeven_ftd_monthly: mode === "inverse" ? (inverse?.totalFtdNeeded ?? 0) : forward.totalFtd,
      trigger_min_ftd_monthly: trgMinFtd ? parseInt(trgMinFtd) : null,
      trigger_breakeven_pct: trgBreakevenPct ? parseFloat(trgBreakevenPct) : null,
      trigger_min_activity_ratio: trgActivityRatio ? parseFloat(trgActivityRatio) : null,
      trigger_min_conversion_pct: trgConversionPct ? parseFloat(trgConversionPct) : null,
      trigger_min_net_margin: trgNetMargin !== "" ? parseFloat(trgNetMargin) : null,
      trial_months: parseInt(trialMonths) || 0,
      notes: [
        notes,
        `Margen seguridad: ${safetyPct}% | Bonus por CPA extra: ${bonusPct}% del CPA neto`,
        mode === "inverse" && inverse ? `Inverso: ${inverse.totalFtdNeeded} CPAs/mes · recuperación en ${inverse.monthsToRecoup}m` : "",
      ].filter(Boolean).join(" | "),
      created_by: user.id,
    } as any);
    setSaving(false);
    if (error) return toast.error("No se pudo guardar el deal");
    toast.success("Deal fijo guardado");
    loadDeals(affiliateId);
  };

  const evaluateDeal = (d: Deal) => {
    if (!analysis) return null;
    const lastMonths = analysis.months.slice(-6);
    const n = lastMonths.length;
    const sum = lastMonths.reduce(
      (s, m) => ({
        ftd: s.ftd + m.ftd, activeAccounts: s.activeAccounts + m.activeAccounts,
        newAccounts: s.newAccounts + m.newAccounts,
        cpaIncome: s.cpaIncome + m.cpaIncome, revshareIncome: s.revshareIncome + m.revshareIncome,
      }), { ftd: 0, activeAccounts: 0, newAccounts: 0, cpaIncome: 0, revshareIncome: 0 }
    );
    const avgFtd = n ? sum.ftd / n : 0;
    const avgIncome = n ? (sum.cpaIncome + sum.revshareIncome) / n : 0;
    const avgNetMargin = avgIncome - (d.salary_amount || 0);
    const activityRatio = sum.ftd > 0 ? (sum.activeAccounts / sum.ftd) * 100 : 0;
    const conversionPct = sum.newAccounts > 0 ? (sum.ftd / sum.newAccounts) * 100 : 0;
    const beFtd = d.breakeven_ftd_monthly || 0;
    const pctBe = beFtd > 0 ? (avgFtd / beFtd) * 100 : 0;
    const alerts: { level: "ok" | "warn" | "danger"; label: string }[] = [];
    if (d.trigger_min_ftd_monthly != null)
      alerts.push({ level: avgFtd >= d.trigger_min_ftd_monthly ? "ok" : "danger", label: `CPA mín: ${avgFtd.toFixed(0)} / ${d.trigger_min_ftd_monthly}` });
    if (d.trigger_breakeven_pct != null && beFtd > 0)
      alerts.push({ level: pctBe >= d.trigger_breakeven_pct ? "ok" : pctBe >= d.trigger_breakeven_pct * 0.8 ? "warn" : "danger", label: `Breakeven: ${pctBe.toFixed(0)}% / ${d.trigger_breakeven_pct}%` });
    if (d.trigger_min_activity_ratio != null)
      alerts.push({ level: activityRatio >= d.trigger_min_activity_ratio ? "ok" : activityRatio >= d.trigger_min_activity_ratio * 0.8 ? "warn" : "danger", label: `Actividad: ${activityRatio.toFixed(0)}% / ${d.trigger_min_activity_ratio}%` });
    if (d.trigger_min_conversion_pct != null)
      alerts.push({ level: conversionPct >= d.trigger_min_conversion_pct ? "ok" : "warn", label: `Conversión: ${conversionPct.toFixed(1)}% / ${d.trigger_min_conversion_pct}%` });
    if (d.trigger_min_net_margin != null)
      alerts.push({ level: avgNetMargin >= d.trigger_min_net_margin ? "ok" : avgNetMargin >= 0 ? "warn" : "danger", label: `Margen/mes: ${fmt(avgNetMargin, d.salary_currency)} / ${fmt(d.trigger_min_net_margin, d.salary_currency)}` });
    return { avgFtd, avgIncome, avgNetMargin, activityRatio, conversionPct, pctBreakeven: pctBe, alerts, monthsAnalyzed: n };
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5" /> Oferta fijo + CPA · Calculadora inteligente
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Combina varias marcas y mercados para minimizar el riesgo. La calculadora propone el salario óptimo
            y el bonus por CPA según el margen de seguridad que elijas.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Datos del deal */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Afiliado</Label>
              <Select value={affiliateId} onValueChange={setAffiliateId}>
                <SelectTrigger><SelectValue placeholder="Selecciona afiliado" /></SelectTrigger>
                <SelectContent>
                  {affiliates.map((a) => <SelectItem key={a.id} value={a.id}>{a.fixed_name} · {a.unique_id}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Nombre del deal</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Fijo Q1 2026" />
            </div>
            <div className="space-y-1">
              <Label>Moneda</Label>
              <Select value={salaryCurrency} onValueChange={setSalaryCurrency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Sliders */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 rounded-lg border bg-muted/30 p-3">
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs flex items-center gap-1"><ShieldAlert className="h-3 w-3" /> Margen de seguridad</Label>
                <Badge variant="secondary">{safetyPct}%</Badge>
              </div>
              <Slider value={[safetyPct]} onValueChange={(v) => setSafetyPct(v[0])} min={40} max={95} step={5} />
              <p className="text-[10px] text-muted-foreground mt-1">
                % del CPA neto esperado que pagamos como salario. Más bajo = más seguro para Overoption.
              </p>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs flex items-center gap-1"><Sparkles className="h-3 w-3" /> Bonus por CPA extra</Label>
                <Badge variant="secondary">{bonusPct}%</Badge>
              </div>
              <Slider value={[bonusPct]} onValueChange={(v) => setBonusPct(v[0])} min={30} max={95} step={5} />
              <p className="text-[10px] text-muted-foreground mt-1">
                % del CPA neto del operador que recibe el afiliado por cada CPA por encima del objetivo.
              </p>
            </div>
          </div>

          {/* Resumen propuesta para el afiliado (visible en ambos modos) */}
          {(() => {
            const sal = mode === "inverse" ? (parseFloat(inverseSalary) || 0) : forward.proposedSalary;
            const cpas = mode === "inverse" ? (inverse?.totalFtdNeeded ?? 0) : forward.totalFtd;
            const cpaGross = mode === "inverse" ? (inverse?.totalCpaGross ?? 0) : forward.totalCpaGross;
            return (
              <div className="rounded-xl border-2 border-primary bg-gradient-to-br from-primary/10 to-primary/5 p-5 shadow-sm">
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-3 font-semibold">
                  Propuesta total para el afiliado / mes
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-lg bg-background/60 p-3 border">
                    <div className="text-[10px] uppercase text-muted-foreground">Salario fijo</div>
                    <div className="font-bold text-2xl text-primary">{fmt(sal, salaryCurrency)}</div>
                  </div>
                  <div className="rounded-lg bg-background/60 p-3 border">
                    <div className="text-[10px] uppercase text-muted-foreground">Comisiones CPA ({cpas} CPAs)</div>
                    <div className="font-bold text-2xl text-emerald-600">{fmt(cpaGross, salaryCurrency)}</div>
                  </div>
                  <div className="rounded-lg bg-primary/15 p-3 border-2 border-primary/40">
                    <div className="text-[10px] uppercase text-muted-foreground font-semibold">Total ingreso afiliado</div>
                    <div className="font-bold text-2xl text-primary">{fmt(sal + cpaGross, salaryCurrency)}</div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Mix de operadores / marcas / países */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2"><Target className="h-4 w-4" /> Mix de marcas y mercados</Label>
              <Button variant="outline" size="sm" onClick={() => setSelections((p) => [...p, newSel()])}>
                <Plus className="h-3 w-3 mr-1" /> Añadir línea
              </Button>
            </div>
            <div className="rounded-lg border overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/50">
                  <tr className="text-left">
                    <th className="p-2">Operador</th>
                    <th className="p-2">Marca / Plan</th>
                    <th className="p-2">País</th>
                    <th className="p-2 text-right">CPA neto</th>
                    <th className="p-2 text-right w-32">CPAs/mes objetivo</th>
                    <th className="p-2 text-right">Ingreso neto</th>
                    <th className="p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {selections.map((s) => {
                    const { op, plan } = planOf(s);
                    const cpaNeto = cpaNetoOf(plan);
                    const planCountries = availableCountriesFor(s);
                    const suggested = suggestVolume(s);
                    const income = cpaNeto * (Number(s.targetFtd) || 0);
                    return (
                      <tr key={s.uid} className="border-t">
                        <td className="p-2 min-w-[180px]">
                          <Select value={s.opId} onValueChange={(v) => updateSel(s.uid, { opId: v, planId: "", countryId: "" })}>
                            <SelectTrigger className="h-8"><SelectValue placeholder="Operador" /></SelectTrigger>
                            <SelectContent>
                              {operators.map((o) => (
                                <SelectItem key={o.id} value={o.id}>
                                  <span className="font-medium">{o.company_name}</span>
                                  {(o.brands?.length || o.login) && (
                                    <span className="ml-2 text-xs text-muted-foreground">
                                      · {o.brands?.length ? o.brands.join(", ") : o.login}
                                    </span>
                                  )}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-2 min-w-[200px]">
                          <Select value={s.planId} onValueChange={(v) => updateSel(s.uid, { planId: v, countryId: "" })} disabled={!op}>
                            <SelectTrigger className="h-8"><SelectValue placeholder="Plan" /></SelectTrigger>
                            <SelectContent>
                              {(op?.client_commission_plans ?? []).map((p) => {
                                const ids = expandCountryIds(p.country_ids?.length ? p.country_ids : op?.country_ids);
                                const cNames = countries.filter(c => ids.includes(c.id)).map(c => c.code || c.name).slice(0, 4).join(", ");
                                return (
                                  <SelectItem key={p.id} value={p.id}>
                                    <span className="font-medium">{planLabel(p)}</span>
                                    <span className="ml-2 text-xs text-muted-foreground">
                                      · CPA {p.cpa ?? "—"}{p.currency ? ` ${p.currency}` : ""}{cNames ? ` · ${cNames}` : ""}
                                    </span>
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-2 min-w-[140px]">
                          <Select value={s.countryId} onValueChange={(v) => updateSel(s.uid, { countryId: v })} disabled={!plan}>
                            <SelectTrigger className="h-8">
                              <SelectValue placeholder={plan && planCountries.length === 0 ? "Sin países" : "País"} />
                            </SelectTrigger>
                            <SelectContent>
                              {planCountries.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-2 text-right font-mono">{fmt(cpaNeto, plan?.currency || salaryCurrency)}</td>
                        <td className="p-2">
                          <div className="flex items-center gap-1">
                            <Input
                              type="number" min={0}
                              className="h-8 text-right"
                              value={s.targetFtd || ""}
                              onChange={(e) => updateSel(s.uid, { targetFtd: parseInt(e.target.value) || 0, autoSuggested: false })}
                            />
                            {suggested > 0 && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"
                                title={`Sugerido por histórico: ${suggested}/mes`}
                                onClick={() => applySuggestion(s.uid)}>
                                <Wand2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                          {suggested > 0 && (
                            <div className="text-[10px] text-muted-foreground text-right">hist: {suggested}/m</div>
                          )}
                        </td>
                        <td className="p-2 text-right font-mono">{fmt(income, plan?.currency || salaryCurrency)}</td>
                        <td className="p-2">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeSel(s.uid)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant={forward.distinctBrands >= 2 ? "default" : "secondary"}>
                {forward.distinctBrands} marca{forward.distinctBrands !== 1 ? "s" : ""}
              </Badge>
              <Badge variant={forward.distinctCountries >= 2 ? "default" : "secondary"}>
                {forward.distinctCountries} mercado{forward.distinctCountries !== 1 ? "s" : ""}
              </Badge>
              {forward.distinctBrands < 2 && (
                <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />Diversifica con +1 marca</Badge>
              )}
            </div>
          </div>

          {/* Modo */}
          <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
            <TabsList className="grid grid-cols-2">
              <TabsTrigger value="forward"><Calculator className="h-3 w-3 mr-1" /> Calcular salario propuesto</TabsTrigger>
              <TabsTrigger value="inverse"><Clock className="h-3 w-3 mr-1" /> Modo inverso (defino salario)</TabsTrigger>
            </TabsList>

            {/* FORWARD */}
            <TabsContent value="forward" className="space-y-3 pt-3">
              <div className="rounded-lg border-2 border-primary/40 bg-primary/5 p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <div className="text-[10px] uppercase text-muted-foreground">Ingreso neto esperado/mes</div>
                  <div className="font-bold text-lg">{fmt(forward.totalExpectedNet, salaryCurrency)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-muted-foreground">CPAs objetivo total/mes</div>
                  <div className="font-bold text-lg">{forward.totalFtd}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-muted-foreground">Salario propuesto</div>
                  <div className="font-bold text-xl text-primary">{fmt(forward.proposedSalary, salaryCurrency)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase text-muted-foreground">Margen Overoption esperado</div>
                  <div className="font-bold text-lg">{fmt(forward.totalExpectedNet - forward.proposedSalary, salaryCurrency)}</div>
                </div>
              </div>

              {/* Escenarios de riesgo */}
              <div>
                <Label className="text-xs">Análisis de riesgo (entrega real vs objetivo)</Label>
                <div className="grid grid-cols-5 gap-2 mt-1">
                  {forward.scenarios.map((sc) => (
                    <div key={sc.pct} className={`rounded border p-2 text-center text-xs ${
                      sc.ok ? "bg-emerald-500/10 border-emerald-500/30" : "bg-destructive/10 border-destructive/30"
                    }`}>
                      <div className="text-[10px] uppercase text-muted-foreground">{sc.pct}% entrega</div>
                      <div className={`font-bold ${sc.ok ? "" : "text-destructive"}`}>{fmt(sc.margin, salaryCurrency)}</div>
                      <div className="text-[10px]">{sc.ok ? "ganancia" : "pérdida"}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bonus por operador */}
              {forward.perRow.some(r => r.plan) && (
                <div className="rounded-lg border p-3 space-y-1">
                  <Label className="text-xs flex items-center gap-1"><Sparkles className="h-3 w-3" /> Bonus por CPA por encima del objetivo</Label>
                  <div className="space-y-1">
                    {forward.perRow.filter(r => r.plan).map((r) => (
                      <div key={r.s.uid} className="flex justify-between text-xs">
                        <span>{r.plan!.brand || r.plan!.description} ({r.ftd} CPAs objetivo)</span>
                        <span className="font-mono font-semibold">{fmt(r.bonusPerExtraFtd, r.plan!.currency || salaryCurrency)}/CPA extra</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* INVERSE */}
            <TabsContent value="inverse" className="space-y-3 pt-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Salario fijo deseado / mes</Label>
                  <Input type="number" min="0" value={inverseSalary} onChange={(e) => setInverseSalary(e.target.value)}
                    placeholder="Ej. 5000" />
                </div>
                <div className="space-y-1">
                  <Label>Meses de prueba (inversión a recuperar)</Label>
                  <Input type="number" min="0" value={trialMonths} onChange={(e) => setTrialMonths(e.target.value)} />
                </div>
              </div>

              {!inverse && (
                <p className="text-xs text-muted-foreground">
                  Define el salario y al menos un operador/plan en el mix para ver la propuesta.
                </p>
              )}

              {inverse && (
                <>
                  <div className="rounded-lg border-2 border-primary/40 bg-primary/5 p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <div className="text-[10px] uppercase text-muted-foreground">CPA neto medio ponderado</div>
                      <div className="font-bold text-lg">{fmt(inverse.weightedCpa, salaryCurrency)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-muted-foreground">Ingreso neto requerido/mes</div>
                      <div className="font-bold text-lg">{fmt(inverse.requiredMonthlyNet, salaryCurrency)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-muted-foreground">CPAs totales / mes</div>
                      <div className="font-bold text-xl text-primary">{inverse.totalFtdNeeded}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-muted-foreground">Recuperación inversión</div>
                      <div className="font-bold text-lg">{inverse.monthsToRecoup} mes{inverse.monthsToRecoup !== 1 ? "es" : ""}</div>
                      <div className="text-[10px] text-muted-foreground">tras período de prueba</div>
                    </div>
                  </div>

                  <div className="rounded-lg border p-3">
                    <Label className="text-xs">Distribución sugerida por marca/mercado</Label>
                    <div className="mt-2 space-y-1">
                      {inverse.distribution.map((r) => {
                        const country = countries.find(c => c.id === r.s.countryId);
                        return (
                          <div key={r.s.uid} className="flex justify-between text-xs items-center">
                            <span>
                              {r.plan?.brand || r.plan?.description}
                              {country ? ` · ${country.name}` : ""}
                              <span className="text-muted-foreground ml-1">(CPA neto {fmt(r.cpaNeto, r.plan?.currency || salaryCurrency)})</span>
                            </span>
                            <Badge variant="secondary" className="font-mono">{r.ftdMonthly} CPAs/mes</Badge>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-lg border bg-muted/30 p-3 text-xs space-y-1">
                    <div className="flex justify-between"><span>Inversión total durante prueba ({trialMonths || 0}m):</span>
                      <span className="font-mono font-semibold">{fmt(inverse.totalInvested, salaryCurrency)}</span></div>
                    <div className="flex justify-between"><span>Margen mensual una vez en régimen:</span>
                      <span className="font-mono font-semibold text-emerald-600">{fmt(inverse.monthlySurplus, salaryCurrency)}</span></div>
                    <div className="flex justify-between border-t pt-1 mt-1"><span>Tiempo total online para recuperar 100%:</span>
                      <span className="font-mono font-bold">{(parseInt(trialMonths) || 0) + inverse.monthsToRecoup} meses</span></div>
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>

          {/* Triggers de seguridad */}
          <div className="space-y-2 border-t pt-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-amber-600" />
                <span className="font-semibold text-sm">Triggers de seguridad post-firma</span>
              </div>
              {targetMonthlyFtd > 0 && (
                <div className="text-[11px] text-muted-foreground">
                  Meta: <span className="font-semibold text-foreground">{targetMonthlyFtd} CPAs/mes</span> · ≈ <span className="font-semibold text-foreground">{targetDailyFtd.toFixed(1)} CPAs/día</span> · semanal ≈ <span className="font-semibold text-foreground">{(targetDailyFtd * 7).toFixed(0)}</span>
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">CPAs mínimos / mes</Label>
                <Input type="number" min="0" value={trgMinFtd}
                  onChange={(e) => { setTrgMinFtd(e.target.value); setTrgTouched((t) => ({ ...t, minFtd: true })); }}
                  placeholder={targetMonthlyFtd ? `Sugerido: ${Math.round(targetMonthlyFtd * 0.8)}` : ""} />
                {trgMinFtd && (
                  <p className="text-[10px] text-muted-foreground">≈ {(parseFloat(trgMinFtd) / 30).toFixed(1)} CPAs/día · {(parseFloat(trgMinFtd) / 4.33).toFixed(1)}/semana</p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">% mín. vs breakeven</Label>
                <Input type="number" min="0" max="200" value={trgBreakevenPct}
                  onChange={(e) => { setTrgBreakevenPct(e.target.value); setTrgTouched((t) => ({ ...t, breakevenPct: true })); }} />
                {trgBreakevenPct && targetMonthlyFtd > 0 && (
                  <p className="text-[10px] text-muted-foreground">≈ {Math.round(targetMonthlyFtd * (parseFloat(trgBreakevenPct) / 100))} CPAs/mes mín.</p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Ratio actividad mín. (% activos / CPA)</Label>
                <Input type="number" min="0" max="200" value={trgActivityRatio}
                  onChange={(e) => { setTrgActivityRatio(e.target.value); setTrgTouched((t) => ({ ...t, activity: true })); }} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Conversión mín. (% CPA / cuentas)</Label>
                <Input type="number" min="0" max="100" value={trgConversionPct}
                  onChange={(e) => { setTrgConversionPct(e.target.value); setTrgTouched((t) => ({ ...t, conversion: true })); }}
                  placeholder="opcional" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Margen neto mín. / mes</Label>
                <Input type="number" value={trgNetMargin}
                  onChange={(e) => { setTrgNetMargin(e.target.value); setTrgTouched((t) => ({ ...t, netMargin: true })); }} />
                {expectedMonthlyMargin > 0 && (
                  <p className="text-[10px] text-muted-foreground">Margen esperado: {Math.round(expectedMonthlyMargin)} / mes</p>
                )}
              </div>
            </div>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas / cláusulas extra" />
          </div>

          <Button onClick={handleSave} disabled={saving || !affiliateId} className="w-full">
            <Save className="h-4 w-4 mr-2" /> {saving ? "Guardando..." : "Atribuir deal al afiliado"}
          </Button>
        </CardContent>
      </Card>

      {affiliateId && deals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5" /> Análisis de salud de los deals
            </CardTitle>
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
                        {fmt(d.salary_amount, d.salary_currency)} / mes · breakeven {d.breakeven_ftd_monthly} CPAs
                        {d.trial_months ? ` · prueba ${d.trial_months}m` : ""}
                      </div>
                    </div>
                    <Badge variant={overall === "ok" ? "default" : overall === "warn" ? "secondary" : "destructive"}>
                      {overall === "ok" ? <ShieldCheck className="h-3 w-3 mr-1" /> : <AlertTriangle className="h-3 w-3 mr-1" />}
                      {overall === "ok" ? "Saludable" : overall === "warn" ? "Atención" : "Riesgo"}
                    </Badge>
                  </div>
                  {ev && ev.monthsAnalyzed === 0 && (
                    <p className="text-xs text-muted-foreground">Sin cierres de comisión todavía.</p>
                  )}
                  {ev && ev.monthsAnalyzed > 0 && (
                    <>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-center text-sm">
                        <div className="rounded border p-2 bg-muted/40"><div className="text-[10px] uppercase text-muted-foreground">CPA/mes</div><div className="font-bold">{ev.avgFtd.toFixed(0)}</div></div>
                        <div className="rounded border p-2 bg-muted/40"><div className="text-[10px] uppercase text-muted-foreground">% breakeven</div><div className="font-bold">{ev.pctBreakeven.toFixed(0)}%</div></div>
                        <div className="rounded border p-2 bg-muted/40"><div className="text-[10px] uppercase text-muted-foreground">Actividad</div><div className="font-bold">{ev.activityRatio.toFixed(0)}%</div></div>
                        <div className="rounded border p-2 bg-muted/40"><div className="text-[10px] uppercase text-muted-foreground">Conversión</div><div className="font-bold">{ev.conversionPct.toFixed(1)}%</div></div>
                        <div className="rounded border p-2 bg-muted/40"><div className="text-[10px] uppercase text-muted-foreground">Margen/mes</div><div className={`font-bold ${ev.avgNetMargin < 0 ? "text-destructive" : ""}`}>{fmt(ev.avgNetMargin, d.salary_currency)}</div></div>
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
