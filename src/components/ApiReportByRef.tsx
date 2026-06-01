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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ChevronDown, ChevronRight, Loader2, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type Affiliate = { id: string; fixed_name: string; aliases: string[] };
type Operator = { id: number; name: string };

type ApiRow = {
  operator_id: number | null;
  operator: string | null;
  affiliate_ref_id: number | null;
  external_ref: string | null;
  affiliate_id: number | string | null;
  clicks: number | null;
  reg: number | null;
  cpa_count: number | null;
  ftd: number | null;
  cpa: number | null;
  revshare: number | null;
  revenue_total: number | null;
  income_total: number | null;
};

const ALL = "__all__";
const UNDEFINED_ID = "undefined";
const UNDEFINED_NAME = "Affiliate Undefined";

const BASE_URL = "https://visiting-riptide-amniotic.ngrok-free.dev";

const METRIC_KEYS = [
  "clicks", "reg", "cpa_count", "ftd", "cpa", "revshare", "revenue_total", "income_total",
] as const;
type MetricKey = typeof METRIC_KEYS[number];

const emptyTotals = (): Record<MetricKey, number> =>
  Object.fromEntries(METRIC_KEYS.map(k => [k, 0])) as Record<MetricKey, number>;

const fmtNum = (n: number | null | undefined) =>
  (Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const normalize = (s: string) =>
  (s ?? "").toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

const isActive = (t: Record<MetricKey, number>) =>
  t.clicks > 0 || t.reg > 0 || t.ftd > 0 || t.revenue_total !== 0 || t.income_total !== 0;

function AffiliateCombo({
  value, affiliates, onSelect, disabled,
}: {
  value: string | null;
  affiliates: Affiliate[];
  onSelect: (id: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const current = affiliates.find(a => a.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" role="combobox" disabled={disabled}
          className="h-7 w-[180px] justify-between text-xs font-normal">
          <span className="truncate">{current?.fixed_name ?? "Asignar afiliado"}</span>
          <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0" align="start">
        <Command filter={(value, search) => value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0}>
          <CommandInput placeholder="Buscar afiliado..." className="h-9" />
          <CommandList>
            <CommandEmpty>Sin resultados.</CommandEmpty>
            <CommandGroup>
              {affiliates.map(a => (
                <CommandItem key={a.id} value={a.fixed_name}
                  onSelect={() => { onSelect(a.id); setOpen(false); }}>
                  <Check className={cn("mr-2 h-4 w-4", value === a.id ? "opacity-100" : "opacity-0")} />
                  {a.fixed_name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

type AffAgg = {
  affiliateId: string;
  affiliateName: string;
  totals: Record<MetricKey, number>;
  rows: ApiRow[];
};

const iso = (d: Date) => d.toISOString().slice(0, 10);

const computePreset = (preset: string): { from: string; to: string } | null => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (preset === "today") return { from: iso(today), to: iso(today) };
  if (preset === "yesterday") { const y = new Date(today); y.setDate(y.getDate() - 1); return { from: iso(y), to: iso(y) }; }
  if (preset === "last7") { const f = new Date(today); f.setDate(f.getDate() - 7); return { from: iso(f), to: iso(today) }; }
  if (preset === "thisWeek") { const f = new Date(today); const dow = (f.getDay() + 6) % 7; f.setDate(f.getDate() - dow); return { from: iso(f), to: iso(today) }; }
  if (preset === "thisMonth") { const f = new Date(today.getFullYear(), today.getMonth(), 1); return { from: iso(f), to: iso(today) }; }
  if (preset === "lastMonth") { const f = new Date(today.getFullYear(), today.getMonth() - 1, 1); const t = new Date(today.getFullYear(), today.getMonth(), 0); return { from: iso(f), to: iso(t) }; }
  if (preset === "thisQuarter") { const q = Math.floor(today.getMonth() / 3); const f = new Date(today.getFullYear(), q * 3, 1); return { from: iso(f), to: iso(today) }; }
  if (preset === "thisYear") { const f = new Date(today.getFullYear(), 0, 1); return { from: iso(f), to: iso(today) }; }
  return null;
};

export default function ApiReportByRef() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [raw, setRaw] = useState<ApiRow[]>([]);
  const [assigning, setAssigning] = useState<string | null>(null);

  const [datePreset, setDatePreset] = useState("thisMonth");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [appliedRange, setAppliedRange] = useState<{ from: string; to: string }>({ from: "", to: "" });

  const [affiliateFilter, setAffiliateFilter] = useState(ALL);
  const [operatorFilter, setOperatorFilter] = useState(ALL);
  const [onlyActive, setOnlyActive] = useState(false);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);

  useEffect(() => {
    const r = computePreset("thisMonth")!;
    setDateFrom(r.from); setDateTo(r.to); setAppliedRange(r);
  }, []);

  const loadAffiliates = async () => {
    const { data, error } = await supabase
      .from("affiliates")
      .select("id, fixed_name, aliases")
      .order("fixed_name", { ascending: true });
    if (error) { console.error(error); return; }
    setAffiliates((data ?? []) as Affiliate[]);
  };
  useEffect(() => { loadAffiliates(); }, []);

  const fetchData = async (from: string, to: string) => {
    if (!from || !to) return;
    setLoading(true); setError(null);
    try {
      const url = `${BASE_URL}/performance/by-ref?period_from=${from}&period_to=${to}`;
      const res = await fetch(url, { headers: { "ngrok-skip-browser-warning": "true", "Accept": "application/json" } });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const json = await res.json();
      const arr: ApiRow[] = Array.isArray(json) ? json : (Array.isArray(json?.data) ? json.data : []);
      setRaw(arr);
    } catch (e: any) {
      setError(e?.message || "Error al obtener los datos");
      setRaw([]);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    if (appliedRange.from && appliedRange.to) fetchData(appliedRange.from, appliedRange.to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedRange]);

  const aliasMap = useMemo(() => {
    const m = new Map<string, { id: string; name: string }>();
    for (const a of affiliates) {
      for (const al of a.aliases ?? []) {
        const k = normalize(al); if (k) m.set(k, { id: a.id, name: a.fixed_name });
      }
      const fk = normalize(a.fixed_name);
      if (fk && !m.has(fk)) m.set(fk, { id: a.id, name: a.fixed_name });
    }
    return m;
  }, [affiliates]);

  const { aggregates, matchedCount, unmatchedCount } = useMemo(() => {
    const aggMap = new Map<string, AffAgg>();
    const seen = new Set<string>();
    const matched = new Set<string>();
    for (const r of raw) {
      const ref = r.external_ref ?? "";
      const k = normalize(ref);
      const found = aliasMap.get(k);
      const affId = found?.id ?? UNDEFINED_ID;
      const affName = found?.name ?? UNDEFINED_NAME;
      seen.add(k);
      if (found) matched.add(k);

      let agg = aggMap.get(affId);
      if (!agg) {
        agg = { affiliateId: affId, affiliateName: affName, totals: emptyTotals(), rows: [] };
        aggMap.set(affId, agg);
      }
      for (const m of METRIC_KEYS) agg.totals[m] += Number(r[m]) || 0;
      agg.rows.push(r);
    }
    return {
      aggregates: Array.from(aggMap.values()),
      matchedCount: matched.size,
      unmatchedCount: seen.size - matched.size,
    };
  }, [raw, aliasMap]);

  const operatorOpts = useMemo(() => {
    const s = new Set<string>();
    for (const r of raw) if (r.operator) s.add(r.operator);
    return Array.from(s).sort();
  }, [raw]);

  const filteredAggs = useMemo(() => {
    const q = normalize(search);
    return aggregates
      .map(a => {
        if (operatorFilter === ALL) return a;
        const rows = a.rows.filter(r => (r.operator ?? "") === operatorFilter);
        const totals = emptyTotals();
        for (const r of rows) for (const m of METRIC_KEYS) totals[m] += Number(r[m]) || 0;
        return { ...a, rows, totals };
      })
      .filter(a => a.rows.length > 0)
      .filter(a => affiliateFilter === ALL || a.affiliateId === affiliateFilter)
      .filter(a => !onlyActive || isActive(a.totals))
      .filter(a => !q || normalize(a.affiliateName).includes(q) ||
        a.rows.some(r =>
          normalize(r.external_ref ?? "").includes(q) ||
          normalize(r.operator ?? "").includes(q)
        ))
      .sort((a, b) => {
        if (a.affiliateId === UNDEFINED_ID) return 1;
        if (b.affiliateId === UNDEFINED_ID) return -1;
        return a.affiliateName.localeCompare(b.affiliateName);
      });
  }, [aggregates, affiliateFilter, operatorFilter, onlyActive, search]);

  const kpis = useMemo(() => {
    const t = emptyTotals();
    for (const a of filteredAggs) for (const m of METRIC_KEYS) t[m] += a.totals[m];
    return t;
  }, [filteredAggs]);

  const toggleExpand = (id: string) => setExpanded(prev => {
    const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n;
  });

  const handlePresetChange = (preset: string) => {
    setDatePreset(preset);
    const r = computePreset(preset);
    if (r) { setDateFrom(r.from); setDateTo(r.to); }
  };

  const apply = () => setAppliedRange({ from: dateFrom, to: dateTo });
  const reset = () => { setAffiliateFilter(ALL); setOperatorFilter(ALL); setOnlyActive(false); setSearch(""); };

  const assignRefToAffiliate = async (affiliateId: string, externalRef: string) => {
    const ref = (externalRef ?? "").trim();
    if (!ref) return;
    const aff = affiliates.find(a => a.id === affiliateId);
    if (!aff) return;
    const existing = aff.aliases ?? [];
    if (existing.some(a => normalize(a) === normalize(ref))) {
      toast({ title: "Ya es alias", description: `"${ref}" ya está asignado a ${aff.fixed_name}` });
      return;
    }
    setAssigning(ref);
    const { error } = await supabase.from("affiliates")
      .update({ aliases: [...existing, ref] }).eq("id", affiliateId);
    setAssigning(null);
    if (error) { toast({ title: "Error al asignar", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Referencia asignada", description: `"${ref}" → ${aff.fixed_name}` });
    await loadAffiliates();
  };

  const detailTitle = appliedRange.from && appliedRange.to
    ? `Detail (${appliedRange.from} to ${appliedRange.to})`
    : "Detail";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">API Report (by-ref)</h2>
          <p className="text-sm text-muted-foreground">Performance por external_ref</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchData(appliedRange.from, appliedRange.to)} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Recargar"}
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Filtros</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label>Período</Label>
              <Select value={datePreset} onValueChange={handlePresetChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Hoy</SelectItem>
                  <SelectItem value="yesterday">Ayer</SelectItem>
                  <SelectItem value="last7">Últimos 7 días</SelectItem>
                  <SelectItem value="thisWeek">Esta semana</SelectItem>
                  <SelectItem value="thisMonth">Este mes</SelectItem>
                  <SelectItem value="lastMonth">Mes pasado</SelectItem>
                  <SelectItem value="thisQuarter">Este trimestre</SelectItem>
                  <SelectItem value="thisYear">Este año</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {datePreset === "custom" ? (
              <>
                <div className="space-y-1.5"><Label>From</Label>
                  <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></div>
                <div className="space-y-1.5"><Label>To</Label>
                  <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></div>
              </>
            ) : (
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Rango</Label>
                <div className="h-10 flex items-center px-3 rounded-md border bg-muted/30 text-sm text-muted-foreground">
                  {dateFrom || "—"} → {dateTo || "—"}
                </div>
              </div>
            )}
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
              <Label>Operator</Label>
              <Select value={operatorFilter} onValueChange={setOperatorFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value={ALL}>Todos</SelectItem>
                  {operatorOpts.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Switch id="only-active-ref" checked={onlyActive} onCheckedChange={setOnlyActive} />
              <Label htmlFor="only-active-ref">Solo afiliados activos</Label>
            </div>
            <div className="space-y-1.5 sm:col-span-2 lg:col-span-2">
              <Label>Buscar</Label>
              <Input placeholder="Afiliado, external_ref, operator..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={apply}>Aplicar</Button>
            <Button variant="outline" onClick={reset}>Reset</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        {[
          { l: "Clicks", v: kpis.clicks },
          { l: "Reg", v: kpis.reg },
          { l: "CPA Count", v: kpis.cpa_count },
          { l: "FTD", v: kpis.ftd },
          { l: "CPA", v: kpis.cpa },
          { l: "RevShare", v: kpis.revshare },
          { l: "Revenue Total", v: kpis.revenue_total },
          { l: "Income Total", v: kpis.income_total },
        ].map(k => (
          <Card key={k.l}>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">{k.l}</div>
              <div className="text-lg font-semibold mt-1">{fmtNum(k.v)}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{detailTitle}</CardTitle></CardHeader>
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
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 z-30 bg-background shadow-sm [&_tr]:border-b">
                  <TableRow className="bg-background hover:bg-background">
                    <TableHead className="w-8 bg-background"></TableHead>
                    <TableHead className="bg-background">Affiliate</TableHead>
                    <TableHead className="text-right bg-background">Clicks</TableHead>
                    <TableHead className="text-right bg-background">Reg</TableHead>
                    <TableHead className="text-right bg-background">CPA Count</TableHead>
                    <TableHead className="text-right bg-background">FTD</TableHead>
                    <TableHead className="text-right bg-background">CPA</TableHead>
                    <TableHead className="text-right bg-background">RevShare</TableHead>
                    <TableHead className="text-right bg-background">Revenue Total</TableHead>
                    <TableHead className="text-right bg-background">Income Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAggs.map(a => {
                    const isOpen = expanded.has(a.affiliateId);
                    const undef = a.affiliateId === UNDEFINED_ID;
                    const rows = [...a.rows].sort((x, y) =>
                      (x.operator ?? "").localeCompare(y.operator ?? "") ||
                      (x.external_ref ?? "").localeCompare(y.external_ref ?? "")
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
                          <TableCell className="text-right tabular-nums">{fmtNum(a.totals.clicks)}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmtNum(a.totals.reg)}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmtNum(a.totals.cpa_count)}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmtNum(a.totals.ftd)}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmtNum(a.totals.cpa)}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmtNum(a.totals.revshare)}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmtNum(a.totals.revenue_total)}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmtNum(a.totals.income_total)}</TableCell>
                        </TableRow>
                        {isOpen && (
                          <TableRow className="bg-muted/30 hover:bg-muted/30">
                            <TableCell></TableCell>
                            <TableCell colSpan={9} className="p-0">
                              <div className="overflow-auto p-3">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>External Ref</TableHead>
                                      <TableHead>Operator</TableHead>
                                      <TableHead>Asignar afiliado</TableHead>
                                      <TableHead className="text-right">Clicks</TableHead>
                                      <TableHead className="text-right">Reg</TableHead>
                                      <TableHead className="text-right">CPA Count</TableHead>
                                      <TableHead className="text-right">FTD</TableHead>
                                      <TableHead className="text-right">CPA</TableHead>
                                      <TableHead className="text-right">RevShare</TableHead>
                                      <TableHead className="text-right">Revenue Total</TableHead>
                                      <TableHead className="text-right">Income Total</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {rows.map((r, i) => (
                                      <TableRow key={`${a.affiliateId}-${i}`}>
                                        <TableCell className="text-xs">{r.external_ref || "—"}</TableCell>
                                        <TableCell className="text-xs">{r.operator || "—"}</TableCell>
                                        <TableCell className="text-xs">
                                          {undef ? (
                                            <AffiliateCombo
                                              value={null}
                                              affiliates={affiliates}
                                              disabled={assigning === (r.external_ref ?? "")}
                                              onSelect={(id) => assignRefToAffiliate(id, r.external_ref ?? "")}
                                            />
                                          ) : (<span className="text-muted-foreground">—</span>)}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums text-xs">{fmtNum(r.clicks)}</TableCell>
                                        <TableCell className="text-right tabular-nums text-xs">{fmtNum(r.reg)}</TableCell>
                                        <TableCell className="text-right tabular-nums text-xs">{fmtNum(r.cpa_count)}</TableCell>
                                        <TableCell className="text-right tabular-nums text-xs">{fmtNum(r.ftd)}</TableCell>
                                        <TableCell className="text-right tabular-nums text-xs">{fmtNum(r.cpa)}</TableCell>
                                        <TableCell className="text-right tabular-nums text-xs">{fmtNum(r.revshare)}</TableCell>
                                        <TableCell className="text-right tabular-nums text-xs">{fmtNum(r.revenue_total)}</TableCell>
                                        <TableCell className="text-right tabular-nums text-xs">{fmtNum(r.income_total)}</TableCell>
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
          {!loading && !error && raw.length > 0 && (
            <div className="mt-3 text-xs text-muted-foreground">
              Matched: {matchedCount} · Unmatched: {unmatchedCount} · Total filas API: {raw.length}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
