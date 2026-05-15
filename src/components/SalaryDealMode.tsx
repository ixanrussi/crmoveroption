import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, AlertTriangle } from "lucide-react";

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
};

const newRow = (): Row => ({
  uid: Math.random().toString(36).slice(2),
  opId: "",
  planId: "",
  ftd: "",
});

const fmt = (n: number) =>
  new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Math.round(isFinite(n) ? n : 0));

export default function SalaryDealMode({ operators }: { operators: Operator[] }) {
  const [salary, setSalary] = useState<string>("");
  const [cpaAffiliate, setCpaAffiliate] = useState<string>("");
  const [rows, setRows] = useState<Row[]>([newRow()]);

  const salaryNum = parseFloat(salary) || 0;
  const cpaAff = parseFloat(cpaAffiliate) || 0;

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
      const ingreso = cpaNeto * ftd;
      const pagoVar = cpaAff * ftd;
      return { r, op, plan, cpaNeto, ftd, ingreso, pagoVar };
    });
  }, [rows, operators, cpaAff]);

  const totalFtd = computed.reduce((s, x) => s + x.ftd, 0);
  const ingresoOvero = computed.reduce((s, x) => s + x.ingreso, 0);
  const pagoVarTotal = computed.reduce((s, x) => s + x.pagoVar, 0);
  const pagoAfiliadoTotal = salaryNum + pagoVarTotal;
  const margen = ingresoOvero - pagoAfiliadoTotal;
  const margenPct = ingresoOvero > 0 ? (margen / ingresoOvero) * 100 : 0;

  // Break-even: FTDs/mes mínimos para que margen = 0
  // ingreso(FTDs) - (salario + cpaAff*FTDs) = 0  →  FTDs = salario / (cpaNetoPromedio - cpaAff)
  const cpaNetoPromedio = totalFtd > 0 ? ingresoOvero / totalFtd : 0;
  const spreadUnit = cpaNetoPromedio - cpaAff;
  const breakEvenFtds = spreadUnit > 0 ? salaryNum / spreadUnit : Infinity;
  const breakEvenViable = isFinite(breakEvenFtds) && spreadUnit > 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Propuesta Overoption</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
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
          <div className="space-y-1">
            <Label>CPA al afiliado por FTD (USD)</Label>
            <Input
              type="number"
              inputMode="numeric"
              placeholder="Ej. 80"
              value={cpaAffiliate}
              onChange={(e) => setCpaAffiliate(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Mismo monto para todos los operadores. Se paga por cada FTD generado.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Operadores y FTDs/mes esperados</CardTitle>
          <Button size="sm" variant="outline" onClick={addRow}>
            <Plus className="h-4 w-4 mr-1" /> Añadir operador
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {computed.map(({ r, op, plan, cpaNeto, ftd, ingreso, pagoVar }) => {
            const margenFila = ingreso - pagoVar; // sin contar el salario
            return (
              <div key={r.uid} className="grid grid-cols-12 gap-2 items-end border rounded-lg p-3 bg-muted/20">
                <div className="col-span-12 md:col-span-4 space-y-1">
                  <Label className="text-xs">Operador</Label>
                  <Select value={r.opId} onValueChange={(v) => updateRow(r.uid, { opId: v, planId: "" })}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      {operators.map((o) => (
                        <SelectItem key={o.id} value={o.id}>{o.company_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-12 md:col-span-4 space-y-1">
                  <Label className="text-xs">Plan</Label>
                  <Select
                    value={r.planId}
                    onValueChange={(v) => updateRow(r.uid, { planId: v })}
                    disabled={!op}
                  >
                    <SelectTrigger><SelectValue placeholder={op ? "Seleccionar plan" : "Elige operador"} /></SelectTrigger>
                    <SelectContent>
                      {op?.client_commission_plans.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {(p.brand ? p.brand + " · " : "") + (p.description || "Plan")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-6 md:col-span-2 space-y-1">
                  <Label className="text-xs">FTDs/mes</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    placeholder="0"
                    value={r.ftd}
                    onChange={(e) => updateRow(r.uid, { ftd: e.target.value })}
                  />
                </div>
                <div className="col-span-6 md:col-span-2 flex justify-end">
                  <Button size="icon" variant="ghost" onClick={() => removeRow(r.uid)} disabled={rows.length === 1}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {plan && (
                  <div className="col-span-12 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs pt-2 border-t">
                    <div>
                      <div className="text-muted-foreground">CPA neto operador</div>
                      <div className="font-semibold">{fmt(cpaNeto)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Ingreso Overoption</div>
                      <div className="font-semibold">{fmt(ingreso)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">CPA pagado al afiliado</div>
                      <div className="font-semibold">{fmt(pagoVar)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Spread (sin salario)</div>
                      <div className={`font-semibold ${margenFila >= 0 ? "text-emerald-600" : "text-destructive"}`}>{fmt(margenFila)}</div>
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
                    Con un CPA neto promedio de <strong>{fmt(cpaNetoPromedio)}</strong> y un CPA al afiliado de <strong>{fmt(cpaAff)}</strong>,
                    Overoption gana <strong>{fmt(spreadUnit)}</strong> por cada FTD.
                    Necesita <strong>{Math.ceil(breakEvenFtds)}</strong> FTDs/mes para cubrir el salario de {fmt(salaryNum)}.
                    {totalFtd > 0 && (
                      <> Actualmente proyectas <strong>{totalFtd}</strong> FTDs/mes
                        ({totalFtd >= breakEvenFtds ? "por encima" : "por debajo"} del break-even).</>
                    )}
                  </p>
                ) : (
                  <p className="text-sm text-destructive">
                    El CPA al afiliado ({fmt(cpaAff)}) es mayor o igual al CPA neto promedio del operador ({fmt(cpaNetoPromedio)}).
                    Cada FTD genera pérdida; nunca llega al break-even. Reduce el CPA al afiliado o cambia de operador/plan.
                  </p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
