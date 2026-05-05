import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend, ComposedChart, Line,
} from "recharts";
import { TrendingUp, TrendingDown, AlertTriangle, Trophy, Users, DollarSign, Activity, Target, Zap } from "lucide-react";

type Item = {
  id: string; closure_id: string; affiliate_id: string | null;
  raw_campaign_name: string | null; brand: string | null;
  qualified_players: number; locked_players: number;
  visits: number; new_accounts: number; active_accounts: number; new_purchasing: number;
  casino_ngr: number; sports_ngr: number;
  cpa_amount: number; revshare_amount: number; commission_total: number;
  currency: string | null; match_status: string;
  report_type: string; is_paid_to_affiliate: boolean;
};
type Closure = { id: string; client_id: string; period: string; currency: string | null; status: string; report_type: string };
type Affiliate = { id: string; fixed_name: string; alias: string | null; country_ids: string[]; status: string };
type Client = { id: string; company_name: string };
type Country = { id: string; name: string; code: string | null };

const fmt = (n: number, cur?: string | null) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: cur || "EUR", maximumFractionDigits: 0 }).format(n || 0);
const fmtN = (n: number) => new Intl.NumberFormat("es-ES").format(Math.round(n || 0));
const pct = (n: number) => `${(n || 0).toFixed(1)}%`;

const COLORS = ["hsl(var(--primary))", "hsl(var(--success))", "hsl(var(--warning))", "hsl(var(--destructive))", "hsl(var(--accent))", "hsl(var(--secondary))"];

export default function ComisionesDashboard() {
  const [items, setItems] = useState<Item[]>([]);
  const [closures, setClosures] = useState<Closure[]>([]);
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [periodFilter, setPeriodFilter] = useState<string>("all");
  const [clientFilter, setClientFilter] = useState<string>("all");

  useEffect(() => {
    (async () => {
      const [it, cs, af, cl, co] = await Promise.all([
        supabase.from("commission_closure_items").select("*"),
        supabase.from("commission_closures").select("id, client_id, period, currency, status, report_type"),
        supabase.from("affiliates").select("id, fixed_name, alias, country_ids, status"),
        supabase.from("clients").select("id, company_name"),
        supabase.from("countries").select("id, name, code"),
      ]);
      setItems((it.data ?? []) as Item[]);
      setClosures((cs.data ?? []) as Closure[]);
      setAffiliates((af.data ?? []) as Affiliate[]);
      setClients((cl.data ?? []) as Client[]);
      setCountries((co.data ?? []) as Country[]);
    })();
  }, []);

  const closureMap = useMemo(() => new Map(closures.map(c => [c.id, c])), [closures]);
  const affMap = useMemo(() => new Map(affiliates.map(a => [a.id, a])), [affiliates]);
  const clientMap = useMemo(() => new Map(clients.map(c => [c.id, c.company_name])), [clients]);
  const countryMap = useMemo(() => new Map(countries.map(c => [c.id, c])), [countries]);

  const periods = useMemo(() => [...new Set(closures.map(c => c.period))].sort().reverse(), [closures]);

  const enriched = useMemo(() => {
    return items.map(i => {
      const c = closureMap.get(i.closure_id);
      return { ...i, period: c?.period ?? "", client_id: c?.client_id ?? "", currency: i.currency || c?.currency || "EUR" };
    }).filter(i => {
      if (periodFilter !== "all" && i.period !== periodFilter) return false;
      if (clientFilter !== "all" && i.client_id !== clientFilter) return false;
      return true;
    });
  }, [items, closureMap, periodFilter, clientFilter]);

  const prevEnriched = useMemo(() => {
    if (periodFilter === "all" || periods.length < 2) return [];
    const idx = periods.indexOf(periodFilter);
    const prev = periods[idx + 1];
    if (!prev) return [];
    return items.map(i => {
      const c = closureMap.get(i.closure_id);
      return { ...i, period: c?.period ?? "", client_id: c?.client_id ?? "" };
    }).filter(i => i.period === prev && (clientFilter === "all" || i.client_id === clientFilter));
  }, [items, closureMap, periods, periodFilter, clientFilter]);

  // Split into CPA (cost) and RS (revenue)
  const cpaItems = useMemo(() => enriched.filter(i => i.report_type === "cpa"), [enriched]);
  const rsItems = useMemo(() => enriched.filter(i => i.report_type === "revshare"), [enriched]);

  // Global KPIs
  const totals = useMemo(() => {
    const t = {
      cpaCost: 0, qualified: 0, locked: 0,
      visits: 0, newAccounts: 0, activeAccounts: 0, newPurchasing: 0,
      casinoNgr: 0, sportsNgr: 0, ngr: 0, rsCommission: 0,
    };
    cpaItems.forEach(i => {
      t.cpaCost += Number(i.commission_total || 0);
      t.qualified += i.qualified_players || 0;
      t.locked += i.locked_players || 0;
    });
    rsItems.forEach(i => {
      t.visits += i.visits || 0;
      t.newAccounts += i.new_accounts || 0;
      t.activeAccounts += i.active_accounts || 0;
      t.newPurchasing += i.new_purchasing || 0;
      t.casinoNgr += Number(i.casino_ngr || 0);
      t.sportsNgr += Number(i.sports_ngr || 0);
      t.rsCommission += Number(i.commission_total || 0);
    });
    t.ngr = t.casinoNgr + t.sportsNgr;
    return t;
  }, [cpaItems, rsItems]);

  const prevCpaCost = useMemo(() => prevEnriched.filter(i => i.report_type === "cpa").reduce((s, i) => s + Number(i.commission_total || 0), 0), [prevEnriched]);
  const prevNgr = useMemo(() => prevEnriched.filter(i => i.report_type === "revshare").reduce((s, i) => s + Number(i.casino_ngr || 0) + Number(i.sports_ngr || 0), 0), [prevEnriched]);
  const cpaDelta = prevCpaCost ? ((totals.cpaCost - prevCpaCost) / prevCpaCost) * 100 : 0;
  const ngrDelta = prevNgr ? ((totals.ngr - prevNgr) / prevNgr) * 100 : 0;
  const roi = totals.cpaCost > 0 ? totals.ngr / totals.cpaCost : 0;
  const ngrPerActive = totals.activeAccounts > 0 ? totals.ngr / totals.activeAccounts : 0;
  const visitToAccount = totals.visits > 0 ? (totals.newAccounts / totals.visits) * 100 : 0;
  const accountToActive = totals.newAccounts > 0 ? (totals.activeAccounts / totals.newAccounts) * 100 : 0;

  // Per-affiliate aggregation across both report types
  type AffRow = {
    id: string; name: string;
    cpaCost: number; qualified: number; locked: number;
    visits: number; newAccounts: number; activeAccounts: number; newPurchasing: number;
    casinoNgr: number; sportsNgr: number; ngr: number;
    brands: Set<string>; prevCpa: number; prevNgr: number;
  };
  const ranking = useMemo(() => {
    const m = new Map<string, AffRow>();
    const ensure = (id: string): AffRow => {
      if (!m.has(id)) {
        const a = affMap.get(id);
        m.set(id, {
          id, name: a?.fixed_name || a?.alias || "—",
          cpaCost: 0, qualified: 0, locked: 0,
          visits: 0, newAccounts: 0, activeAccounts: 0, newPurchasing: 0,
          casinoNgr: 0, sportsNgr: 0, ngr: 0,
          brands: new Set(), prevCpa: 0, prevNgr: 0,
        });
      }
      return m.get(id)!;
    };
    enriched.forEach(i => {
      if (!i.affiliate_id) return;
      const r = ensure(i.affiliate_id);
      if (i.brand) r.brands.add(i.brand);
      if (i.report_type === "cpa") {
        r.cpaCost += Number(i.commission_total || 0);
        r.qualified += i.qualified_players || 0;
        r.locked += i.locked_players || 0;
      } else {
        r.visits += i.visits || 0;
        r.newAccounts += i.new_accounts || 0;
        r.activeAccounts += i.active_accounts || 0;
        r.newPurchasing += i.new_purchasing || 0;
        r.casinoNgr += Number(i.casino_ngr || 0);
        r.sportsNgr += Number(i.sports_ngr || 0);
      }
    });
    m.forEach(r => { r.ngr = r.casinoNgr + r.sportsNgr; });
    prevEnriched.forEach(i => {
      if (!i.affiliate_id) return;
      const r = m.get(i.affiliate_id);
      if (!r) return;
      if (i.report_type === "cpa") r.prevCpa += Number(i.commission_total || 0);
      else r.prevNgr += Number(i.casino_ngr || 0) + Number(i.sports_ngr || 0);
    });
    return [...m.values()];
  }, [enriched, prevEnriched, affMap]);

  const rankingByCost = useMemo(() => [...ranking].filter(r => r.cpaCost > 0).sort((a, b) => b.cpaCost - a.cpaCost), [ranking]);
  const rankingByNgr = useMemo(() => [...ranking].filter(r => r.ngr !== 0).sort((a, b) => b.ngr - a.ngr), [ranking]);
  const rankingByRoi = useMemo(() => [...ranking].filter(r => r.cpaCost > 0).map(r => ({ ...r, roi: r.ngr / r.cpaCost })).sort((a, b) => b.roi - a.roi), [ranking]);

  const totalCostShare = rankingByCost.reduce((s, r) => s + r.cpaCost, 0) || 1;
  const totalNgrShare = rankingByNgr.reduce((s, r) => s + Math.max(0, r.ngr), 0) || 1;

  // By country
  const byCountry = useMemo(() => {
    const m = new Map<string, { cpa: number; ngr: number }>();
    const add = (key: string, cpa: number, ngr: number) => {
      const cur = m.get(key) ?? { cpa: 0, ngr: 0 };
      cur.cpa += cpa; cur.ngr += ngr;
      m.set(key, cur);
    };
    enriched.forEach(i => {
      const cpa = i.report_type === "cpa" ? Number(i.commission_total || 0) : 0;
      const ngr = i.report_type === "revshare" ? Number(i.casino_ngr || 0) + Number(i.sports_ngr || 0) : 0;
      const aff = i.affiliate_id ? affMap.get(i.affiliate_id) : null;
      const cids = aff?.country_ids?.length ? aff.country_ids : [];
      if (!cids.length) { add("Sin país", cpa, ngr); return; }
      const sCpa = cpa / cids.length, sNgr = ngr / cids.length;
      cids.forEach(cid => add(countryMap.get(cid)?.name || "—", sCpa, sNgr));
    });
    return [...m.entries()].map(([name, v]) => ({ name, ...v, roi: v.cpa > 0 ? v.ngr / v.cpa : 0 })).sort((a, b) => (b.cpa + b.ngr) - (a.cpa + a.ngr)).slice(0, 10);
  }, [enriched, affMap, countryMap]);

  // By brand
  const byBrand = useMemo(() => {
    const m = new Map<string, { cpa: number; ngr: number; visits: number; active: number }>();
    enriched.forEach(i => {
      const k = i.brand ?? "—";
      const cur = m.get(k) ?? { cpa: 0, ngr: 0, visits: 0, active: 0 };
      if (i.report_type === "cpa") cur.cpa += Number(i.commission_total || 0);
      else {
        cur.ngr += Number(i.casino_ngr || 0) + Number(i.sports_ngr || 0);
        cur.visits += i.visits || 0;
        cur.active += i.active_accounts || 0;
      }
      m.set(k, cur);
    });
    return [...m.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => (b.cpa + b.ngr) - (a.cpa + a.ngr));
  }, [enriched]);

  // Alerts — BI insights
  const alerts = useMemo(() => {
    const out: { type: "high" | "low" | "warn" | "info"; title: string; description: string }[] = [];

    ranking.forEach(r => {
      // ROI alerts
      if (r.cpaCost > 0 && r.ngr < 0) {
        out.push({ type: "low", title: `🔴 ${r.name}`, description: `Pagaste ${fmt(r.cpaCost)} en CPA y los jugadores generaron NGR negativo (${fmt(r.ngr)}). ROI crítico.` });
      } else if (r.cpaCost > 50 && r.ngr === 0) {
        out.push({ type: "warn", title: `⚠️ ${r.name}`, description: `${fmt(r.cpaCost)} en CPA sin NGR registrado. Revisar calidad del tráfico.` });
      } else if (r.cpaCost > 0 && r.ngr > r.cpaCost * 3) {
        out.push({ type: "high", title: `⭐ ${r.name}`, description: `Top ROI: ${(r.ngr / r.cpaCost).toFixed(1)}x (NGR ${fmt(r.ngr)} / CPA ${fmt(r.cpaCost)})` });
      }
      // Volume movement
      if (r.prevCpa > 0) {
        const d = ((r.cpaCost - r.prevCpa) / r.prevCpa) * 100;
        if (d <= -50) out.push({ type: "low", title: `📉 ${r.name}`, description: `CPA cayó ${d.toFixed(0)}% vs período anterior` });
        else if (d >= 100) out.push({ type: "high", title: `📈 ${r.name}`, description: `CPA subió +${d.toFixed(0)}% vs período anterior` });
      }
      // Quality: locked but no qualified
      if (r.locked > 0 && r.qualified === 0) {
        out.push({ type: "warn", title: `⚠️ ${r.name}`, description: `${r.locked} jugadores bloqueados sin calificados. Posible problema de calidad.` });
      }
    });

    // Conversion funnel alerts
    if (totals.visits > 100) {
      if (visitToAccount < 1) out.push({ type: "warn", title: "Conversión visit→cuenta baja", description: `${pct(visitToAccount)} (${fmtN(totals.visits)} visitas → ${fmtN(totals.newAccounts)} cuentas)` });
      if (accountToActive < 30 && totals.newAccounts > 10) out.push({ type: "warn", title: "Activación de cuentas baja", description: `${pct(accountToActive)} de cuentas nuevas se activaron` });
    }

    const unmatched = enriched.filter(i => i.match_status === "unmatched").length;
    if (unmatched > 0) out.push({ type: "info", title: "Filas sin afiliado", description: `${unmatched} línea(s) sin match. Asígnalas en Cierre de Comisiones.` });
    return out.slice(0, 12);
  }, [ranking, enriched, totals, visitToAccount, accountToActive]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col sm:flex-row sm:items-end gap-4 justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard de Comisiones</h1>
          <p className="text-muted-foreground text-sm">CPA pagado a afiliados vs Revenue Share generado para la empresa · ROI · Calidad de tráfico</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="space-y-1">
            <Label className="text-xs">Período</Label>
            <Select value={periodFilter} onValueChange={setPeriodFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {periods.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Cliente</Label>
            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">CPA pagado a afiliados</p>
              <p className="text-2xl font-bold mt-1">{fmt(totals.cpaCost)}</p>
              {periodFilter !== "all" && prevCpaCost > 0 && (
                <p className={`text-xs mt-1 flex items-center gap-1 ${cpaDelta >= 0 ? "text-success" : "text-destructive"}`}>
                  {cpaDelta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {cpaDelta.toFixed(1)}% vs anterior
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">{fmtN(totals.qualified)} calificados</p>
            </div>
            <DollarSign className="h-8 w-8 text-primary" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">NGR generado (RS)</p>
              <p className="text-2xl font-bold mt-1">{fmt(totals.ngr)}</p>
              {periodFilter !== "all" && prevNgr !== 0 && (
                <p className={`text-xs mt-1 flex items-center gap-1 ${ngrDelta >= 0 ? "text-success" : "text-destructive"}`}>
                  {ngrDelta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {ngrDelta.toFixed(1)}% vs anterior
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">Casino {fmt(totals.casinoNgr)} · Sports {fmt(totals.sportsNgr)}</p>
            </div>
            <Trophy className="h-8 w-8 text-success" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">ROI (NGR / CPA)</p>
              <p className={`text-2xl font-bold mt-1 ${roi >= 1 ? "text-success" : "text-destructive"}`}>{roi.toFixed(2)}x</p>
              <p className="text-xs text-muted-foreground mt-1">
                {roi >= 2 ? "Excelente" : roi >= 1 ? "Rentable" : roi > 0 ? "Bajo umbral" : "Sin retorno"}
              </p>
            </div>
            <Target className={`h-8 w-8 ${roi >= 1 ? "text-success" : "text-destructive"}`} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Calidad de tráfico</p>
              <p className="text-2xl font-bold mt-1">{pct(accountToActive)}</p>
              <p className="text-xs text-muted-foreground mt-1">cuenta→activa · {fmtN(totals.activeAccounts)} activos</p>
            </div>
            <Zap className="h-8 w-8 text-warning" />
          </CardContent>
        </Card>
      </div>

      {/* Funnel mini-cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Visitas</p><p className="text-lg font-bold">{fmtN(totals.visits)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Cuentas nuevas</p><p className="text-lg font-bold">{fmtN(totals.newAccounts)}</p><p className="text-xs text-muted-foreground">{pct(visitToAccount)} conv.</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Cuentas activas</p><p className="text-lg font-bold">{fmtN(totals.activeAccounts)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Nuevos depositantes</p><p className="text-lg font-bold">{fmtN(totals.newPurchasing)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">NGR / activo</p><p className="text-lg font-bold">{fmt(ngrPerActive)}</p></CardContent></Card>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" /> Alertas e insights
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 md:grid-cols-2">
            {alerts.map((a, i) => (
              <Alert key={i} variant={a.type === "low" ? "destructive" : "default"} className={
                a.type === "high" ? "border-success/50" : a.type === "warn" ? "border-warning/50" : ""
              }>
                <AlertTitle className="text-sm">{a.title}</AlertTitle>
                <AlertDescription className="text-xs">{a.description}</AlertDescription>
              </Alert>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Top 10 afiliados — CPA pagado vs NGR generado</CardTitle></CardHeader>
          <CardContent className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={[...ranking].sort((a, b) => (b.cpaCost + Math.max(0, b.ngr)) - (a.cpaCost + Math.max(0, a.ngr))).slice(0, 10).map(r => ({
                name: r.name.length > 14 ? r.name.slice(0, 14) + "…" : r.name,
                CPA: r.cpaCost, NGR: r.ngr,
              }))}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" height={70} />
                <YAxis tickFormatter={(v) => fmt(v).replace(/\D00$/, "")} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Legend />
                <Bar dataKey="CPA" fill="hsl(var(--primary))" />
                <Bar dataKey="NGR" fill="hsl(var(--success))" />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">NGR por país</CardTitle></CardHeader>
          <CardContent className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={byCountry.filter(c => c.ngr > 0)} dataKey="ngr" nameKey="name" outerRadius={110} label={(e: any) => e.name}>
                  {byCountry.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => fmt(v)} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Comparativo por marca</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={byBrand}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tickFormatter={(v) => fmt(v).replace(/\D00$/, "")} />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip formatter={(v: number, n: string) => n === "Activos" ? fmtN(v) : fmt(v)} />
                <Legend />
                <Bar yAxisId="left" dataKey="cpa" name="CPA pagado" fill="hsl(var(--primary))" />
                <Bar yAxisId="left" dataKey="ngr" name="NGR" fill="hsl(var(--success))" />
                <Line yAxisId="right" type="monotone" dataKey="active" name="Activos" stroke="hsl(var(--warning))" strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Rankings */}
      <Tabs defaultValue="roi" className="space-y-4">
        <TabsList>
          <TabsTrigger value="roi">Por ROI</TabsTrigger>
          <TabsTrigger value="ngr">Por NGR (calidad)</TabsTrigger>
          <TabsTrigger value="cpa">Por CPA (volumen)</TabsTrigger>
        </TabsList>

        <TabsContent value="roi">
          <Card>
            <CardHeader><CardTitle className="text-base">Ranking por ROI (NGR / CPA)</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Afiliado</TableHead>
                    <TableHead className="text-right">CPA pagado</TableHead>
                    <TableHead className="text-right">NGR</TableHead>
                    <TableHead className="text-right">ROI</TableHead>
                    <TableHead className="text-right">NGR/activo</TableHead>
                    <TableHead>Calidad</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rankingByRoi.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Sin datos</TableCell></TableRow>}
                  {rankingByRoi.map((r, i) => {
                    const npa = r.activeAccounts > 0 ? r.ngr / r.activeAccounts : 0;
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell className="text-right">{fmt(r.cpaCost)}</TableCell>
                        <TableCell className={`text-right ${r.ngr < 0 ? "text-destructive" : ""}`}>{fmt(r.ngr)}</TableCell>
                        <TableCell className="text-right font-bold">
                          <Badge variant={r.roi >= 1 ? "default" : "destructive"}>{r.roi.toFixed(2)}x</Badge>
                        </TableCell>
                        <TableCell className="text-right">{fmt(npa)}</TableCell>
                        <TableCell>
                          {r.roi >= 3 ? <Badge className="bg-success">Excelente</Badge> :
                           r.roi >= 1 ? <Badge variant="secondary">Rentable</Badge> :
                           r.roi > 0 ? <Badge variant="outline">Bajo</Badge> :
                           <Badge variant="destructive">Negativo</Badge>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ngr">
          <Card>
            <CardHeader><CardTitle className="text-base">Ranking por NGR generado (calidad de jugadores)</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Afiliado</TableHead>
                    <TableHead className="text-right">Visitas</TableHead>
                    <TableHead className="text-right">Cuentas</TableHead>
                    <TableHead className="text-right">Activas</TableHead>
                    <TableHead className="text-right">Casino NGR</TableHead>
                    <TableHead className="text-right">Sports NGR</TableHead>
                    <TableHead className="text-right">NGR total</TableHead>
                    <TableHead className="w-32">Impacto NGR</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rankingByNgr.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Sin datos</TableCell></TableRow>}
                  {rankingByNgr.map((r, i) => {
                    const share = (Math.max(0, r.ngr) / totalNgrShare) * 100;
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell className="text-right">{fmtN(r.visits)}</TableCell>
                        <TableCell className="text-right">{fmtN(r.newAccounts)}</TableCell>
                        <TableCell className="text-right">{fmtN(r.activeAccounts)}</TableCell>
                        <TableCell className="text-right">{fmt(r.casinoNgr)}</TableCell>
                        <TableCell className="text-right">{fmt(r.sportsNgr)}</TableCell>
                        <TableCell className={`text-right font-semibold ${r.ngr < 0 ? "text-destructive" : ""}`}>{fmt(r.ngr)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={share} className="h-2" />
                            <span className="text-xs text-muted-foreground w-10">{share.toFixed(1)}%</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cpa">
          <Card>
            <CardHeader><CardTitle className="text-base">Ranking por CPA pagado (volumen de adquisición)</CardTitle></CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Afiliado</TableHead>
                    <TableHead>Marcas</TableHead>
                    <TableHead className="text-right">Calificados</TableHead>
                    <TableHead className="text-right">CPA pagado</TableHead>
                    <TableHead className="w-32">Impacto CPA</TableHead>
                    <TableHead className="text-right">Δ vs anterior</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rankingByCost.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Sin datos</TableCell></TableRow>}
                  {rankingByCost.map((r, i) => {
                    const share = (r.cpaCost / totalCostShare) * 100;
                    const delta = r.prevCpa > 0 ? ((r.cpaCost - r.prevCpa) / r.prevCpa) * 100 : null;
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {[...r.brands].slice(0, 3).map(b => <Badge key={b} variant="secondary" className="text-xs">{b}</Badge>)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{fmtN(r.qualified)}</TableCell>
                        <TableCell className="text-right font-semibold">{fmt(r.cpaCost)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={share} className="h-2" />
                            <span className="text-xs text-muted-foreground w-10">{share.toFixed(1)}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {delta === null ? <span className="text-xs text-muted-foreground">—</span> :
                            <Badge variant={delta >= 0 ? "default" : "destructive"} className="text-xs">{delta >= 0 ? "+" : ""}{delta.toFixed(0)}%</Badge>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
