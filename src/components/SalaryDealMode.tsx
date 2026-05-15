import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, AlertTriangle, Info } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

type Plan = {
  id: string;
  description: string | null;
  brand: string | null;
  currency: string | null;
  cpa: number | null;
  overoption_retention: number | null;
};

type Operator = {
  id: string;
  company_name: string;
  client_commission_plans: Plan[];
};

type Row = {
  uid: string;
  opId: string;
  planId: string;
  ftd: string;
  pct: number; // % del CPA neto del operador que recibe el afiliado
};

const newRow = (): Row => ({
  uid: Math.random().toString(36).slice(2),
  opId: "",
  planId: "",
  ftd: "",
  pct: 100,
});

const fmt = (n: number) =>
  new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Math.round(isFinite(n) ? n : 0));

export default function SalaryDealMode({ operators }: { operators: Operator[] }) {
  const [salary, setSalary] = useState<string>("");
  const [rows, setRows] = useState<Row[]>([newRow()]);

  const salaryNum = parseFloat(salary) || 0;

  const updateRow = (uid: string, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.uid === uid ? { ...r, ...patch } : r)));
  const addRow = () => setRows((prev) => [...prev, newRow()]);
  const removeRow = (uid: string) =>
    setRows((prev) => (prev.length === 1 ? prev : prev.filter((r) => r.uid !== uid)));

  const computed = useMemo(() => {
    return rows.map((r) => {
      const op = operators.find((o) => o.id === r.opId);
      const plan = op?.client_commission_plans.find((p) => p.id === r.planId);
      const cpaBruto = plan?.cpa ?? 0;
      const retencion = plan?.overoption_retention ?? 0;
      const cpaNeto = Math.max(0, cpaBruto - retencion);
      const ftd = parseFloat(r.ftd) || 0;
      const pct = Math.min(100, Math.max(0, r.pct ?? 0));
      const cpaAff = (cpaNeto * pct) / 100;
      const ingreso = cpaNeto * ftd;
      const pagoVar = cpaAff * ftd;
      return { r, op, plan, cpaBruto, retencion, cpaNeto, cpaAff, pct, ftd, ingreso, pagoVar };
    });
  }, [rows, operators]);

  const totalFtd = computed.reduce((s, x) => s + x.ftd, 0);
  const ingresoOvero = computed.reduce((s, x) => s + x.ingreso, 0);
  const pagoVarTotal = computed.reduce((s, x) => s + x.pagoVar, 0);
  const pagoAfiliadoTotal = salaryNum + pagoVarTotal;
  const margen = ingresoOvero - pagoAfiliadoTotal;
  const margenPct = ingresoOvero > 0 ? (margen / ingresoOvero) * 100 : 0;

  // Spread promedio ponderado por FTDs: (ingreso - pagoVar) / FTDs
  const spreadProm = totalFtd > 0 ? (ingresoOvero - pagoVarTotal) / totalFtd : 0;
  const breakEvenFtds = spreadProm > 0 ? salaryNum / spreadProm : Infinity;
  const breakEvenViable = isFinite(breakEvenFtds) && spreadProm > 0;

  const InfoTip = ({ text }: { text: string }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="inline-flex text-muted-foreground hover:text-foreground">
          <Info className="h-3 w-3" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs">{text}</TooltipContent>
    </Tooltip>
  );

  return (
    <TooltipProvider delayDuration={150}>
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Propuesta Overoption</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1 max-w-sm">
            <Label>Salario fijo mensual (USD)</Label>
            <Input
              type="number"
              inputMode="numeric"
              placeholder="Ej. 2000"
              value={salary}
              onChange={(e) => setSalary(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Lo paga Overoption al afiliado todos los meses.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Operadores · CPA por marca · FTDs/mes</CardTitle>
          <Button size="sm" variant="outline" onClick={addRow}>
            <Plus className="h-4 w-4 mr-1" /> Añadir marca
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {computed.map(({ r, op, plan, cpaBruto, retencion, cpaNeto, cpaAff, pct, ftd, ingreso, pagoVar }) => {
            const margenFila = ingreso - pagoVar;
            return (
              <div key={r.uid} className="grid grid-cols-12 gap-2 items-end border rounded-lg p-3 bg-muted/20">
                <div className="col-span-12 md:col-span-3 space-y-1">
                  <Label className="text-xs">Operador</Label>
                  <Select value={r.opId} onValueChange={(v) => updateRow(r.uid, { opId: v, planId: "" })}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      {operators.map((o) => {
                        const brands = Array.from(new Set((o.client_commission_plans ?? []).map((p) => p.brand).filter(Boolean))) as string[];
                        const brandLabel = brands.length ? ` — ${brands.join(", ")}` : "";
                        return (
                          <SelectItem key={o.id} value={o.id}>
                            {o.company_name}<span className="text-muted-foreground">{brandLabel}</span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-12 md:col-span-3 space-y-1">
                  <Label className="text-xs">Marca / Plan</Label>
                  <Select
                    value={r.planId}
                    onValueChange={(v) => updateRow(r.uid, { planId: v })}
                    disabled={!op}
                  >
                    <SelectTrigger><SelectValue placeholder={op ? "Seleccionar" : "Elige operador"} /></SelectTrigger>
                    <SelectContent>
                      {op?.client_commission_plans.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {(p.brand ? p.brand + " · " : "") + (p.description || "Plan")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-12 md:col-span-4 space-y-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <Label className="text-xs">CPA al afiliado</Label>
                    <span className="text-xs text-muted-foreground">
                      máx {fmt(cpaNeto)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Slider
                      value={[pct]}
                      min={0}
                      max={100}
                      step={1}
                      onValueChange={(v) => updateRow(r.uid, { pct: v[0] ?? 0 })}
                      disabled={!plan}
                      className="flex-1"
                    />
                    <div className="text-right min-w-[88px]">
                      <div className="text-sm font-bold leading-none">{fmt(cpaAff)}</div>
                      <div className="text-[11px] text-muted-foreground">{pct}% del CPA</div>
                    </div>
                  </div>
                </div>
                <div className="col-span-6 md:col-span-1 space-y-1">
                  <Label className="text-xs">FTDs/mes</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    placeholder="0"
                    value={r.ftd}
                    onChange={(e) => updateRow(r.uid, { ftd: e.target.value })}
                  />
                </div>
                <div className="col-span-12 md:col-span-2 flex justify-end">
                  <Button size="icon" variant="ghost" onClick={() => removeRow(r.uid)} disabled={rows.length === 1}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {plan && (
                  <div className="col-span-12 space-y-2 pt-2 border-t">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                      <div className="rounded border bg-background/40 p-2">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          CPA bruto plan
                          <InfoTip text="CPA total acordado con el operador por cada FTD, antes de cualquier retención." />
                        </div>
                        <div className="font-semibold">{fmt(cpaBruto)}</div>
                      </div>
                      <div className="rounded border bg-background/40 p-2">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          Retención Overoption
                          <InfoTip text="Importe que Overoption retiene del CPA bruto antes de calcular lo disponible para el afiliado (overoption_retention del plan)." />
                        </div>
                        <div className="font-semibold">{fmt(retencion)}</div>
                      </div>
                      <div className="rounded border bg-background/40 p-2">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          CPA neto usado
                          <InfoTip text="CPA bruto menos la retención de Overoption. Es el monto efectivo que cobra Overoption del operador y la base sobre la que se calcula el % al afiliado." />
                        </div>
                        <div className="font-semibold">{fmt(cpaNeto)}</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                      <div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          Ingreso Overoption
                          <InfoTip text="CPA neto × FTDs/mes. Lo que Overoption cobra del operador este mes por esta marca." />
                        </div>
                        <div className="font-semibold">{fmt(ingreso)}</div>
                      </div>
                      <div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          CPA pagado al afiliado
                          <InfoTip text="(% del CPA × CPA neto) × FTDs/mes. Parte variable que Overoption paga al afiliado." />
                        </div>
                        <div className="font-semibold">{fmt(pagoVar)}</div>
                      </div>
                      <div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          Spread por FTD
                          <InfoTip text="CPA neto − CPA al afiliado. Margen unitario antes del salario fijo." />
                        </div>
                        <div className="font-semibold">{fmt(cpaNeto - cpaAff)}</div>
                      </div>
                      <div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          Spread mes (sin salario)
                          <InfoTip text="Ingreso Overoption − CPA pagado al afiliado, sin descontar el salario fijo mensual." />
                        </div>
                        <div className={`font-semibold ${margenFila >= 0 ? "text-emerald-600" : "text-destructive"}`}>{fmt(margenFila)}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Resumen mensual</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg border p-3 bg-muted/30">
              <div className="text-xs text-muted-foreground">FTDs/mes totales</div>
              <div className="text-2xl font-bold">{totalFtd}</div>
            </div>
            <div className="rounded-lg border p-3 bg-muted/30">
              <div className="text-xs text-muted-foreground">Ingreso Overoption</div>
              <div className="text-2xl font-bold">{fmt(ingresoOvero)}</div>
            </div>
            <div className="rounded-lg border p-3 bg-muted/30">
              <div className="text-xs text-muted-foreground">Total al afiliado</div>
              <div className="text-2xl font-bold">{fmt(pagoAfiliadoTotal)}</div>
              <div className="text-[11px] text-muted-foreground mt-1">
                {fmt(salaryNum)} salario + {fmt(pagoVarTotal)} CPA
              </div>
            </div>
            <div className={`rounded-lg border p-3 ${margen >= 0 ? "bg-emerald-500/10 border-emerald-500/30" : "bg-destructive/10 border-destructive/30"}`}>
              <div className="text-xs text-muted-foreground">Margen Overoption</div>
              <div className={`text-2xl font-bold ${margen >= 0 ? "text-emerald-600" : "text-destructive"}`}>{fmt(margen)}</div>
              <div className="text-[11px] text-muted-foreground mt-1">{margenPct.toFixed(1)}% sobre ingreso</div>
            </div>
          </div>

          <div className="rounded-lg border p-4 bg-card">
            <div className="flex items-start gap-3">
              <div className={`mt-1 h-8 w-8 rounded-full flex items-center justify-center ${breakEvenViable ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
                {breakEvenViable ? <Badge variant="outline" className="text-xs">BE</Badge> : <AlertTriangle className="h-4 w-4" />}
              </div>
              <div className="flex-1">
                <div className="font-semibold">Break-even</div>
                {breakEvenViable ? (
                  <p className="text-sm text-muted-foreground">
                    Spread promedio ponderado: <strong>{fmt(spreadProm)}</strong> por FTD.
                    Necesitas <strong>{Math.ceil(breakEvenFtds)}</strong> FTDs/mes (al mismo mix de marcas) para cubrir el salario de {fmt(salaryNum)}.
                    {totalFtd > 0 && (
                      <> Proyectas <strong>{totalFtd}</strong> FTDs/mes
                        ({totalFtd >= breakEvenFtds ? "por encima" : "por debajo"} del break-even).</>
                    )}
                  </p>
                ) : (
                  <p className="text-sm text-destructive">
                    El CPA al afiliado promedio iguala o supera el CPA neto del operador. Cada FTD genera pérdida; nunca llega al break-even.
                  </p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
    </TooltipProvider>
  );
}
