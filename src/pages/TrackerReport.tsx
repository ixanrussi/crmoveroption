import { Fragment, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp, ChevronRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Affiliate = { id: string; fixed_name: string; aliases: string[] };

const ALL = "__all__";
const UNDEFINED_ID = "undefined";
const UNDEFINED_NAME = "Affiliate Undefined";

type Row = {
  accountId: string;
  date: string;
  tracker: string;
  trackerId: string;
  accountTrackerId: string;
  brand: string;
  brandId: string;
  visits: number;
  signups: number;
  firstTimeDeposits: number;
  cpaCount: number;
  netRevenue: number;
  depositAmount: number;
  earning: number;
  cpaCommission: number;
  revShareCommission: number;
};

type ApiResponse = { total: number; pageSize: number; data: Row[] };

const fmtNum = (n: number | undefined | null) =>
  (Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtPct = (n: number) =>
  `${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

const normalize = (s: string) =>
  (s ?? "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const METRIC_KEYS = [
  "visits", "signups", "firstTimeDeposits", "depositAmount",
  "netRevenue", "earning", "cpaCommission", "revShareCommission", "cpaCount",
] as const;

type MetricKey = typeof METRIC_KEYS[number];

type AffAgg = {
  affiliateId: string;
  affiliateName: string;
  totals: Record<MetricKey, number>;
  trackers: Map<string, {
    tracker: string;
    trackerId: string;
    accountTrackerId: string;
    brand: string;
    brandId: string;
    accountId: string;
    totals: Record<MetricKey, number>;
  }>;
};

const emptyTotals = (): Record<MetricKey, number> =>
  Object.fromEntries(METRIC_KEYS.map(k => [k, 0])) as Record<MetricKey, number>;

const isActiveTotals = (t: Record<MetricKey, number>) =>
  t.visits > 0 || t.signups > 0 || t.firstTimeDeposits > 0 ||
  t.depositAmount > 0 || t.netRevenue !== 0 || t.earning !== 0;

export default function TrackerReport() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [raw, setRaw] = useState<ApiResponse | null>(null);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [datePreset, setDatePreset] = useState<string>("last7");
  const [affiliateFilter, setAffiliateFilter] = useState(ALL);
  const [brandFilter, setBrandFilter] = useState(ALL);
  const [onlyActive, setOnlyActive] = useState(false);
  const [search, setSearch] = useState("");
  const [showDebug, setShowDebug] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [appliedRange, setAppliedRange] = useState<{ from: string; to: string }>({ from: "", to: "" });

  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);

  const toggleExpand = (id: string) => setExpanded(prev => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  // Default: last 7 days
  useEffect(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 7);
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    setDateFrom(iso(from));
    setDateTo(iso(to));
    setAppliedRange({ from: iso(from), to: iso(to) });
  }, []);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("affiliates")
        .select("id, fixed_name, aliases")
        .order("fixed_name", { ascending: true });
      if (error) { console.error(error); return; }
      setAffiliates((data ?? []) as Affiliate[]);
    })();
  }, []);

  const fetchData = async (from: string, to: string) => {
    setLoading(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {};
      if (from) body.from = `${from}T00:00:00`;
      if (to) body.to = `${to}T23:59:59`;
      const { data, error: fnError } = await supabase.functions.invoke<ApiResponse>("routy-proxy", { body });
      if (fnError) throw fnError;
      setRaw(data ?? null);
    } catch (e: any) {
      setError(e?.message || "Error al obtener los datos");
      setRaw(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (appliedRange.from && appliedRange.to) fetchData(appliedRange.from, appliedRange.to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedRange]);

  const allRows = raw?.data ?? [];

  // Build alias -> affiliate map (normalized)
  const aliasMap = useMemo(() => {
    const m = new Map<string, { id: string; name: string }>();
    for (const a of affiliates) {
      for (const al of a.aliases ?? []) {
        const k = normalize(al);
        if (k) m.set(k, { id: a.id, name: a.fixed_name });
      }
      // Also match fixed_name itself
      const fk = normalize(a.fixed_name);
      if (fk && !m.has(fk)) m.set(fk, { id: a.id, name: a.fixed_name });
    }
    return m;
  }, [affiliates]);

  // Aggregate by affiliate
  const { aggregates, matchedCount, unmatchedCount } = useMemo(() => {
    const aggMap = new Map<string, AffAgg>();
    let matched = 0;
    let unmatched = 0;
    const seenTrackers = new Set<string>();
    const matchedTrackers = new Set<string>();

    for (const r of allRows) {
      const trackerName = r.tracker ?? "";
      const k = normalize(trackerName);
      const found = aliasMap.get(k);
      const affId = found?.id ?? UNDEFINED_ID;
      const affName = found?.name ?? UNDEFINED_NAME;
      seenTrackers.add(k);
      if (found) matchedTrackers.add(k);

      let agg = aggMap.get(affId);
      if (!agg) {
        agg = { affiliateId: affId, affiliateName: affName, totals: emptyTotals(), trackers: new Map() };
        aggMap.set(affId, agg);
      }
      for (const m of METRIC_KEYS) agg.totals[m] += Number(r[m]) || 0;

      const tk = `${r.trackerId}|${r.accountTrackerId}|${r.brandId}|${r.accountId}|${trackerName}`;
      let tr = agg.trackers.get(tk);
      if (!tr) {
        tr = {
          tracker: trackerName,
          trackerId: r.trackerId ?? "",
          accountTrackerId: r.accountTrackerId ?? "",
          brand: r.brand ?? "",
          brandId: r.brandId ?? "",
          accountId: r.accountId ?? "",
          totals: emptyTotals(),
        };
        agg.trackers.set(tk, tr);
      }
      for (const m of METRIC_KEYS) tr.totals[m] += Number(r[m]) || 0;
    }

    matched = matchedTrackers.size;
    unmatched = seenTrackers.size - matched;

    return {
      aggregates: Array.from(aggMap.values()),
      matchedCount: matched,
      unmatchedCount: unmatched,
    };
  }, [allRows, aliasMap]);

  const brandOpts = useMemo(() => {
    const s = new Set<string>();
    for (const r of allRows) if (r.brand) s.add(r.brand);
    return Array.from(s).sort();
  }, [allRows]);

  const filteredAggs = useMemo(() => {
    const q = normalize(search);
    return aggregates
      .map(a => {
        // brand filter applies to detail rows; recompute totals if needed
        if (brandFilter === ALL) return a;
        const filteredTrackers = new Map(Array.from(a.trackers.entries()).filter(([, t]) => t.brand === brandFilter));
        const totals = emptyTotals();
        for (const t of filteredTrackers.values()) for (const m of METRIC_KEYS) totals[m] += t.totals[m];
        return { ...a, trackers: filteredTrackers, totals };
      })
      .filter(a => a.trackers.size > 0)
      .filter(a => affiliateFilter === ALL || a.affiliateId === affiliateFilter)
      .filter(a => !onlyActive || isActiveTotals(a.totals))
      .filter(a => !q || normalize(a.affiliateName).includes(q) ||
        Array.from(a.trackers.values()).some(t => normalize(t.tracker).includes(q)))
      .sort((a, b) => {
        if (a.affiliateId === UNDEFINED_ID) return 1;
        if (b.affiliateId === UNDEFINED_ID) return -1;
        return a.affiliateName.localeCompare(b.affiliateName);
      });
  }, [aggregates, affiliateFilter, brandFilter, onlyActive, search]);

  const kpis = useMemo(() => {
    const t = emptyTotals();
    for (const a of filteredAggs) for (const m of METRIC_KEYS) t[m] += a.totals[m];
    return t;
  }, [filteredAggs]);

  const apply = () => setAppliedRange({ from: dateFrom, to: dateTo });
  const reset = () => {
    setAffiliateFilter(ALL); setBrandFilter(ALL); setOnlyActive(false); setSearch("");
  };

  const detailTitle = appliedRange.from && appliedRange.to
    ? `Detail (${appliedRange.from} to ${appliedRange.to})`
    : "Detail (selected date range)";

  const rate = (num: number, den: number) => den > 0 ? (num / den) * 100 : 0;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Tracker Report</h1>
          <p className="text-sm text-muted-foreground">Performance por afiliado real (Routy)</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchData(appliedRange.from, appliedRange.to)} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Recargar"}
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader><CardTitle className="text-base">Filtros</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label>From</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>To</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Affiliate</Label>
              <Select value={affiliateFilter} onValueChange={setAffiliateFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value={ALL}>Todos</SelectItem>
                  <SelectItem value={UNDEFINED_ID}>{UNDEFINED_NAME}</SelectItem>
                  {affiliates.map(a => <SelectItem key={a.id} value={a.id}>{a.fixed_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Brand</Label>
              <Select value={brandFilter} onValueChange={setBrandFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value={ALL}>Todas</SelectItem>
                  {brandOpts.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Switch id="only-active" checked={onlyActive} onCheckedChange={setOnlyActive} />
              <Label htmlFor="only-active">Solo afiliados activos</Label>
            </div>
            <div className="space-y-1.5 sm:col-span-2 lg:col-span-2">
              <Label>Buscar</Label>
              <Input placeholder="Afiliado o tracker..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={apply}>Aplicar</Button>
            <Button variant="outline" onClick={reset}>Reset</Button>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { l: "Total Visits", v: kpis.visits },
          { l: "Total Signups", v: kpis.signups },
          { l: "Total FTD", v: kpis.firstTimeDeposits },
          { l: "Total Deposit Amount", v: kpis.depositAmount },
          { l: "Total Net Revenue", v: kpis.netRevenue },
          { l: "Total Earning", v: kpis.earning },
        ].map(k => (
          <Card key={k.l}>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">{k.l}</div>
              <div className="text-xl font-semibold mt-1">{fmtNum(k.v)}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{detailTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando...
            </div>
          )}
          {!loading && error && (
            <div className="py-12 text-center text-destructive">
              <div className="font-medium">Error</div>
              <div className="text-sm mt-1">{error}</div>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => fetchData(appliedRange.from, appliedRange.to)}>Reintentar</Button>
            </div>
          )}
          {!loading && !error && filteredAggs.length === 0 && (
            <div className="py-12 text-center text-muted-foreground">No hay datos para los filtros aplicados.</div>
          )}
          {!loading && !error && filteredAggs.length > 0 && (
            <div className="overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Affiliate</TableHead>
                    <TableHead className="text-right">Visits</TableHead>
                    <TableHead className="text-right">Signups</TableHead>
                    <TableHead className="text-right">FTD</TableHead>
                    <TableHead className="text-right">Deposit Amount</TableHead>
                    <TableHead className="text-right">Net Revenue</TableHead>
                    <TableHead className="text-right">Earning</TableHead>
                    <TableHead className="text-right">CPA Commission</TableHead>
                    <TableHead className="text-right">RevShare Commission</TableHead>
                    <TableHead className="text-right">CPA Count</TableHead>
                    <TableHead className="text-right">Signup Rate</TableHead>
                    <TableHead className="text-right">FTD Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAggs.map(a => {
                    const isOpen = expanded.has(a.affiliateId);
                    const undef = a.affiliateId === UNDEFINED_ID;
                    const trackers = Array.from(a.trackers.values()).sort((x, y) =>
                      (x.brand || "").localeCompare(y.brand || "") ||
                      (x.tracker || "").localeCompare(y.tracker || "")
                    );
                    return (
                      <Fragment key={a.affiliateId}>
                        <TableRow
                          className={`cursor-pointer ${undef ? "bg-destructive/10 hover:bg-destructive/15" : ""}`}
                          onClick={() => toggleExpand(a.affiliateId)}
                        >
                          <TableCell className="py-2">
                            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </TableCell>
                          <TableCell className="py-2 font-medium">{a.affiliateName}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmtNum(a.totals.visits)}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmtNum(a.totals.signups)}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmtNum(a.totals.firstTimeDeposits)}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmtNum(a.totals.depositAmount)}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmtNum(a.totals.netRevenue)}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmtNum(a.totals.earning)}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmtNum(a.totals.cpaCommission)}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmtNum(a.totals.revShareCommission)}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmtNum(a.totals.cpaCount)}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmtPct(rate(a.totals.signups, a.totals.visits))}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmtPct(rate(a.totals.firstTimeDeposits, a.totals.visits))}</TableCell>
                        </TableRow>
                        {isOpen && (
                          <TableRow className="bg-muted/30 hover:bg-muted/30">
                            <TableCell></TableCell>
                            <TableCell colSpan={12} className="p-0">
                              <div className="overflow-auto p-3">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Tracker</TableHead>
                                      <TableHead>Brand</TableHead>
                                      <TableHead>Account ID</TableHead>
                                      <TableHead className="text-right">Visits</TableHead>
                                      <TableHead className="text-right">Signups</TableHead>
                                      <TableHead className="text-right">FTD</TableHead>
                                      <TableHead className="text-right">Deposit Amount</TableHead>
                                      <TableHead className="text-right">Net Revenue</TableHead>
                                      <TableHead className="text-right">Earning</TableHead>
                                      <TableHead className="text-right">CPA Commission</TableHead>
                                      <TableHead className="text-right">RevShare Commission</TableHead>
                                      <TableHead className="text-right">CPA Count</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {trackers.map((t, i) => (
                                      <TableRow key={`${a.affiliateId}-${i}`}>
                                        <TableCell className="text-xs">{t.tracker || "—"}</TableCell>
                                        <TableCell className="text-xs">{t.brand || "—"}</TableCell>
                                        <TableCell className="text-xs">{t.accountId || "—"}</TableCell>
                                        <TableCell className="text-right tabular-nums text-xs">{fmtNum(t.totals.visits)}</TableCell>
                                        <TableCell className="text-right tabular-nums text-xs">{fmtNum(t.totals.signups)}</TableCell>
                                        <TableCell className="text-right tabular-nums text-xs">{fmtNum(t.totals.firstTimeDeposits)}</TableCell>
                                        <TableCell className="text-right tabular-nums text-xs">{fmtNum(t.totals.depositAmount)}</TableCell>
                                        <TableCell className="text-right tabular-nums text-xs">{fmtNum(t.totals.netRevenue)}</TableCell>
                                        <TableCell className="text-right tabular-nums text-xs">{fmtNum(t.totals.earning)}</TableCell>
                                        <TableCell className="text-right tabular-nums text-xs">{fmtNum(t.totals.cpaCommission)}</TableCell>
                                        <TableCell className="text-right tabular-nums text-xs">{fmtNum(t.totals.revShareCommission)}</TableCell>
                                        <TableCell className="text-right tabular-nums text-xs">{fmtNum(t.totals.cpaCount)}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Debug */}
      <Card>
        <Collapsible open={showDebug} onOpenChange={setShowDebug}>
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center justify-between p-4 text-sm font-medium hover:bg-muted/50">
              <span>Debug</span>
              {showDebug ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="p-4 pt-0 space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div className="rounded border p-3">
                  <div className="text-xs text-muted-foreground">Matched trackers</div>
                  <div className="font-semibold">{matchedCount}</div>
                </div>
                <div className="rounded border p-3">
                  <div className="text-xs text-muted-foreground">Unmatched trackers</div>
                  <div className="font-semibold">{unmatchedCount}</div>
                </div>
                <div className="rounded border p-3">
                  <div className="text-xs text-muted-foreground">Affiliates with matches</div>
                  <div className="font-semibold">{aggregates.filter(a => a.affiliateId !== UNDEFINED_ID).length}</div>
                </div>
                <div className="rounded border p-3">
                  <div className="text-xs text-muted-foreground">Total rows (raw)</div>
                  <div className="font-semibold">{allRows.length}</div>
                </div>
              </div>
              <pre className="text-xs bg-muted p-3 rounded max-h-96 overflow-auto">
{JSON.stringify(raw, null, 2)}
              </pre>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    </div>
  );
}
