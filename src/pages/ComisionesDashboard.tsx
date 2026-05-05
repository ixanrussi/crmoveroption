import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { TrendingUp, TrendingDown, AlertTriangle, Trophy, Users, DollarSign, Activity } from "lucide-react";

type Item = {
  id: string; closure_id: string; affiliate_id: string | null;
  raw_campaign_name: string | null; brand: string | null;
  qualified_players: number; locked_players: number;
  cpa_amount: number; revshare_amount: number; commission_total: number;
  currency: string | null; match_status: string;
};
type Closure = { id: string; client_id: string; period: string; currency: string | null; status: string };
type Affiliate = { id: string; fixed_name: string; alias: string | null; country_ids: string[]; status: string };
type Client = { id: string; company_name: string };
type Country = { id: string; name: string; code: string | null };

const fmt = (n: number, cur?: string | null) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: cur || "EUR", maximumFractionDigits: 0 }).format(n || 0);
const fmtN = (n: number) => new Intl.NumberFormat("es-ES").format(n || 0);

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
        supabase.from("commission_closures").select("id, client_id, period, currency, status"),
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

  const periods = useMemo(() => {
    const s = new Set(closures.map(c => c.period));
    return [...s].sort().reverse();
  }, [closures]);

  // Filtered items joined with closure
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

  // Previous period for comparisons
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

  // KPIs
  const totals = useMemo(() => {
    const t = { commission: 0, qualified: 0, locked: 0, cpa: 0, revshare: 0 };
    enriched.forEach(i => {
      t.commission += Number(i.commission_total || 0);
      t.qualified += i.qualified_players || 0;
      t.locked += i.locked_players || 0;
      t.cpa += Number(i.cpa_amount || 0);
      t.revshare += Number(i.revshare_amount || 0);
    });
    return t;
  }, [enriched]);

  const prevTotals = useMemo(() => {
    const t = { commission: 0, qualified: 0 };
    prevEnriched.forEach(i => {
      t.commission += Number(i.commission_total || 0);
      t.qualified += i.qualified_players || 0;
    });
    return t;
  }, [prevEnriched]);

  const commissionDelta = prevTotals.commission ? ((totals.commission - prevTotals.commission) / prevTotals.commission) * 100 : 0;

  // Ranking by affiliate
  const ranking = useMemo(() => {
    const m = new Map<string, { id: string; name: string; commission: number; qualified: number; locked: number; cpa: number; revshare: number; brands: Set<string>; prev: number }>();
    enriched.forEach(i => {
      if (!i.affiliate_id) return;
      const a = affMap.get(i.affiliate_id);
      const key = i.affiliate_id;
      if (!m.has(key)) m.set(key, { id: key, name: a?.fixed_name || a?.alias || "—", commission: 0, qualified: 0, locked: 0, cpa: 0, revshare: 0, brands: new Set(), prev: 0 });
      const r = m.get(key)!;
      r.commission += Number(i.commission_total || 0);
      r.qualified += i.qualified_players || 0;
      r.locked += i.locked_players || 0;
      r.cpa += Number(i.cpa_amount || 0);
      r.revshare += Number(i.revshare_amount || 0);
      if (i.brand) r.brands.add(i.brand);
    });
    prevEnriched.forEach(i => {
      if (!i.affiliate_id) return;
      const r = m.get(i.affiliate_id);
      if (r) r.prev += Number(i.commission_total || 0);
    });
    return [...m.values()].sort((a, b) => b.commission - a.commission);
  }, [enriched, prevEnriched, affMap]);

  const totalForShare = ranking.reduce((s, r) => s + r.commission, 0) || 1;

  // Country breakdown (via affiliate.country_ids — split equally if multi)
  const byCountry = useMemo(() => {
    const m = new Map<string, number>();
    enriched.forEach(i => {
      if (!i.affiliate_id) return;
      const a = affMap.get(i.affiliate_id);
      const cids = a?.country_ids?.length ? a.country_ids : [];
      if (!cids.length) {
        m.set("Sin país", (m.get("Sin país") || 0) + Number(i.commission_total || 0));
        return;
      }
      const share = Number(i.commission_total || 0) / cids.length;
      cids.forEach(cid => {
        const name = countryMap.get(cid)?.name || "—";
        m.set(name, (m.get(name) || 0) + share);
      });
    });
    return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [enriched, affMap, countryMap]);

  const byClient = useMemo(() => {
    const m = new Map<string, number>();
    enriched.forEach(i => {
      const name = clientMap.get(i.client_id) || "—";
      m.set(name, (m.get(name) || 0) + Number(i.commission_total || 0));
    });
    return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [enriched, clientMap]);

  // Alerts
  const alerts = useMemo(() => {
    const out: { type: "high" | "low" | "warn"; title: string; description: string }[] = [];
    ranking.forEach(r => {
      if (r.prev > 0) {
        const delta = ((r.commission - r.prev) / r.prev) * 100;
        if (delta >= 50) out.push({ type: "high", title: `📈 ${r.name}`, description: `Subió +${delta.toFixed(0)}% vs período anterior (${fmt(r.commission)})` });
        else if (delta <= -50) out.push({ type: "low", title: `📉 ${r.name}`, description: `Cayó ${delta.toFixed(0)}% vs período anterior (${fmt(r.commission)})` });
      } else if (r.commission > 0 && prevEnriched.length > 0) {
        out.push({ type: "high", title: `🆕 ${r.name}`, description: `Nuevo afiliado activo este período (${fmt(r.commission)})` });
      }
      if (r.locked > 0 && r.qualified === 0) {
        out.push({ type: "warn", title: `⚠️ ${r.name}`, description: `${r.locked} jugadores bloqueados sin calificados` });
      }
    });
    const unmatched = enriched.filter(i => i.match_status === "unmatched").length;
    if (unmatched > 0) out.push({ type: "warn", title: "Filas sin afiliado asignado", description: `${unmatched} línea(s) en cierres sin match. Revisar en Cierre de Comisiones.` });
    return out.slice(0, 8);
  }, [ranking, enriched, prevEnriched]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end gap-4 justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard de Comisiones</h1>
          <p className="text-muted-foreground text-sm">Análisis de cierres por afiliado, cliente y país</p>
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
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Comisión total</p>
                <p className="text-2xl font-bold mt-1">{fmt(totals.commission)}</p>
                {periodFilter !== "all" && prevTotals.commission > 0 && (
                  <p className={`text-xs mt-1 flex items-center gap-1 ${commissionDelta >= 0 ? "text-success" : "text-destructive"}`}>
                    {commissionDelta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {commissionDelta.toFixed(1)}% vs anterior
                  </p>
                )}
              </div>
              <DollarSign className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Jugadores calificados</p>
              <p className="text-2xl font-bold mt-1">{fmtN(totals.qualified)}</p>
              <p className="text-xs text-muted-foreground mt-1">{fmtN(totals.locked)} bloqueados</p>
            </div>
            <Users className="h-8 w-8 text-success" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Afiliados activos</p>
              <p className="text-2xl font-bold mt-1">{ranking.filter(r => r.commission > 0).length}</p>
              <p className="text-xs text-muted-foreground mt-1">de {affiliates.length} totales</p>
            </div>
            <Activity className="h-8 w-8 text-warning" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Mix CPA / RevShare</p>
              <p className="text-2xl font-bold mt-1">
                {totals.commission > 0 ? `${Math.round((totals.cpa / totals.commission) * 100)}%` : "0%"}
                <span className="text-sm text-muted-foreground"> / {totals.commission > 0 ? Math.round((totals.revshare / totals.commission) * 100) : 0}%</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">{fmt(totals.cpa)} / {fmt(totals.revshare)}</p>
            </div>
            <Trophy className="h-8 w-8 text-accent" />
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" /> Alertas y movimientos relevantes
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
          <CardHeader><CardTitle className="text-base">Top 10 afiliados por comisión</CardTitle></CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ranking.slice(0, 10).map(r => ({ name: r.name.length > 18 ? r.name.slice(0, 18) + "…" : r.name, comisión: r.commission }))} layout="vertical" margin={{ left: 60 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" tickFormatter={(v) => fmt(v).replace(/\D00$/, "")} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Bar dataKey="comisión" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Comisión por país / región</CardTitle></CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={byCountry} dataKey="value" nameKey="name" outerRadius={100} label={(e: any) => e.name}>
                  {byCountry.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => fmt(v)} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Comisión por cliente</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byClient}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => fmt(v).replace(/\D00$/, "")} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Bar dataKey="value" name="Comisión" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Ranking Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ranking de afiliados</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Afiliado</TableHead>
                <TableHead>Marcas</TableHead>
                <TableHead className="text-right">Calificados</TableHead>
                <TableHead className="text-right">CPA</TableHead>
                <TableHead className="text-right">RevShare</TableHead>
                <TableHead className="text-right">Comisión</TableHead>
                <TableHead className="w-40">Impacto</TableHead>
                <TableHead className="text-right">Δ vs anterior</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ranking.length === 0 && (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Sin datos. Importa cierres para ver el ranking.</TableCell></TableRow>
              )}
              {ranking.map((r, i) => {
                const share = (r.commission / totalForShare) * 100;
                const delta = r.prev > 0 ? ((r.commission - r.prev) / r.prev) * 100 : null;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {[...r.brands].slice(0, 3).map(b => <Badge key={b} variant="secondary" className="text-xs">{b}</Badge>)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{fmtN(r.qualified)}</TableCell>
                    <TableCell className="text-right">{fmt(r.cpa)}</TableCell>
                    <TableCell className="text-right">{fmt(r.revshare)}</TableCell>
                    <TableCell className="text-right font-semibold">{fmt(r.commission)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={share} className="h-2" />
                        <span className="text-xs text-muted-foreground w-10">{share.toFixed(1)}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {delta === null ? <span className="text-xs text-muted-foreground">—</span> : (
                        <Badge variant={delta >= 0 ? "default" : "destructive"} className="text-xs">
                          {delta >= 0 ? "+" : ""}{delta.toFixed(0)}%
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
