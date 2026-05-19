import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

type Props = { affiliateId: string };

type Item = {
  id: string;
  closure_id: string;
  brand: string | null;
  qualified_players: number;
  locked_players: number;
  commission_total: number;
  currency: string | null;
  report_type: string;
  visits: number;
  active_accounts: number;
  casino_ngr: number;
  sports_ngr: number;
};
type Closure = { id: string; client_id: string; period: string; report_type: string; status: string; currency: string | null };
type Plan = { affiliate_id: string; client_id: string | null; brand: string | null; cpa: number | null; rev_share_pct: number | null; plan_start_date: string | null };
type Client = { id: string; company_name: string };

export default function AffiliateEarnings({ affiliateId }: Props) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Item[]>([]);
  const [closures, setClosures] = useState<Closure[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [clients, setClients] = useState<Client[]>([]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      const [{ data: it }, { data: cs }, { data: pl }, { data: cl }] = await Promise.all([
        supabase.from("commission_closure_items").select("*").eq("affiliate_id", affiliateId),
        supabase.from("commission_closures").select("id, client_id, period, report_type, status, currency"),
        supabase.from("affiliate_commission_plans").select("affiliate_id, client_id, brand, cpa, rev_share_pct, plan_start_date").eq("affiliate_id", affiliateId),
        supabase.from("clients").select("id, company_name"),
      ]);
      if (cancel) return;
      setItems((it ?? []) as Item[]);
      setClosures((cs ?? []) as Closure[]);
      setPlans((pl ?? []) as Plan[]);
      setClients((cl ?? []) as Client[]);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [affiliateId]);

  const closureMap = useMemo(() => new Map(closures.map((c) => [c.id, c])), [closures]);
  const clientMap = useMemo(() => new Map(clients.map((c) => [c.id, c.company_name])), [clients]);

  // Match plan: same client, brand contains, most recent start_date <= period
  const findPlanField = (clientId: string, brand: string | null, field: "cpa" | "rev_share_pct"): number | null => {
    const candidates = plans.filter((p) => (!p.client_id || p.client_id === clientId) && p[field] != null);
    const brandLower = (brand || "").toLowerCase();
    const eligible = candidates
      .filter((p) => !p.brand || brandLower.includes(p.brand.toLowerCase()) || p.brand.toLowerCase().includes(brandLower))
      .sort((a, b) => (b.plan_start_date || "").localeCompare(a.plan_start_date || ""));
    return (eligible[0]?.[field] as number | null | undefined) ?? null;
  };
  const findCpa = (clientId: string, brand: string | null) => findPlanField(clientId, brand, "cpa");
  const findRs = (clientId: string, brand: string | null) => findPlanField(clientId, brand, "rev_share_pct");

  // Build rows: per closure (period × client × brand)
  type Row = {
    period: string; client: string; brand: string; type: string;
    qualified: number; commission_client: number;
    affiliate_earned: number; currency: string | null; status: string;
  };
  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    for (const it of items) {
      const cls = closureMap.get(it.closure_id);
      if (!cls) continue;
      const cpa = it.report_type === "cpa" ? findCpa(cls.client_id, it.brand) : null;
      const rs = it.report_type !== "cpa" ? findRs(cls.client_id, it.brand) : null;
      const earned = it.report_type === "cpa"
        ? (cpa != null ? cpa * (it.qualified_players || 0) : 0)
        : (rs != null ? Number(it.commission_total || 0) * (rs / 100) : 0);
      out.push({
        period: cls.period,
        client: clientMap.get(cls.client_id) ?? "—",
        brand: it.brand ?? "—",
        type: it.report_type,
        qualified: it.qualified_players || 0,
        commission_client: Number(it.commission_total || 0),
        affiliate_earned: earned,
        currency: it.currency ?? cls.currency,
        status: cls.status,
      });
    }
    return out.sort((a, b) => b.period.localeCompare(a.period) || a.client.localeCompare(b.client));
  }, [items, closureMap, clientMap, plans]);

  // Group by period
  const byPeriod = useMemo(() => {
    const m = new Map<string, Row[]>();
    rows.forEach((r) => {
      if (!m.has(r.period)) m.set(r.period, []);
      m.get(r.period)!.push(r);
    });
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [rows]);

  const fmt = (n: number, cur?: string | null) =>
    new Intl.NumberFormat("es-ES", { style: "currency", currency: cur || "EUR" }).format(n || 0);

  const totalEarned = rows.reduce((s, r) => s + r.affiliate_earned, 0);
  const mainCurrency = rows.find((r) => r.currency)?.currency ?? "EUR";

  if (loading) return (
    <div className="flex items-center gap-2 p-6 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Cargando…</div>
  );

  if (rows.length === 0) return (
    <Card><CardContent className="p-8 text-center text-muted-foreground">
      Aún no hay comisiones asignadas a este afiliado.
    </CardContent></Card>
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Total ganado (acumulado)</p>
            <p className="text-2xl font-bold text-success">{fmt(totalEarned, mainCurrency)}</p>
          </div>
          <Badge variant="outline">{rows.length} línea{rows.length !== 1 ? "s" : ""}</Badge>
        </CardContent>
      </Card>

      {byPeriod.map(([period, periodRows]) => {
        const tot = periodRows.reduce((s, r) => s + r.affiliate_earned, 0);
        const cur = periodRows.find((r) => r.currency)?.currency ?? "EUR";
        return (
          <Card key={period}>
            <CardContent className="p-0">
              <div className="px-4 py-2 bg-muted flex justify-between items-center border-b">
                <span className="font-semibold text-sm">{period}</span>
                <Badge>{fmt(tot, cur)}</Badge>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Operador</TableHead>
                    <TableHead>Marca</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Calificados</TableHead>
                    <TableHead className="text-right">Ganado</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {periodRows.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs">{r.client}</TableCell>
                      <TableCell className="text-xs">{r.brand}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px]">{r.type === "cpa" ? "CPA" : "RS"}</Badge></TableCell>
                      <TableCell className="text-right">{r.qualified}</TableCell>
                      <TableCell className="text-right font-medium text-success">
                        {fmt(r.affiliate_earned, r.currency)}
                      </TableCell>
                      <TableCell><Badge variant={r.status === "paid" ? "default" : "secondary"} className="text-[10px]">{r.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
