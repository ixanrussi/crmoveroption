// Reusable goal visualization: ring + daily dots (extracted from BrandGoals)
import { Target } from "lucide-react";

const fmtInt = (n: number) => Math.round(n).toLocaleString();
const fmtPct = (n: number) => `${n.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;

export function statusColor(ratio: number) {
  if (ratio >= 1) return { bg: "bg-emerald-500", text: "text-emerald-600", label: "OK" };
  if (ratio >= 0.9) return { bg: "bg-yellow-400", text: "text-yellow-600", label: "−10%" };
  if (ratio >= 0.7) return { bg: "bg-orange-500", text: "text-orange-600", label: "−20%" };
  return { bg: "bg-red-500", text: "text-red-600", label: "−30%+" };
}

function dotColor(actual: number, target: number) {
  if (target <= 0) return "bg-muted";
  return statusColor(actual / target).bg;
}

export function DailyDots({
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
              title={`Día ${day}: ${fmtInt(v)}${dailyTarget > 0 ? ` / objetivo ${dailyTarget.toFixed(1)}` : ""}`}
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

export function GoalRing({
  title, actual, target, daysInMonth, dayOfMonth, perDayTotals,
}: {
  title: string;
  actual: number; target: number;
  daysInMonth: number; dayOfMonth: number;
  perDayTotals: number[];
}) {
  const monthPct = target > 0 ? (actual / target) * 100 : 0;
  const expectedSoFar = target * (dayOfMonth / daysInMonth);
  const ratio = expectedSoFar > 0 ? actual / expectedSoFar : 0;
  const dailyTarget = target / daysInMonth;
  const sc = statusColor(ratio);
  const R = 44, C = 2 * Math.PI * R;
  const pct = Math.min(100, monthPct);
  return (
    <div className="rounded-xl border bg-gradient-to-br from-primary/5 to-transparent p-4">
      <div className="flex items-center gap-2 mb-3">
        <Target className="h-4 w-4 text-primary" />
        <div className="text-sm font-semibold">{title}</div>
      </div>
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
            <div className="text-xl font-bold">{target > 0 ? fmtPct(monthPct) : "—"}</div>
            <div className="text-[10px] text-muted-foreground">del mes</div>
          </div>
        </div>
        <div className="flex-1 min-w-[200px] space-y-2">
          <div className="text-xs text-muted-foreground">
            {fmtInt(actual)} CPAs / {target > 0 ? fmtInt(target) : "sin objetivo"}
          </div>
          {target > 0 && (
            <div className="text-xs">
              Esperado al día {dayOfMonth}: <span className="font-semibold">{fmtInt(expectedSoFar)}</span>
              {" · "}
              <span className={`font-semibold ${sc.text}`}>
                {ratio >= 1 ? "Por encima del ritmo" : `${fmtPct((1 - ratio) * 100)} por debajo`}
              </span>
            </div>
          )}
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
