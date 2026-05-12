import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Target, Loader2, Save, ChevronDown, BarChart3 } from "lucide-react";

type Row = { brand: string; cpaCount: number };
type ApiResponse = { total: number; pageSize: number; data: Row[] };
type Goal = { id: string; brand: string; period: string; cpa_target: number };

const iso = (d: Date) => d.toISOString().slice(0, 10);

function monthBounds(d = new Date()) {
  const y = d.getFullYear(), m = d.getMonth();
  const first = new Date(y, m, 1);
  const last = new Date(y, m + 1, 0);
  const period = `${y}-${String(m + 1).padStart(2, "0")}`;
  return { first, last, period, daysInMonth: last.getDate() };
}

const fmtInt = (n: number) => Math.round(n).toLocaleString();
const fmtPct = (n: number) => `${n.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;

// Status by ratio (achieved / expected_so_far)
function statusColor(ratio: number) {
  if (ratio >= 1) return { bg: "bg-emerald-500", border: "border-emerald-500", text: "text-emerald-600", label: "OK" };
  if (ratio >= 0.9) return { bg: "bg-yellow-400", border: "border-yellow-400", text: "text-yellow-600", label: "−10%" };
  if (ratio >= 0.7) return { bg: "bg-orange-500", border: "border-orange-500", text: "text-orange-600", label: "−20%" };
  return { bg: "bg-red-500", border: "border-red-500", text: "text-red-600", label: "−30%+" };
}

function dotColor(actual: number, target: number) {
  if (target <= 0) return "bg-muted";
  return statusColor(actual / target).bg;
}

export default function BrandGoals() {
  const { first, last, period, daysInMonth } = useMemo(() => monthBounds(), []);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dayOfMonth = today.getMonth() === first.getMonth() && today.getFullYear() === first.getFullYear()
    ? today.getDate() : daysInMonth;

  const [loading, setLoading] = useState(true);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [brandTotals, setBrandTotals] = useState<Map<string, number>>(new Map());
  const [perDay, setPerDay] = useState<Map<string, Map<string, number>>>(new Map()); // brand -> day(1..N) -> cpas
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const { data: g } = await supabase.from("brand_cpa_goals").select("*").eq("period", period);
      if (cancelled) return;
      setGoals((g ?? []) as Goal[]);

      // Month aggregate
      const monthRes = await supabase.functions.invoke<ApiResponse>("routy-proxy", {
        body: { from: `${iso(first)}T00:00:00`, to: `${iso(last)}T23:59:59` },
      });
      if (cancelled) return;
      const totals = new Map<string, number>();
      for (const r of monthRes.data?.data ?? []) {
        const b = (r.brand ?? "").trim() || "—";
        totals.set(b, (totals.get(b) ?? 0) + (Number(r.cpaCount) || 0));
      }
      setBrandTotals(totals);

      // Per day (parallel up to today)
      const days = Array.from({ length: dayOfMonth }, (_, i) => i + 1);
      const perDayResults = await Promise.all(days.map(async (d) => {
        const dt = new Date(first.getFullYear(), first.getMonth(), d);
        const s = iso(dt);
        const res = await supabase.functions.invoke<ApiResponse>("routy-proxy", {
          body: { from: `${s}T00:00:00`, to: `${s}T23:59:59` },
        });
        return { d, rows: res.data?.data ?? [] };
      }));
      if (cancelled) return;
      const map = new Map<string, Map<string, number>>();
      for (const { d, rows } of perDayResults) {
        for (const r of rows) {
          const b = (r.brand ?? "").trim() || "—";
          if (!map.has(b)) map.set(b, new Map());
          const inner = map.get(b)!;
          inner.set(String(d), (inner.get(String(d)) ?? 0) + (Number(r.cpaCount) || 0));
        }
      }
      setPerDay(map);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [period]);

  const goalByBrand = useMemo(() => {
    const m = new Map<string, Goal>();
    for (const g of goals) m.set(g.brand, g);
    return m;
  }, [goals]);

  // Brands list = union of brands with data + brands with goal
  const brands = useMemo(() => {
    const set = new Set<string>();
    for (const b of brandTotals.keys()) set.add(b);
    for (const g of goals) set.add(g.brand);
    return Array.from(set)
      .filter(b => b && b !== "—")
      .sort((a, b) => (goalByBrand.get(b)?.cpa_target ?? 0) - (goalByBrand.get(a)?.cpa_target ?? 0) || a.localeCompare(b));
  }, [brandTotals, goals, goalByBrand]);

  const totalTarget = useMemo(() => goals.reduce((s, g) => s + (g.cpa_target || 0), 0), [goals]);
  const totalActual = useMemo(() => Array.from(brandTotals.values()).reduce((s, n) => s + n, 0), [brandTotals]);
  const expectedSoFar = totalTarget * (dayOfMonth / daysInMonth);
  const globalRatio = expectedSoFar > 0 ? totalActual / expectedSoFar : 0;
  const monthPct = totalTarget > 0 ? (totalActual / totalTarget) * 100 : 0;

  async function saveTarget(brand: string) {
    const v = parseInt(drafts[brand] ?? "", 10);
    if (Number.isNaN(v) || v < 0) return;
    setSaving(brand);
    const existing = goalByBrand.get(brand);
    if (existing) {
      const { data } = await supabase.from("brand_cpa_goals").update({ cpa_target: v }).eq("id", existing.id).select().single();
      if (data) setGoals(prev => prev.map(g => g.id === existing.id ? (data as Goal) : g));
    } else {
      const { data } = await supabase.from("brand_cpa_goals").insert({ brand, period, cpa_target: v }).select().single();
      if (data) setGoals(prev => [...prev, data as Goal]);
    }
    setDrafts(prev => { const n = { ...prev }; delete n[brand]; return n; });
    setSaving(null);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">Objetivos por marca · CPAs aprobados</CardTitle>
        </div>
        <div className="text-xs text-muted-foreground">Periodo: {period}</div>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-12 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
          </div>
        ) : (
          <>
            {/* Global indicator */}
            <GlobalIndicator
              actual={totalActual}
              target={totalTarget}
              monthPct={monthPct}
              ratio={globalRatio}
              daysInMonth={daysInMonth}
              dayOfMonth={dayOfMonth}
              perDayTotals={(() => {
                const arr: number[] = Array.from({ length: daysInMonth }, () => 0);
                for (const inner of perDay.values()) {
                  for (const [d, v] of inner.entries()) arr[Number(d) - 1] += v;
                }
                return arr;
              })()}
              dailyTarget={totalTarget / daysInMonth}
            />

            {/* Per brand list */}
            <div className="space-y-3">
              {brands.length === 0 ? (
                <div className="text-sm text-muted-foreground">No hay marcas con datos en este mes.</div>
              ) : brands.map(brand => {
                const target = goalByBrand.get(brand)?.cpa_target ?? 0;
                const actual = brandTotals.get(brand) ?? 0;
                const expected = target * (dayOfMonth / daysInMonth);
                const ratio = expected > 0 ? actual / expected : 0;
                const monthPctB = target > 0 ? (actual / target) * 100 : 0;
                const dailyTarget = target / daysInMonth;
                const inner = perDay.get(brand) ?? new Map();
                const draft = drafts[brand] ?? String(target || "");
                const sc = statusColor(ratio);
                return (
                  <div key={brand} className="rounded-lg border p-3 space-y-2 bg-card/40">
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="font-medium text-sm flex-1 truncate">{brand}</div>
                      <div className={`text-xs font-semibold ${sc.text}`}>
                        {fmtInt(actual)} / {fmtInt(target)} CPAs · {fmtPct(monthPctB)}
                      </div>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min={0}
                          value={draft}
                          onChange={e => setDrafts(prev => ({ ...prev, [brand]: e.target.value }))}
                          className="h-7 w-24 text-xs"
                          placeholder="Objetivo"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2"
                          onClick={() => saveTarget(brand)}
                          disabled={saving === brand}
                          title="Guardar objetivo"
                        >
                          {saving === brand ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                        </Button>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div className={`h-full ${sc.bg} transition-all`} style={{ width: `${Math.min(100, monthPctB)}%` }} />
                    </div>
                    {/* Daily dots */}
                    <DailyDots
                      daysInMonth={daysInMonth}
                      dayOfMonth={dayOfMonth}
                      dailyTarget={dailyTarget}
                      perDay={inner}
                    />
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function GlobalIndicator({
  actual, target, monthPct, ratio, daysInMonth, dayOfMonth, perDayTotals, dailyTarget,
}: {
  actual: number; target: number; monthPct: number; ratio: number;
  daysInMonth: number; dayOfMonth: number; perDayTotals: number[]; dailyTarget: number;
}) {
  const sc = statusColor(ratio);
  // SVG ring
  const R = 44, C = 2 * Math.PI * R;
  const pct = Math.min(100, monthPct);
  return (
    <div className="rounded-xl border bg-gradient-to-br from-primary/5 to-transparent p-4">
      <div className="flex items-center gap-5 flex-wrap">
        <div className="relative w-[110px] h-[110px] shrink-0">
          <svg viewBox="0 0 110 110" className="w-full h-full -rotate-90">
            <circle cx="55" cy="55" r={R} className="fill-none stroke-muted" strokeWidth={10} />
            <circle
              cx="55" cy="55" r={R}
              className={`fill-none ${sc.text}`}
              stroke="currentColor"
              strokeWidth={10}
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - pct / 100)}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-xl font-bold">{fmtPct(monthPct)}</div>
            <div className="text-[10px] text-muted-foreground">del mes</div>
          </div>
        </div>
        <div className="flex-1 min-w-[200px] space-y-2">
          <div className="text-sm font-semibold">Progreso global del mes</div>
          <div className="text-xs text-muted-foreground">
            {fmtInt(actual)} CPAs aprobados / {fmtInt(target)} objetivo
          </div>
          <div className="text-xs">
            Esperado al día {dayOfMonth}: <span className="font-semibold">{fmtInt(target * (dayOfMonth / daysInMonth))}</span>
            {" · "}
            <span className={`font-semibold ${sc.text}`}>
              {ratio >= 1 ? "Por encima del ritmo" : `${fmtPct((1 - ratio) * 100)} por debajo`}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div className={`h-full ${sc.bg}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
      <div className="mt-3">
        <DailyDots
          daysInMonth={daysInMonth}
          dayOfMonth={dayOfMonth}
          dailyTarget={dailyTarget}
          perDay={new Map(perDayTotals.map((v, i) => [String(i + 1), v]))}
        />
      </div>
    </div>
  );
}

function DailyDots({
  daysInMonth, dayOfMonth, dailyTarget, perDay,
}: {
  daysInMonth: number; dayOfMonth: number; dailyTarget: number;
  perDay: Map<string, number>;
}) {
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-1">
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const isFuture = day > dayOfMonth;
          const v = perDay.get(String(day)) ?? 0;
          const color = isFuture
            ? "bg-muted/40 border-border"
            : dailyTarget <= 0
              ? "bg-muted border-border"
              : `${dotColor(v, dailyTarget)} border-transparent`;
          return (
            <div
              key={day}
              className={`h-3 w-3 rounded-full border ${color}`}
              title={`Día ${day}: ${fmtInt(v)} CPAs${dailyTarget > 0 ? ` / objetivo ${dailyTarget.toFixed(1)}` : ""}`}
            />
          );
        })}
      </div>
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />OK</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-yellow-400" />−10%</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-orange-500" />−20%</span>
        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" />−30%+</span>
      </div>
    </div>
  );
}
