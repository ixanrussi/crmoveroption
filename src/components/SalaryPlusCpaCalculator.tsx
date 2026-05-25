import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Copy, FileDown } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import overoptionLogo from "@/assets/overoption-logo.png";

const fmtEur = (n: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(
    isFinite(n) ? n : 0,
  );

const MIN_PCT = 30;
const MAX_PCT = 70;

export default function SalaryPlusCpaCalculator() {
  const [cpaOp, setCpaOp] = useState<string>("20");
  const [capacidad, setCapacidad] = useState<string>("100");
  const [pct, setPct] = useState<number>(50);

  const cpaNum = Math.max(0, parseFloat(cpaOp) || 0);
  const capNum = Math.max(0, parseFloat(capacidad) || 0);
  const presupuesto = cpaNum * capNum;
  const valid = cpaNum > 0 && capNum > 0;

  const salario = (pct / 100) * presupuesto;
  const comisionCpa = capNum > 0 ? (presupuesto - salario) / capNum : 0;

  // Sync: when sliding CPA commission, derive pct
  const cpaMin = capNum > 0 ? (presupuesto - (MAX_PCT / 100) * presupuesto) / capNum : 0; // at 70% salary -> min CPA
  const cpaMax = capNum > 0 ? (presupuesto - (MIN_PCT / 100) * presupuesto) / capNum : 0; // at 30% salary -> max CPA

  const onCpaCommSlider = (val: number) => {
    if (capNum <= 0 || presupuesto <= 0) return;
    const salarioFromComm = presupuesto - val * capNum;
    const newPct = (salarioFromComm / presupuesto) * 100;
    setPct(Math.min(MAX_PCT, Math.max(MIN_PCT, newPct)));
  };

  const proposals = useMemo(() => {
    const pcts = [30, 40, 50, 60, 70];
    return pcts.map((p) => {
      const s = (p / 100) * presupuesto;
      const c = capNum > 0 ? (presupuesto - s) / capNum : 0;
      const minCpas = cpaNum > 0 ? Math.ceil(s / cpaNum) : 0;
      return { pct: p, salario: s, comision: c, total: s + c * capNum, minCpas };
    });
  }, [presupuesto, capNum, cpaNum]);

  const copyProposal = (p: { pct: number; salario: number; comision: number; total: number }) => {
    const text = `Propuesta: Sueldo fijo de ${fmtEur(p.salario)} + ${fmtEur(p.comision)} por cada CPA. Al alcanzar ${capNum} conversiones, ingreso total = ${fmtEur(p.total)}.`;
    navigator.clipboard.writeText(text);
    toast.success("Propuesta copiada al portapapeles");
  };

  // Clamp pct if it falls outside
  useEffect(() => {
    setPct((p) => Math.min(MAX_PCT, Math.max(MIN_PCT, p)));
  }, []);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Datos de entrada</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Label>CPA del operador (€)</Label>
            <Input
              type="number"
              min={1}
              value={cpaOp}
              onChange={(e) => setCpaOp(e.target.value)}
              placeholder="20"
            />
          </div>
          <div className="space-y-1">
            <Label>Capacidad media del afiliado (conversiones/mes)</Label>
            <Input
              type="number"
              min={1}
              value={capacidad}
              onChange={(e) => setCapacidad(e.target.value)}
              placeholder="100"
            />
          </div>
          <div className="md:col-span-2 rounded-lg border p-3 bg-muted/30">
            <div className="text-xs text-muted-foreground">Presupuesto total mensual</div>
            <div className="text-2xl font-bold">{fmtEur(presupuesto)}</div>
            <div className="text-xs text-muted-foreground mt-1">
              CPA operador × Capacidad media = {fmtEur(cpaNum)} × {capNum}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Ajuste de propuesta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <Label>% del presupuesto a sueldo fijo</Label>
              <span className="text-sm font-semibold">{pct.toFixed(0)}%</span>
            </div>
            <Slider
              value={[pct]}
              min={MIN_PCT}
              max={MAX_PCT}
              step={1}
              onValueChange={(v) => setPct(v[0] ?? MIN_PCT)}
              disabled={!valid}
            />
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>{MIN_PCT}%</span>
              <span>{MAX_PCT}%</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <Label>Comisión por CPA (€)</Label>
              <span className="text-sm font-semibold">{fmtEur(comisionCpa)}</span>
            </div>
            <Slider
              value={[comisionCpa]}
              min={cpaMin}
              max={cpaMax}
              step={0.01}
              onValueChange={(v) => onCpaCommSlider(v[0] ?? 0)}
              disabled={!valid}
            />
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>{fmtEur(cpaMin)}</span>
              <span>{fmtEur(cpaMax)}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-lg border p-3 bg-muted/30">
              <div className="text-xs text-muted-foreground">Sueldo fijo</div>
              <div className="text-2xl font-bold">{fmtEur(salario)}</div>
            </div>
            <div className="rounded-lg border p-3 bg-muted/30">
              <div className="text-xs text-muted-foreground">Comisión por CPA</div>
              <div className="text-2xl font-bold">{fmtEur(comisionCpa)}</div>
            </div>
            <div className="rounded-lg border p-3 bg-primary/10 border-primary/30">
              <div className="text-xs text-muted-foreground">Total si cumple capacidad</div>
              <div className="text-2xl font-bold">{fmtEur(salario + comisionCpa * capNum)}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Propuestas predefinidas</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>% Sueldo fijo</TableHead>
                <TableHead>CPAs mín. para cubrir salario</TableHead>
                <TableHead>Sueldo fijo</TableHead>
                <TableHead>Comisión por CPA</TableHead>
                <TableHead>Total a pagar</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {proposals.map((p) => (
                <TableRow
                  key={p.pct}
                  className="cursor-pointer"
                  onClick={() => copyProposal(p)}
                >
                  <TableCell className="font-medium">{p.pct}%</TableCell>
                  <TableCell>{p.minCpas}</TableCell>
                  <TableCell>{fmtEur(p.salario)}</TableCell>
                  <TableCell>{fmtEur(p.comision)}</TableCell>
                  <TableCell>{fmtEur(p.total)}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); copyProposal(p); }}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="text-xs text-muted-foreground mt-3">
            Haz clic en cualquier fila para copiar el texto de propuesta al portapapeles.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
