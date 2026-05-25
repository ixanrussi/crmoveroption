import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, Users } from "lucide-react";
import { GoalRing, DailyDots, statusColor } from "@/components/operator/GoalVisuals";
import TrendCard from "@/components/TrendCard";

type RoutyRow = {
  date?: string;
  brand?: string;
  tracker?: string;
  trackerId?: string;
  accountId?: string;
  country?: string;
  cpaCount?: number;
  cpaCommission?: number;
  revShareCommission?: number;
  firstTimeDeposits?: number;
  updatedAt?: string;
};

type Goal = { id: string; brand: string; period: string; cpa_target: number };

const iso = (d: Date) => d.toISOString().slice(0, 10);
const fmtInt = (n: number) => Math.round(n).toLocaleString();
const fmtMoney = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });

const brandKey = (b?: string | null) => (b ?? "").trim().toLowerCase();
function canonBrand(b: string | undefined | null, clientBrands: string[], aliases?: Record<string, string[]>): string {
  const k = brandKey(b);
  if (!k) return "";
  // 1) explicit alias map: canonical -> [variants]
  if (aliases) {
    for (const [canonical, list] of Object.entries(aliases)) {
      if (brandKey(canonical) === k) return canonical;
      if (Array.isArray(list) && list.some(v => brandKey(v) === k)) return canonical;
    }
  }
  // 2) match against client's declared brands (case-insensitive)
  const match = clientBrands.find(cb => brandKey(cb) === k);
  return match ?? (b ?? "").trim();
}

function monthBounds(d: Date) {
  const y = d.getFullYear(), m = d.getMonth();
  const first = new Date(y, m, 1);
  const last = new Date(y, m + 1, 0);
  const period = `${y}-${String(m + 1).padStart(2, "0")}`;
  return { first, last, period, daysInMonth: last.getDate() };
}

function weekBounds(d: Date) {
  // Monday-based week
  const day = (d.getDay() + 6) % 7; // 0=Mon
  const monday = new Date(d); monday.setDate(d.getDate() - day); monday.setHours(0,0,0,0);
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6); sunday.setHours(23,59,59,999);
  return { first: monday, last: sunday };
}

async function fetchRouty(accountId: string, from: Date, to: Date): Promise<RoutyRow[]> {
  const { data } = await supabase.functions.invoke<{ data: RoutyRow[] }>("routy-proxy", {
    body: { from: `${iso(from)}T00:00:00`, to: `${iso(to)}T23:59:59`, accountId },
  });
  return data?.data ?? [];
}

export default function ClienteAnalisis() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [monthDate, setMonthDate] = useState(() => new Date());
  const { first, last, period, daysInMonth } = useMemo(() => monthBounds(monthDate), [monthDate]);
  const today = new Date(); today.setHours(0,0,0,0);
  const isCurrentMonth = today.getMonth() === first.getMonth() && today.getFullYear() === first.getFullYear();
  const dayOfMonth = isCurrentMonth ? today.getDate() : daysInMonth;

  const [client, setClient] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [dayFilter, setDayFilter] = useState<string>("month");
  const [rows, setRows] = useState<RoutyRow[]>([]);
  const [prevMonthRows, setPrevMonthRows] = useState<RoutyRow[]>([]);
  const [thisWeekRows, setThisWeekRows] = useState<RoutyRow[]>([]);
  const [prevWeekRows, setPrevWeekRows] = useState<RoutyRow[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [affiliatesByUid, setAffiliatesByUid] = useState<Map<string, { id: string; name: string }>>(new Map());

  // Load client
  useEffect(() => {
    if (!id) return;
    supabase.from("clients").select("*").eq("id", id).maybeSingle().then(({ data }) => setClient(data));
  }, [id]);

  // Load all data
  useEffect(() => {
    let cancelled = false;
    if (!client) return;
    const accountId = client.routy_account_id;
    if (!accountId) { setLoading(false); return; }

    async function load() {
      setLoading(true);
      const prevMonth = new Date(first); prevMonth.setMonth(prevMonth.getMonth() - 1);
      const pm = monthBounds(prevMonth);
      const tw = weekBounds(today);
      const pwAnchor = new Date(tw.first); pwAnchor.setDate(pwAnchor.getDate() - 7);
      const pw = weekBounds(pwAnchor);
      const brands: string[] = (client.brands ?? []) as string[];

      const [monthRes, prevRes, twRes, pwRes, goalsRes, affRes] = await Promise.all([
        fetchRouty(accountId, first, last),
        fetchRouty(accountId, pm.first, pm.last),
        fetchRouty(accountId, tw.first, tw.last),
        fetchRouty(accountId, pw.first, pw.last),
        supabase.from("brand_cpa_goals").select("*").eq("period", period)
          .then(({ data }) => (data ?? []).filter((g: any) => brands.length === 0 || brands.includes(g.brand))),
        supabase.from("affiliates").select("id, unique_id, fixed_name"),
      ]);
      if (cancelled) return;

      const clientBrands: string[] = (client.brands ?? []) as string[];
      const norm = (rs: RoutyRow[]) => rs.map(r => ({ ...r, brand: canonBrand(r.brand, clientBrands) || r.brand }));
      setRows(norm(monthRes));
      setPrevMonthRows(norm(prevRes));
      setThisWeekRows(norm(twRes));
      setPrevWeekRows(norm(pwRes));
      setGoals((goalsRes as Goal[]).map(g => ({ ...g, brand: canonBrand(g.brand, clientBrands) || g.brand })));
      const map = new Map<string, { id: string; name: string }>();
      for (const a of (affRes.data ?? []) as any[]) {
        if (a.unique_id) map.set(String(a.unique_id), { id: a.id, name: a.fixed_name });
      }
      setAffiliatesByUid(map);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [client, first.getTime(), last.getTime(), period]);

  // Available brands from data + client (case-insensitive dedupe)
  const brands = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of (client?.brands ?? []) as string[]) {
      const k = brandKey(b); if (k && !map.has(k)) map.set(k, b);
    }
    for (const r of rows) {
      const k = brandKey(r.brand); if (k && !map.has(k)) map.set(k, (r.brand ?? "").trim());
    }
    return Array.from(map.values()).sort();
  }, [client, rows]);


  const filteredRows = useMemo(() => {
    let out = rows;
    if (brandFilter !== "all") out = out.filter(r => (r.brand ?? "") === brandFilter);
    if (dayFilter === "last7") {
      const cutoff = new Date(today); cutoff.setDate(cutoff.getDate() - 6);
      out = out.filter(r => r.date && new Date(r.date) >= cutoff);
    } else if (dayFilter === "today") {
      out = out.filter(r => r.date === iso(today));
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(dayFilter)) {
      out = out.filter(r => r.date === dayFilter);
    }
    return out;
  }, [rows, brandFilter, dayFilter]);

  // Aggregations
  const totalCpa = useMemo(() => filteredRows.reduce((s, r) => s + (Number(r.cpaCount) || 0), 0), [filteredRows]);
  const totalCommission = useMemo(() => filteredRows.reduce((s, r) =>
    s + (Number(r.cpaCommission) || 0) + (Number(r.revShareCommission) || 0), 0), [filteredRows]);

  // Goal total: respect brand filter
  const goalTotal = useMemo(() => {
    if (brandFilter !== "all") return goals.find(g => g.brand === brandFilter)?.cpa_target ?? 0;
    return goals.reduce((s, g) => s + (g.cpa_target || 0), 0);
  }, [goals, brandFilter]);

  // Per-day actuals (filtered by brand) over month
  const perDayTotals = useMemo(() => {
    const arr = Array.from({ length: daysInMonth }, () => 0);
    for (const r of rows) {
      if (brandFilter !== "all" && (r.brand ?? "") !== brandFilter) continue;
      if (!r.date) continue;
      const d = new Date(r.date).getDate();
      arr[d - 1] += Number(r.cpaCount) || 0;
    }
    return arr;
  }, [rows, daysInMonth, brandFilter]);

  // Per-brand breakdown rows
  const brandBreakdown = useMemo(() => {
    const map = new Map<string, { cpa: number; perDay: Map<string, number>; commission: number }>();
    for (const r of rows) {
      const b = (r.brand ?? "").trim() || "—";
      if (!map.has(b)) map.set(b, { cpa: 0, perDay: new Map(), commission: 0 });
      const obj = map.get(b)!;
      obj.cpa += Number(r.cpaCount) || 0;
      obj.commission += (Number(r.cpaCommission) || 0) + (Number(r.revShareCommission) || 0);
      if (r.date) {
        const d = String(new Date(r.date).getDate());
        obj.perDay.set(d, (obj.perDay.get(d) ?? 0) + (Number(r.cpaCount) || 0));
      }
    }
    return Array.from(map.entries())
      .filter(([b]) => b !== "—")
      .map(([brand, v]) => ({
        brand, ...v,
        target: goals.find(g => g.brand === brand)?.cpa_target ?? 0,
      }))
      .sort((a, b) => b.cpa - a.cpa);
  }, [rows, goals]);

  // Affiliates table
  const affiliateRows = useMemo(() => {
    const map = new Map<string, { tracker: string; cpa: number; commission: number; brands: Set<string>; lastDate: string }>();
    for (const r of filteredRows) {
      const tk = (r.tracker ?? "").trim();
      if (!tk) continue;
      if (!map.has(tk)) map.set(tk, { tracker: tk, cpa: 0, commission: 0, brands: new Set(), lastDate: "" });
      const o = map.get(tk)!;
      o.cpa += Number(r.cpaCount) || 0;
      o.commission += (Number(r.cpaCommission) || 0) + (Number(r.revShareCommission) || 0);
      if (r.brand) o.brands.add(r.brand);
      if (r.date && r.date > o.lastDate) o.lastDate = r.date;
    }
    return Array.from(map.values())
      .map(o => ({ ...o, brands: Array.from(o.brands), aff: affiliatesByUid.get(o.tracker) }))
      .filter(o => o.cpa > 0 || o.commission > 0)
      .sort((a, b) => b.cpa - a.cpa);
  }, [filteredRows, affiliatesByUid]);

  // Comparatives (apply brand filter only)
  const sumCpa = (arr: RoutyRow[]) => arr.reduce((s, r) =>
    (brandFilter !== "all" && (r.brand ?? "") !== brandFilter) ? s : s + (Number(r.cpaCount) || 0), 0);
  const sumComm = (arr: RoutyRow[]) => arr.reduce((s, r) =>
    (brandFilter !== "all" && (r.brand ?? "") !== brandFilter) ? s : s + (Number(r.cpaCommission) || 0) + (Number(r.revShareCommission) || 0), 0);

  const monthCpa = sumCpa(rows);
  const monthComm = sumComm(rows);
  const prevMonthCpa = sumCpa(prevMonthRows);
  const prevMonthComm = sumComm(prevMonthRows);

  // Month vs same-day-range previous month
  const prevMonthMTD_Cpa = useMemo(() => {
    return prevMonthRows.reduce((s, r) => {
      if (brandFilter !== "all" && (r.brand ?? "") !== brandFilter) return s;
      if (!r.date) return s;
      const day = new Date(r.date).getDate();
      if (day > dayOfMonth) return s;
      return s + (Number(r.cpaCount) || 0);
    }, 0);
  }, [prevMonthRows, dayOfMonth, brandFilter]);
  const prevMonthMTD_Comm = useMemo(() => {
    return prevMonthRows.reduce((s, r) => {
      if (brandFilter !== "all" && (r.brand ?? "") !== brandFilter) return s;
      if (!r.date) return s;
      const day = new Date(r.date).getDate();
      if (day > dayOfMonth) return s;
      return s + (Number(r.cpaCommission) || 0) + (Number(r.revShareCommission) || 0);
    }, 0);
  }, [prevMonthRows, dayOfMonth, brandFilter]);

  const weekCpa = sumCpa(thisWeekRows);
  const weekComm = sumComm(thisWeekRows);
  const prevWeekCpa = sumCpa(prevWeekRows);
  const prevWeekComm = sumComm(prevWeekRows);

  const pct = (now: number, before: number) => before > 0 ? ((now - before) / before) * 100 : NaN;
  const fmtDelta = (d: number) => Number.isFinite(d) ? `${d > 0 ? "+" : ""}${d.toLocaleString(undefined, { maximumFractionDigits: 1 })}%` : "—";
  const deltaCls = (d: number) => !Number.isFinite(d) ? "text-muted-foreground" : Math.abs(d) < 0.5 ? "text-muted-foreground" : d > 0 ? "text-emerald-600" : "text-red-600";

  if (!client) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando operador…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/clientes")}><ArrowLeft className="h-4 w-4" /></Button>
          {client.logo_url && <img src={client.logo_url} alt="" className="h-10 w-10 rounded object-cover" />}
          <div>
            <h1 className="text-xl font-bold leading-tight">{client.company_name}</h1>
            <p className="text-xs text-muted-foreground">Análisis de performance · Periodo {period}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 border rounded-md">
            <Button variant="ghost" size="icon" className="h-8 w-8"
              onClick={() => { const d = new Date(monthDate); d.setMonth(d.getMonth() - 1); setMonthDate(d); }}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium px-2">{period}</span>
            <Button variant="ghost" size="icon" className="h-8 w-8" disabled={isCurrentMonth}
              onClick={() => { const d = new Date(monthDate); d.setMonth(d.getMonth() + 1); setMonthDate(d); }}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Select value={brandFilter} onValueChange={setBrandFilter}>
            <SelectTrigger className="w-[170px] h-9"><SelectValue placeholder="Marca" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las marcas</SelectItem>
              {brands.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={dayFilter} onValueChange={setDayFilter}>
            <SelectTrigger className="w-[150px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Mes completo</SelectItem>
              <SelectItem value="last7">Últimos 7 días</SelectItem>
              <SelectItem value="today">Hoy</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {!client.routy_account_id ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">
          Vincula la cuenta Routy del operador en su ficha para ver el análisis.
        </CardContent></Card>
      ) : loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando datos…
        </div>
      ) : (
        <>
          {/* Goal ring */}
          <GoalRing
            title={brandFilter === "all" ? "Objetivo del operador" : `Objetivo · ${brandFilter}`}
            actual={totalCpa}
            target={goalTotal}
            daysInMonth={daysInMonth}
            dayOfMonth={dayOfMonth}
            perDayTotals={perDayTotals}
          />

          {/* Trend */}
          <TrendCard
            title={`Tendencia ${brandFilter === "all" ? "del operador" : `· ${brandFilter}`}`}
            daysInMonth={daysInMonth}
            dayOfMonth={dayOfMonth}
            metrics={[
              { label: "FTDs / CPAs", currentMTD: monthCpa, previousMonthTotal: prevMonthCpa },
              { label: "Comisión total", currentMTD: monthComm, previousMonthTotal: prevMonthComm, format: fmtMoney },
            ]}
          />

          {/* Comparatives week / month */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Semana actual vs anterior</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">FTDs</span>
                  <span><span className="font-semibold">{fmtInt(weekCpa)}</span> <span className="text-muted-foreground">vs {fmtInt(prevWeekCpa)}</span> <span className={deltaCls(pct(weekCpa, prevWeekCpa))}>{fmtDelta(pct(weekCpa, prevWeekCpa))}</span></span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Comisión</span>
                  <span><span className="font-semibold">{fmtMoney(weekComm)}</span> <span className="text-muted-foreground">vs {fmtMoney(prevWeekComm)}</span> <span className={deltaCls(pct(weekComm, prevWeekComm))}>{fmtDelta(pct(weekComm, prevWeekComm))}</span></span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Mes en curso vs mes anterior (día 1–{dayOfMonth})</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">FTDs</span>
                  <span><span className="font-semibold">{fmtInt(monthCpa)}</span> <span className="text-muted-foreground">vs {fmtInt(prevMonthMTD_Cpa)}</span> <span className={deltaCls(pct(monthCpa, prevMonthMTD_Cpa))}>{fmtDelta(pct(monthCpa, prevMonthMTD_Cpa))}</span></span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Comisión</span>
                  <span><span className="font-semibold">{fmtMoney(monthComm)}</span> <span className="text-muted-foreground">vs {fmtMoney(prevMonthMTD_Comm)}</span> <span className={deltaCls(pct(monthComm, prevMonthMTD_Comm))}>{fmtDelta(pct(monthComm, prevMonthMTD_Comm))}</span></span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Per-brand breakdown */}
          {brandFilter === "all" && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Desglose por marca</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {brandBreakdown.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Sin datos en el periodo.</div>
                ) : brandBreakdown.map(b => {
                  const expected = b.target * (dayOfMonth / daysInMonth);
                  const ratio = expected > 0 ? b.cpa / expected : 0;
                  const sc = statusColor(ratio);
                  const monthPctB = b.target > 0 ? (b.cpa / b.target) * 100 : 0;
                  return (
                    <div key={b.brand} className="rounded-lg border p-3 bg-card/40 space-y-2">
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="font-medium text-sm flex-1 truncate">{b.brand}</div>
                        <div className={`text-xs font-semibold ${sc.text}`}>
                          {fmtInt(b.cpa)} / {b.target > 0 ? fmtInt(b.target) : "—"} CPAs · comisión {fmtMoney(b.commission)}
                        </div>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div className={`h-full ${sc.bg}`} style={{ width: `${Math.min(100, monthPctB)}%` }} />
                      </div>
                      <DailyDots
                        daysInMonth={daysInMonth}
                        dayOfMonth={dayOfMonth}
                        dailyTarget={b.target / daysInMonth}
                        perDay={b.perDay}
                      />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Affiliates table */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" /> Afiliados que entregan resultado ({affiliateRows.length})
            </CardTitle></CardHeader>
            <CardContent>
              {affiliateRows.length === 0 ? (
                <div className="text-sm text-muted-foreground py-4">Sin afiliados con resultados en el filtro seleccionado.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Afiliado</TableHead>
                      <TableHead>Marca(s)</TableHead>
                      <TableHead className="text-right">FTDs</TableHead>
                      <TableHead className="text-right">Comisión</TableHead>
                      <TableHead>Última actividad</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {affiliateRows.map(r => (
                      <TableRow key={r.tracker} className={r.aff ? "cursor-pointer hover:bg-accent/40" : ""}
                        onClick={() => r.aff && navigate(`/afiliados/${r.aff.id}/performance`)}>
                        <TableCell>
                          <div className="font-medium">{r.aff?.name ?? r.tracker}</div>
                          <div className="text-[11px] text-muted-foreground">{r.tracker}</div>
                        </TableCell>
                        <TableCell className="text-xs">{r.brands.join(", ") || "—"}</TableCell>
                        <TableCell className="text-right font-semibold">{fmtInt(r.cpa)}</TableCell>
                        <TableCell className="text-right">{fmtMoney(r.commission)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.lastDate || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
