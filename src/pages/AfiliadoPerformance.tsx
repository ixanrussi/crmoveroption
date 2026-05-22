import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Loader2, Target, Trophy, TrendingUp, Wallet, Building2, Filter } from "lucide-react";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  BarChart, Cell,
} from "recharts";
import { useFxRates, convert } from "@/lib/fxRates";

type Period = "thisMonth" | "lastMonth" | "quarter" | "ytd" | "last30";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const fmtInt = (n: number) => Math.round(n || 0).toLocaleString("es-ES");
const fmtEur = (n: number) => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n || 0);
const fmtPct = (n: number) => `${(n || 0).toLocaleString("es-ES", { maximumFractionDigits: 1 })}%`;
const normalize = (s: string) => (s ?? "").toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

function rangeFor(p: Period): { from: string; to: string; prevFrom: string; prevTo: string } {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const y = t.getFullYear(), m = t.getMonth();
  let from: Date, to: Date;
  if (p === "thisMonth") { from = new Date(y, m, 1); to = t; }
  else if (p === "lastMonth") { from = new Date(y, m - 1, 1); to = new Date(y, m, 0); }
  else if (p === "quarter") { const qStart = Math.floor(m / 3) * 3; from = new Date(y, qStart, 1); to = t; }
  else if (p === "ytd") { from = new Date(y, 0, 1); to = t; }
  else { from = new Date(t); from.setDate(from.getDate() - 30); to = t; }
  const span = to.getTime() - from.getTime();
  const prevTo = new Date(from.getTime() - 86400000);
  const prevFrom = new Date(prevTo.getTime() - span);
  return { from: iso(from), to: iso(to), prevFrom: iso(prevFrom), prevTo: iso(prevTo) };
}

function periodToYM(period: string): string | null {
  const m = period?.match?.(/(\d{4})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}` : null;
}
function ymInRange(ym: string | null, fromISO: string, toISO: string) {
  if (!ym) return true;
  const fromYm = fromISO.slice(0, 7);
  const toYm = toISO.slice(0, 7);
  return ym >= fromYm && ym <= toYm;
}

export default function AfiliadoPerformance() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [period, setPeriod] = useState<Period>("thisMonth");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [aff, setAff] = useState<any>(null);
  const [country, setCountry] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [closures, setClosures] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [clientsList, setClientsList] = useState<any[]>([]);
  const [operatorIds, setOperatorIds] = useState<any[]>([]);
  const [routyRows, setRoutyRows] = useState<any[]>([]);
  const [prevQualified, setPrevQualified] = useState<number>(0);
  const [grossMarginAll, setGrossMarginAll] = useState<number>(0);

  const range = useMemo(() => rangeFor(period), [period]);

  const currencies = useMemo(() => {
    const set = new Set<string>(["EUR"]);
    items.forEach((it) => it.currency && set.add(String(it.currency).toUpperCase()));
    closures.forEach((c) => c.currency && set.add(String(c.currency).toUpperCase()));
    plans.forEach((p) => p.cpa_currency && set.add(String(p.cpa_currency).toUpperCase()));
    return Array.from(set);
  }, [items, closures, plans]);
  const fxByBase = useFxRates(currencies);

  useEffect(() => {
    if (!id) return;
    let cancel = false;
    (async () => {
      setLoading(true); setError(null);
      try {
        const [a, p, g, oi, cl] = await Promise.all([
          supabase.from("affiliates").select("*, country:countries(id, name, code)").eq("id", id).maybeSingle(),
          supabase.from("affiliate_commission_plans").select("*").eq("affiliate_id", id),
          supabase.from("affiliate_goals").select("*").eq("affiliate_id", id),
          supabase.from("affiliate_operator_ids").select("*").eq("affiliate_id", id),
          supabase.from("clients").select("id, company_name, logo_url, routy_account_id"),
        ]);
        if (cancel) return;
        if (a.error) throw a.error;
        setAff(a.data);
        setCountry(a.data?.country ?? null);
        setPlans(p.data ?? []);
        setGoals(g.data ?? []);
        setOperatorIds(oi.data ?? []);
        setClientsList(cl.data ?? []);
      } catch (e: any) { setError(e.message || "Error al cargar afiliado"); }
      finally { if (!cancel) setLoading(false); }
    })();
    return () => { cancel = true; };
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let cancel = false;
    (async () => {
      try {
        const [{ data: it }, { data: cs }] = await Promise.all([
          supabase.from("commission_closure_items").select("*").eq("affiliate_id", id),
          supabase.from("commission_closures").select("id, client_id, period, report_type, status, currency, total_commission"),
        ]);
        if (cancel) return;
        setItems(it ?? []);
        setClosures(cs ?? []);
      } catch (e: any) { setError(e.message); }
    })();
    return () => { cancel = true; };
  }, [id]);

  useEffect(() => {
    if (!aff || clientsList.length === 0) return;
    let cancel = false;
    (async () => {
      const ops = clientsList.filter((c) => !!c.routy_account_id);
      const targets = aff?.unique_id ? new Set<string>([normalize(aff.unique_id)]) : new Set<string>();
      (aff?.aliases ?? []).forEach((a: string) => a && targets.add(normalize(a)));
      operatorIds.forEach((o) => o.operator_campaign_id && targets.add(normalize(o.operator_campaign_id)));
      if (aff?.fixed_name) targets.add(normalize(aff.fixed_name));

      const fetchOp = async (op: any) => {
        const { data, error } = await supabase.functions.invoke<any>("routy-proxy", {
          body: { from: `${range.from}T00:00:00`, to: `${range.to}T23:59:59`, accountId: op.routy_account_id },
        });
        if (error || !data?.data) return [];
        return (data.data as any[])
          .filter((r) => targets.has(normalize(r.tracker || "")))
          .map((r) => ({ ...r, client_id: op.id, client_name: op.company_name }));
      };
      try {
        const all = await Promise.all(ops.map(fetchOp));
        if (cancel) return;
        setRoutyRows(all.flat());
      } catch { /* ignore */ }
    })();
    return () => { cancel = true; };
  }, [aff, clientsList, operatorIds, range.from, range.to]);

  const periodItems = useMemo(() => {
    const closureMap = new Map(closures.map((c) => [c.id, c]));
    return items
      .map((it) => ({ it, cls: closureMap.get(it.closure_id) }))
      .filter(({ cls }) => cls && ymInRange(periodToYM(cls.period), range.from, range.to))
      .map(({ it, cls }) => ({ ...it, _cls: cls }));
  }, [items, closures, range.from, range.to]);

  const prevPeriodItems = useMemo(() => {
    const closureMap = new Map(closures.map((c) => [c.id, c]));
    return items
      .map((it) => ({ it, cls: closureMap.get(it.closure_id) }))
      .filter(({ cls }) => cls && ymInRange(periodToYM(cls.period), range.prevFrom, range.prevTo))
      .map(({ it, cls }) => ({ ...it, _cls: cls }));
  }, [items, closures, range.prevFrom, range.prevTo]);

  useEffect(() => {
    setPrevQualified(prevPeriodItems.reduce((s, it) => s + (Number(it.qualified_players) || 0), 0));
  }, [prevPeriodItems]);

  useEffect(() => {
    const filtered = closures.filter((c) => ymInRange(periodToYM(c.period), range.from, range.to));
    let total = 0;
    for (const c of filtered) {
      const cur = (c.currency || "EUR").toUpperCase();
      const rates = fxByBase[cur];
      const v = convert(Number(c.total_commission) || 0, cur, "EUR", rates);
      if (v != null) total += v;
    }
    setGrossMarginAll(total);
  }, [closures, fxByBase, range.from, range.to]);

  const toEur = (n: number, cur?: string | null) => {
    const c = (cur || "EUR").toUpperCase();
    const v = convert(Number(n) || 0, c, "EUR", fxByBase[c]);
    return v ?? 0;
  };

  const findPlan = (clientId: string, brand: string | null) => {
    const brandLower = (brand || "").toLowerCase();
    const eligible = plans
      .filter((p) => !p.client_id || p.client_id === clientId)
      .filter((p) => !p.brand || brandLower.includes(p.brand.toLowerCase()) || p.brand.toLowerCase().includes(brandLower))
      .sort((a, b) => (b.plan_start_date || "").localeCompare(a.plan_start_date || ""));
    return eligible[0] || null;
  };

  const rows = useMemo(() => {
    const clientMap = new Map(clientsList.map((c) => [c.id, c.company_name]));
    return periodItems.map((it) => {
      const cls = it._cls;
      const plan = findPlan(cls.client_id, it.brand);
      const qualified = Number(it.qualified_players) || 0;
      const ngr = (Number(it.casino_ngr) || 0) + (Number(it.sports_ngr) || 0);
      const commissionCharged = Number(it.commission_total) || 0;
      const cpaPart = plan?.cpa != null ? Number(plan.cpa) * qualified : 0;
      const rsPart = plan?.rev_share_pct != null ? ngr * (Number(plan.rev_share_pct) / 100) : 0;
      const affPayCur = plan?.cpa_currency || plan?.currency || it.currency || cls.currency || "EUR";
      const affPay = cpaPart + rsPart;
      return {
        id: it.id,
        period: cls.period,
        client_id: cls.client_id,
        client: clientMap.get(cls.client_id) || "—",
        brand: it.brand || "—",
        qualified,
        ngr,
        ngrEur: toEur(ngr, it.currency || cls.currency),
        commission_charged: commissionCharged,
        commission_charged_eur: toEur(commissionCharged, it.currency || cls.currency),
        currency: it.currency || cls.currency || "EUR",
        cpa_rate: plan?.cpa ?? null,
        cpa_rate_cur: plan?.cpa_currency || plan?.currency || null,
        affiliate_pay: affPay,
        affiliate_pay_eur: toEur(affPay, affPayCur),
        is_paid: !!it.is_paid_to_affiliate,
        status: cls.status,
      };
    });
  }, [periodItems, plans, clientsList, fxByBase]);

  const totals = useMemo(() => {
    const t = {
      qualified: 0, ngrEur: 0, commissionChargedEur: 0, affPayEur: 0, paidEur: 0, pendingEur: 0,
    };
    for (const r of rows) {
      t.qualified += r.qualified;
      t.ngrEur += r.ngrEur;
      t.commissionChargedEur += r.commission_charged_eur;
      t.affPayEur += r.affiliate_pay_eur;
      if (r.is_paid) t.paidEur += r.affiliate_pay_eur;
      else t.pendingEur += r.affiliate_pay_eur;
    }
    return t;
  }, [rows]);

  const ooMargin = totals.commissionChargedEur - totals.affPayEur;
  const ooMarginPct = grossMarginAll > 0 ? (ooMargin / grossMarginAll) * 100 : 0;
  const qualifiedDelta = prevQualified > 0 ? ((totals.qualified - prevQualified) / prevQualified) * 100 : null;

  const activeGoal = useMemo(() => {
    if (!goals.length) return null;
    const inPeriod = goals.filter((g) => !g.period || ymInRange(g.period, range.from, range.to));
    const general = inPeriod.find((g) => g.scope === "general") || inPeriod[0];
    return general || null;
  }, [goals, range.from, range.to]);

  const funnel = useMemo(() => {
    let v = 0, s = 0, f = 0;
    for (const r of routyRows) {
      v += Number(r.visits) || 0;
      s += Number(r.signups) || 0;
      f += Number(r.firstTimeDeposits) || 0;
    }
    const c = totals.qualified;
    return {
      v, s, f, c,
      vToS: v > 0 ? (s / v) * 100 : 0,
      sToF: s > 0 ? (f / s) * 100 : 0,
      fToC: f > 0 ? (c / f) * 100 : 0,
    };
  }, [routyRows, totals.qualified]);

  const daily = useMemo(() => {
    const map = new Map<string, { day: string; ftds: number; ngr: number }>();
    for (const r of routyRows) {
      if (!r.date) continue;
      const day = r.date.slice(0, 10);
      const o = map.get(day) ?? { day, ftds: 0, ngr: 0 };
      o.ftds += Number(r.firstTimeDeposits) || 0;
      o.ngr += Number(r.netRevenue) || 0;
      map.set(day, o);
    }
    return Array.from(map.values()).sort((a, b) => a.day.localeCompare(b.day));
  }, [routyRows]);

  const byOperator = useMemo(() => {
    const m = new Map<string, { name: string; qualified: number; ngrEur: number; chargedEur: number; affEur: number }>();
    for (const r of rows) {
      const o = m.get(r.client) ?? { name: r.client, qualified: 0, ngrEur: 0, chargedEur: 0, affEur: 0 };
      o.qualified += r.qualified; o.ngrEur += r.ngrEur; o.chargedEur += r.commission_charged_eur; o.affEur += r.affiliate_pay_eur;
      m.set(r.client, o);
    }
    return Array.from(m.values()).sort((a, b) => b.qualified - a.qualified);
  }, [rows]);

  const byBrand = useMemo(() => {
    const m = new Map<string, { name: string; qualified: number; ngrEur: number; chargedEur: number; affEur: number }>();
    for (const r of rows) {
      const o = m.get(r.brand) ?? { name: r.brand, qualified: 0, ngrEur: 0, chargedEur: 0, affEur: 0 };
      o.qualified += r.qualified; o.ngrEur += r.ngrEur; o.chargedEur += r.commission_charged_eur; o.affEur += r.affiliate_pay_eur;
      m.set(r.brand, o);
    }
    return Array.from(m.values()).sort((a, b) => b.qualified - a.qualified);
  }, [rows]);

  if (loading) {
    return <div className="p-8 flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>;
  }
  if (error || !aff) {
    return <div className="p-8 text-destructive">{error || "Afiliado no encontrado"}</div>;
  }

  const goalPct = activeGoal && activeGoal.ftd_target > 0 ? Math.min(100, (totals.qualified / activeGoal.ftd_target) * 100) : 0;
  const initials = (aff.fixed_name || "?").split(/\s+/).slice(0, 2).map((p: string) => p[0]).join("").toUpperCase();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4 mr-1" /> Volver</Button>
          <Avatar className="h-12 w-12">
            {aff.avatar_url ? <AvatarImage src={aff.avatar_url} /> : null}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold leading-tight">{aff.fixed_name}</h1>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-mono">{aff.unique_id}</span>
              {country && <span>· {country.name}</span>}
              <Badge variant={aff.status === "active" ? "default" : "secondary"} className="text-[10px]">{aff.status}</Badge>
            </div>
          </div>
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger className="w-[180px]"><Filter className="h-3 w-3 mr-1" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="thisMonth">Este mes</SelectItem>
            <SelectItem value="lastMonth">Mes pasado</SelectItem>
            <SelectItem value="quarter">Trimestre</SelectItem>
            <SelectItem value="ytd">YTD</SelectItem>
            <SelectItem value="last30">Últimos 30 días</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="bg-gradient-to-br from-primary/10 to-transparent border-primary/30">
        <CardContent className="p-6 grid md:grid-cols-3 gap-6">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground mb-2">
              <Trophy className="h-4 w-4 text-primary" /> CPAs cualificados
            </div>
            <div className="text-5xl font-bold text-primary">{fmtInt(totals.qualified)}</div>
            <div className="text-xs text-muted-foreground mt-1">
              FTDs que cumplen baseline y wagering. Métrica autoritativa de los cierres.
            </div>
            {qualifiedDelta != null && (
              <Badge variant="outline" className="mt-2 text-[11px]">
                {qualifiedDelta >= 0 ? "▲" : "▼"} {Math.abs(qualifiedDelta).toFixed(1)}% vs periodo anterior ({fmtInt(prevQualified)})
              </Badge>
            )}
          </div>
          <div className="md:col-span-2">
            {activeGoal && activeGoal.ftd_target > 0 ? (
              <div>
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="flex items-center gap-1 text-muted-foreground"><Target className="h-3 w-3" /> Objetivo del periodo</span>
                  <span className="font-semibold">{fmtInt(totals.qualified)} / {fmtInt(activeGoal.ftd_target)}</span>
                </div>
                <Progress value={goalPct} className="h-3" />
                <p className="text-[11px] text-muted-foreground mt-2">{goalPct.toFixed(1)}% del objetivo alcanzado.</p>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">Sin objetivo definido para este afiliado.</div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard label="Comisión generada" value={fmtEur(totals.commissionChargedEur)} hint="Cobrada al operador (EUR)" />
        <KpiCard label="A pagar al afiliado" value={fmtEur(totals.affPayEur)} hint="Según su plan de comisiones" />
        <KpiCard label="Pagado" value={fmtEur(totals.paidEur)} hint="Marcado como pagado" tone="success" />
        <KpiCard label="Pendiente" value={fmtEur(totals.pendingEur)} hint="Aún por liquidar" tone="warn" />
        <KpiCard
          label="% Margen bruto OO"
          value={fmtPct(ooMarginPct)}
          hint={`${fmtEur(ooMargin)} de margen sobre ${fmtEur(grossMarginAll)} total`}
          tone="primary"
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> Calidad del tráfico</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <FunnelStage label="Visitas" value={funnel.v} />
            <FunnelStage label="Registros" value={funnel.s} sub={fmtPct(funnel.vToS)} />
            <FunnelStage label="FTDs" value={funnel.f} sub={fmtPct(funnel.sToF)} />
            <FunnelStage label="CPAs cualificados" value={funnel.c} sub={fmtPct(funnel.fToC)} highlight />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-2 border-t">
            <Mini label="NGR del periodo" value={fmtEur(totals.ngrEur)} hint="Calidad económica del tráfico" />
            <Mini label="NGR / CPA cualificado" value={totals.qualified > 0 ? fmtEur(totals.ngrEur / totals.qualified) : "—"} hint="Valor económico por jugador validado" />
            <Mini label="Tasa FTD→Cualificado" value={fmtPct(funnel.fToC)} hint="Indicador de calidad real" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Performance diaria</CardTitle>
        </CardHeader>
        <CardContent>
          {daily.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Sin datos diarios para el periodo seleccionado.</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar yAxisId="left" dataKey="ftds" name="FTDs (Routy)" fill="hsl(var(--primary))" />
                <Line yAxisId="right" type="monotone" dataKey="ngr" name="NGR" stroke="hsl(var(--success, 142 71% 45%))" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="operator">
        <TabsList>
          <TabsTrigger value="operator"><Building2 className="h-3 w-3 mr-1" /> Por operador</TabsTrigger>
          <TabsTrigger value="brand">Por marca</TabsTrigger>
        </TabsList>
        <TabsContent value="operator"><SplitView data={byOperator} /></TabsContent>
        <TabsContent value="brand"><SplitView data={byBrand} /></TabsContent>
      </Tabs>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Detalle de cierres en el periodo</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Periodo</TableHead>
                <TableHead>Operador</TableHead>
                <TableHead>Marca</TableHead>
                <TableHead className="text-right">CPAs cualif.</TableHead>
                <TableHead className="text-right">NGR (EUR)</TableHead>
                <TableHead className="text-right">Tarifa CPA</TableHead>
                <TableHead className="text-right">Cobrado (EUR)</TableHead>
                <TableHead className="text-right">A pagar (EUR)</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs font-mono">{r.period}</TableCell>
                  <TableCell className="text-xs">{r.client}</TableCell>
                  <TableCell className="text-xs">{r.brand}</TableCell>
                  <TableCell className="text-right font-semibold">{fmtInt(r.qualified)}</TableCell>
                  <TableCell className="text-right text-xs">{fmtEur(r.ngrEur)}</TableCell>
                  <TableCell className="text-right text-xs">{r.cpa_rate != null ? `${r.cpa_rate} ${r.cpa_rate_cur || ""}` : "—"}</TableCell>
                  <TableCell className="text-right text-xs">{fmtEur(r.commission_charged_eur)}</TableCell>
                  <TableCell className="text-right text-xs font-medium text-success">{fmtEur(r.affiliate_pay_eur)}</TableCell>
                  <TableCell>
                    <Badge variant={r.is_paid ? "default" : "secondary"} className="text-[10px]">{r.is_paid ? "Pagado" : "Pendiente"}</Badge>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Sin cierres en este periodo.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Wallet className="h-4 w-4 text-primary" /> Pagos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Mini label="Total pagado" value={fmtEur(totals.paidEur)} />
            <Mini label="Pendiente" value={fmtEur(totals.pendingEur)} />
            <Mini label="Próximo pago" value="—" hint="Pendiente de integración financiera" />
          </div>
          <p className="text-[11px] text-muted-foreground mt-3">
            Esta sección se alimentará automáticamente cuando se conecte la plataforma de finanzas. Mientras tanto, los importes derivan del flag “pagado al afiliado” de cada cierre.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "success" | "warn" | "primary" }) {
  const toneCls = tone === "success" ? "text-success" : tone === "warn" ? "text-warning" : tone === "primary" ? "text-primary" : "";
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className={`text-xl font-bold mt-1 ${toneCls}`}>{value}</p>
        {hint && <p className="text-[10px] text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function FunnelStage({ label, value, sub, highlight }: { label: string; value: number; sub?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg p-3 border ${highlight ? "border-primary bg-primary/5" : "bg-muted/40"}`}>
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold ${highlight ? "text-primary" : ""}`}>{fmtInt(value)}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">Conversión: {sub}</p>}
    </div>
  );
}

function Mini({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg p-3 bg-muted/40 border">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold mt-0.5">{value}</p>
      {hint && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
}

function SplitView({ data }: { data: { name: string; qualified: number; ngrEur: number; chargedEur: number; affEur: number }[] }) {
  if (!data.length) return <p className="text-sm text-muted-foreground p-6 text-center">Sin datos.</p>;
  const top = data.slice(0, 10);
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">CPAs cualificados</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={Math.max(180, top.length * 32)}>
            <BarChart data={top} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="qualified" fill="hsl(var(--primary))">
                {top.map((_, i) => <Cell key={i} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead className="text-right">CPAs</TableHead>
                <TableHead className="text-right">NGR</TableHead>
                <TableHead className="text-right">Cobrado</TableHead>
                <TableHead className="text-right">A pagar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((d) => (
                <TableRow key={d.name}>
                  <TableCell className="text-xs">{d.name}</TableCell>
                  <TableCell className="text-right text-xs font-semibold">{fmtInt(d.qualified)}</TableCell>
                  <TableCell className="text-right text-xs">{fmtEur(d.ngrEur)}</TableCell>
                  <TableCell className="text-right text-xs">{fmtEur(d.chargedEur)}</TableCell>
                  <TableCell className="text-right text-xs text-success">{fmtEur(d.affEur)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
