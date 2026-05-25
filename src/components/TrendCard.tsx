import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

type Metric = {
  label: string;
  currentMTD: number;
  previousMonthTotal: number;
  format?: (n: number) => string;
};

const defaultFmt = (n: number) => Math.round(n).toLocaleString();

function DeltaBadge({ delta }: { delta: number }) {
  if (!Number.isFinite(delta)) return <span className="text-muted-foreground text-xs">—</span>;
  const isUp = delta > 0;
  const isFlat = Math.abs(delta) < 0.5;
  const Icon = isFlat ? Minus : isUp ? TrendingUp : TrendingDown;
  const color = isFlat ? "text-muted-foreground" : isUp ? "text-emerald-600" : "text-red-600";
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${color}`}>
      <Icon className="h-3 w-3" />
      {isUp ? "+" : ""}{delta.toLocaleString(undefined, { maximumFractionDigits: 1 })}%
    </span>
  );
}

function MetricBlock({ m, daysInMonth, dayOfMonth }: { m: Metric; daysInMonth: number; dayOfMonth: number }) {
  const fmt = m.format ?? defaultFmt;
  const avgPerDay = dayOfMonth > 0 ? m.currentMTD / dayOfMonth : 0;
  const projection = avgPerDay * daysInMonth;
  const prev = m.previousMonthTotal;
  const deltaVsPrev = prev > 0 ? ((projection - prev) / prev) * 100 : NaN;

  return (
    <div className="rounded-lg border p-3 bg-card/40 space-y-2">
      <div className="text-xs text-muted-foreground font-medium">{m.label}</div>
      <div className="flex items-baseline gap-2 flex-wrap">
        <div className="text-2xl font-bold">{fmt(projection)}</div>
        <div className="text-[10px] text-muted-foreground">proyección cierre de mes</div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <div className="text-muted-foreground">Actual MTD</div>
          <div className="font-semibold">{fmt(m.currentMTD)}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Mes anterior</div>
          <div className="font-semibold">{fmt(prev)}</div>
        </div>
      </div>
      <div className="flex items-center justify-between pt-1 border-t">
        <span className="text-[11px] text-muted-foreground">vs mes anterior</span>
        <DeltaBadge delta={deltaVsPrev} />
      </div>
    </div>
  );
}

export default function TrendCard({
  title = "Tendencia del mes",
  metrics,
  daysInMonth,
  dayOfMonth,
}: {
  title?: string;
  metrics: Metric[];
  daysInMonth: number;
  dayOfMonth: number;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`grid gap-3 ${metrics.length > 1 ? "sm:grid-cols-2" : ""}`}>
          {metrics.map((m) => (
            <MetricBlock key={m.label} m={m} daysInMonth={daysInMonth} dayOfMonth={dayOfMonth} />
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground mt-3">
          Proyección = (actual MTD / día actual) × días del mes. Compara contra el total del mes anterior.
        </p>
      </CardContent>
    </Card>
  );
}
