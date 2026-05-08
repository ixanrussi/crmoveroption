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
import { ChevronDown, ChevronUp, ArrowUpDown, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Affiliate = { id: string; fixed_name: string; aliases: string[] };
const NONE_AFF = "__none__";

const ALL = "__all__";

type Row = {
  accountId: string;
  date: string;
  tracker: string;
  trackerValue: string;
  trackerId: string;
  brand: string;
  brandId: string;
  country: string;
  countryCode: string;
  region: string;
  currencyCode: string;
  visits: number;
  downloads: number;
  signups: number;
  firstTimeDeposits: number;
  cpaCount: number;
  netRevenue: number;
  depositAmount: number;
  withdrawalAmount: number;
  earning: number;
  cpaCommission: number;
  revShareCommission: number;
  calculatedCommission: number;
};

type ApiResponse = { total: number; pageSize: number; data: Row[] };

const fmtNum = (n: number | undefined | null) =>
  (Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d: string) => {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toISOString().slice(0, 10);
};

const hasActivity = (r: Row) =>
  (r.visits ?? 0) > 0 || (r.signups ?? 0) > 0 || (r.firstTimeDeposits ?? 0) > 0 ||
  (r.netRevenue ?? 0) !== 0 || (r.earning ?? 0) !== 0;

type SortKey = keyof Row | null;

export default function TrackerReport() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [raw, setRaw] = useState<ApiResponse | null>(null);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [tracker, setTracker] = useState(ALL);
  const [account, setAccount] = useState(ALL);
  const [brand, setBrand] = useState(ALL);
  const [country, setCountry] = useState(ALL);
  const [onlyActivity, setOnlyActivity] = useState(false);
  const [search, setSearch] = useState("");

  const [appliedFilters, setAppliedFilters] = useState({
    dateFrom: "", dateTo: "", tracker: ALL, account: ALL, brand: ALL, country: ALL, onlyActivity: false,
  });

  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [showDebug, setShowDebug] = useState(false);
  const pageSize = 25;

  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [savingTracker, setSavingTracker] = useState<string | null>(null);

  const loadAffiliates = async () => {
    const { data, error } = await supabase
      .from("affiliates")
      .select("id, fixed_name, aliases")
      .order("fixed_name", { ascending: true });
    if (error) {
      console.error("Error loading affiliates", error);
      return;
    }
    setAffiliates((data ?? []) as Affiliate[]);
  };

  useEffect(() => { loadAffiliates(); }, []);

  const trackerToAffiliateId = useMemo(() => {
    const m = new Map<string, string>();
    affiliates.forEach(a => (a.aliases ?? []).forEach(al => m.set(al, a.id)));
    return m;
  }, [affiliates]);

  const linkTrackerToAffiliate = async (trackerVal: string, affiliateId: string) => {
    if (!trackerVal) return;
    setSavingTracker(trackerVal);
    try {
      // Remove tracker from any affiliate that currently has it (except target)
      const owners = affiliates.filter(a => (a.aliases ?? []).includes(trackerVal) && a.id !== affiliateId);
      for (const a of owners) {
        const newAliases = (a.aliases ?? []).filter(x => x !== trackerVal);
        const { error } = await supabase.from("affiliates").update({ aliases: newAliases }).eq("id", a.id);
        if (error) throw error;
      }

      if (affiliateId !== NONE_AFF) {
        const target = affiliates.find(a => a.id === affiliateId);
        if (target && !(target.aliases ?? []).includes(trackerVal)) {
          const newAliases = [...(target.aliases ?? []), trackerVal];
          const { error } = await supabase.from("affiliates").update({ aliases: newAliases }).eq("id", affiliateId);
          if (error) throw error;
        }
      }
      toast.success("Vínculo guardado");
      await loadAffiliates();
    } catch (e: any) {
      toast.error(e?.message || "No se pudo guardar el vínculo");
    } finally {
      setSavingTracker(null);
    }
  };

  const fetchData = async (range?: { from?: string; to?: string }) => {
    setLoading(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {};
      const f = range?.from ?? dateFrom;
      const t = range?.to ?? dateTo;
      if (f) body.from = `${f}T00:00:00`;
      if (t) body.to = `${t}T23:59:59`;
      const { data, error: fnError } = await supabase.functions.invoke<ApiResponse>("routy-proxy", {
        body,
      });
      if (fnError) throw fnError;
      setRaw(data ?? null);
    } catch (e: any) {
      setError(e?.message || "Error al obtener los datos");
      setRaw(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const allRows = raw?.data ?? [];

  const uniq = (arr: (string | undefined)[]) =>
    Array.from(new Set(arr.filter((v): v is string => !!v))).sort();

  const trackerOpts = useMemo(() => uniq(allRows.map(r => r.tracker)), [allRows]);
  const accountOpts = useMemo(() => uniq(allRows.map(r => r.accountId)), [allRows]);
  const brandOpts = useMemo(() => uniq(allRows.map(r => r.brand)), [allRows]);
  const countryOpts = useMemo(() => uniq(allRows.map(r => r.countryCode)), [allRows]);

  const filtered = useMemo(() => {
    const f = appliedFilters;
    return allRows.filter(r => {
      if (f.dateFrom && r.date < f.dateFrom) return false;
      if (f.dateTo && r.date > f.dateTo) return false;
      if (f.tracker !== ALL && r.tracker !== f.tracker) return false;
      if (f.account !== ALL && r.accountId !== f.account) return false;
      if (f.brand !== ALL && r.brand !== f.brand) return false;
      if (f.country !== ALL && r.countryCode !== f.country) return false;
      if (f.onlyActivity && !hasActivity(r)) return false;
      if (search && !(r.tracker || "").toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [allRows, appliedFilters, search]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const arr = [...filtered];
    arr.sort((a, b) => {
      const av = a[sortKey] as any;
      const bv = b[sortKey] as any;
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "asc" ? av - bv : bv - av;
      }
      return sortDir === "asc"
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageRows = sorted.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => { setPage(1); }, [appliedFilters, search, sortKey, sortDir]);

  const kpis = useMemo(() => {
    const sum = (k: keyof Row) => filtered.reduce((acc, r) => acc + (Number(r[k]) || 0), 0);
    return {
      visits: sum("visits"),
      signups: sum("signups"),
      ftd: sum("firstTimeDeposits"),
      depositAmount: sum("depositAmount"),
      netRevenue: sum("netRevenue"),
      earning: sum("earning"),
    };
  }, [filtered]);

  const apply = () => {
    setAppliedFilters({ dateFrom, dateTo, tracker, account, brand, country, onlyActivity });
    fetchData({ from: dateFrom, to: dateTo });
  };
  const reset = () => {
    setDateFrom(""); setDateTo(""); setTracker(ALL); setAccount(ALL);
    setBrand(ALL); setCountry(ALL); setOnlyActivity(false); setSearch("");
    setAppliedFilters({ dateFrom: "", dateTo: "", tracker: ALL, account: ALL, brand: ALL, country: ALL, onlyActivity: false });
  };

  const toggleSort = (k: keyof Row) => {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("asc"); }
  };

  const SortBtn = ({ k, label }: { k: keyof Row; label: string }) => (
    <button onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 hover:text-foreground">
      {label} <ArrowUpDown className="h-3 w-3 opacity-60" />
    </button>
  );

  const cols: { k: keyof Row; label: string; numeric?: boolean }[] = [
    { k: "date", label: "Date" },
    { k: "tracker", label: "Tracker" },
    { k: "trackerId", label: "Tracker ID" },
    { k: "trackerValue", label: "Tracker Value" },
    { k: "accountId", label: "Account ID" },
    { k: "brand", label: "Brand" },
    { k: "brandId", label: "Brand ID" },
    { k: "countryCode", label: "Country" },
    { k: "visits", label: "Visits", numeric: true },
    { k: "signups", label: "Signups", numeric: true },
    { k: "firstTimeDeposits", label: "FTD", numeric: true },
    { k: "depositAmount", label: "Deposit Amount", numeric: true },
    { k: "netRevenue", label: "Net Revenue", numeric: true },
    { k: "earning", label: "Earning", numeric: true },
    { k: "cpaCommission", label: "CPA Commission", numeric: true },
    { k: "revShareCommission", label: "RevShare Commission", numeric: true },
    { k: "calculatedCommission", label: "Calculated Commission", numeric: true },
  ];

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Tracker Report</h1>
          <p className="text-sm text-muted-foreground">Reporte de trackers desde Routy</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchData()} disabled={loading}>
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
              <Label>Affiliate / Tracker</Label>
              <Select value={tracker} onValueChange={setTracker}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos</SelectItem>
                  {trackerOpts.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Account</Label>
              <Select value={account} onValueChange={setAccount}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos</SelectItem>
                  {accountOpts.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Brand</Label>
              <Select value={brand} onValueChange={setBrand}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos</SelectItem>
                  {brandOpts.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Country</Label>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos</SelectItem>
                  {countryOpts.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Switch id="only-activity" checked={onlyActivity} onCheckedChange={setOnlyActivity} />
              <Label htmlFor="only-activity">Only rows with activity</Label>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={apply}>Apply filters</Button>
            <Button variant="outline" onClick={reset}>Reset filters</Button>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { l: "Visits", v: kpis.visits },
          { l: "Signups", v: kpis.signups },
          { l: "First Time Deposits", v: kpis.ftd },
          { l: "Deposit Amount", v: kpis.depositAmount },
          { l: "Net Revenue", v: kpis.netRevenue },
          { l: "Earnings", v: kpis.earning },
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
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Detalle</CardTitle>
          <Input
            placeholder="Buscar por tracker..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
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
              <Button variant="outline" size="sm" className="mt-3" onClick={() => fetchData()}>Reintentar</Button>
            </div>
          )}
          {!loading && !error && sorted.length === 0 && (
            <div className="py-12 text-center text-muted-foreground">No hay datos para los filtros aplicados.</div>
          )}
          {!loading && !error && sorted.length > 0 && (
            <>
              <div className="overflow-auto max-h-[70vh] relative rounded-md border">
                <Table>
                  <TableHeader className="sticky top-0 z-20 bg-background shadow-sm">
                    <TableRow className="hover:bg-background">
                      {cols.map(c => (
                        <Fragment key={c.k}>
                          <TableHead className={`bg-background ${c.numeric ? "text-right" : ""}`}>
                            <SortBtn k={c.k} label={c.label} />
                          </TableHead>
                          {c.k === "tracker" && (
                            <TableHead className="min-w-[220px] bg-background">Afiliado</TableHead>
                          )}
                        </Fragment>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageRows.map((r, i) => (
                      <TableRow key={i}>
                        {cols.map(c => {
                          const v = r[c.k];
                          let display: string;
                          if (c.k === "date") display = fmtDate(String(v ?? ""));
                          else if (c.numeric) display = fmtNum(v as number);
                          else display = String(v ?? "");
                          const currentAffId = trackerToAffiliateId.get(r.tracker) ?? NONE_AFF;
                          return (
                            <Fragment key={c.k}>
                              <TableCell className={c.numeric ? "text-right tabular-nums" : ""}>
                                {display}
                              </TableCell>
                              {c.k === "tracker" && (
                                <TableCell className="min-w-[220px]">
                                  <Select
                                    value={currentAffId}
                                    onValueChange={(val) => linkTrackerToAffiliate(r.tracker, val)}
                                    disabled={savingTracker === r.tracker || !r.tracker}
                                  >
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue placeholder="Sin asignar" />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-72">
                                      <SelectItem value={NONE_AFF}>— Sin asignar —</SelectItem>
                                      {affiliates.map(a => (
                                        <SelectItem key={a.id} value={a.id}>{a.fixed_name}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                              )}
                            </Fragment>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex items-center justify-between mt-4 text-sm">
                <div className="text-muted-foreground">
                  {sorted.length} filas · página {page} / {totalPages}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
                  <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Siguiente</Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Debug */}
      <Card>
        <Collapsible open={showDebug} onOpenChange={setShowDebug}>
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center justify-between p-4 text-sm font-medium hover:bg-muted/50">
              <span>Debug · Raw API response</span>
              {showDebug ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="p-4 pt-0">
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
