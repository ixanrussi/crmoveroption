import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calculator, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

type Plan = {
  id: string;
  description: string | null;
  brand: string | null;
  currency: string | null;
  cpa: number | null;
  overoption_retention: number | null;
  country_ids: string[] | null;
};

type Operator = {
  id: string;
  company_name: string;
  net_min_cpa: number | null;
  client_commission_plans: Plan[];
};

const fmt = (n: number, currency?: string | null) =>
  new Intl.NumberFormat("es-ES", {
    style: currency ? "currency" : "decimal",
    currency: currency || undefined,
    maximumFractionDigits: 2,
  }).format(n);

export default function CalculadoraFijos() {
  const [operators, setOperators] = useState<Operator[]>([]);
  const [opId, setOpId] = useState<string>("");
  const [planId, setPlanId] = useState<string>("");
  const [ftdTarget, setFtdTarget] = useState<string>("");
  const [fixedAmount, setFixedAmount] = useState<string>("");
  const [ftdActual, setFtdActual] = useState<string>("");
  const [prospectName, setProspectName] = useState<string>("");

  const handlePrint = () => window.print();

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, company_name, net_min_cpa, client_commission_plans(id, description, brand, currency, cpa, overoption_retention, country_ids)")
        .order("company_name");
      setOperators((data ?? []) as any);
    })();
  }, []);

  const operator = operators.find((o) => o.id === opId);
  const plan = operator?.client_commission_plans.find((p) => p.id === planId);

  const cpaBruto = plan?.cpa ?? 0;
  const retencion = plan?.overoption_retention ?? 0;
  const cpaNeto = Math.max(0, cpaBruto - retencion); // valor neto disponible para el afiliado
  const netMin = operator?.net_min_cpa ?? 0;

  const ftdT = parseFloat(ftdTarget) || 0;
  const fixed = parseFloat(fixedAmount) || 0;
  const ftdA = ftdActual === "" ? ftdT : (parseFloat(ftdActual) || 0);

  const calc = useMemo(() => {
    if (!plan || ftdT <= 0) return null;
    const cpaEfectivoObjetivo = fixed / ftdT; // CPA neto efectivo si cumple objetivo
    const maxFijoPosible = cpaNeto * ftdT; // tope para no exceder CPA neto
    const cumplio = ftdA >= ftdT;
    const pagoReal = cumplio ? fixed : ftdA * netMin;
    const cpaEfectivoReal = ftdA > 0 ? pagoReal / ftdA : 0;
    return { cpaEfectivoObjetivo, maxFijoPosible, cumplio, pagoReal, cpaEfectivoReal };
  }, [plan, ftdT, fixed, ftdA, cpaNeto, netMin]);

  return (
    <div className="space-y-6">
      <style>{`@media print {
        body * { visibility: hidden; }
        #print-area, #print-area * { visibility: visible; }
        #print-area { position: absolute; left: 0; top: 0; width: 100%; padding: 24px; }
        .no-print { display: none !important; }
      }`}</style>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calculator className="h-6 w-6" /> Calculadora de Fijos
          </h1>
          <p className="text-muted-foreground text-sm">
            Simula el valor fijo a ofrecer a un afiliado en base a FTDs comprometidos.
          </p>
        </div>
        <Button onClick={handlePrint} variant="outline" className="no-print" disabled={!plan}>
          <Printer className="h-4 w-4 mr-2" /> Imprimir / Exportar PDF
        </Button>
      </div>

      <div className="space-y-1 max-w-md">
        <Label>Nombre del afiliado prospecto (opcional)</Label>
        <Input
          placeholder="Ej. Juan Pérez / AffiliateXYZ"
          value={prospectName}
          onChange={(e) => setProspectName(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-lg">Parámetros</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label>Operador</Label>
              <Select value={opId} onValueChange={(v) => { setOpId(v); setPlanId(""); }}>
                <SelectTrigger><SelectValue placeholder="Selecciona un operador" /></SelectTrigger>
                <SelectContent>
                  {operators.map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.company_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Commission Plan (marca / país)</Label>
              <Select value={planId} onValueChange={setPlanId} disabled={!operator}>
                <SelectTrigger><SelectValue placeholder={operator ? "Selecciona un plan" : "Primero elige operador"} /></SelectTrigger>
                <SelectContent>
                  {(operator?.client_commission_plans ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.description || "Sin nombre"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>FTDs objetivo</Label>
                <Input type="number" min="0" value={ftdTarget} onChange={(e) => setFtdTarget(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Valor fijo ofrecido</Label>
                <Input type="number" min="0" step="0.01" value={fixedAmount} onChange={(e) => setFixedAmount(e.target.value)} placeholder={plan && ftdT > 0 ? String((cpaNeto * ftdT).toFixed(2)) : ""} />
                {plan && ftdT > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Referencia (CPA neto × FTDs): <button type="button" className="underline" onClick={() => setFixedAmount(String((cpaNeto * ftdT).toFixed(2)))}>{fmt(cpaNeto * ftdT, plan.currency)}</button>
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <Label>FTDs reales (simulación)</Label>
              <Input type="number" min="0" placeholder={`Por defecto = objetivo (${ftdT || 0})`}
                value={ftdActual} onChange={(e) => setFtdActual(e.target.value)} />
              <p className="text-xs text-muted-foreground">Cambia para ver el escenario si el afiliado no cumple.</p>
            </div>
          </CardContent>
        </Card>

        <Card id="print-area">
          <CardHeader>
            <CardTitle className="text-lg">
              Oferta {prospectName ? `para ${prospectName}` : "— Resultado"}
            </CardTitle>
            {prospectName && operator && (
              <p className="text-sm text-muted-foreground">
                Operador: {operator.company_name}
                {plan?.brand ? ` · ${plan.brand}` : ""}
                {plan?.description ? ` · ${plan.description}` : ""}
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {!plan ? (
              <p className="text-sm text-muted-foreground">Selecciona un operador y un plan para ver el cálculo.</p>
            ) : (
              <>
                <div className="rounded-lg border p-3 space-y-2 bg-muted/30">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">CPA neto disponible por FTD</span>
                    <span className="font-semibold">{fmt(cpaNeto, plan.currency)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">CPA neto mínimo (bajo objetivo)</span>
                    <span className="font-semibold">
                      {netMin > 0 ? fmt(netMin, plan.currency) : <Badge variant="destructive">No configurado</Badge>}
                    </span>
                  </div>
                </div>

                {calc && (
                  <>
                    <div className="rounded-lg border p-4 space-y-3">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">Si cumple el objetivo</div>
                      <div className="flex justify-between items-baseline">
                        <span className="text-sm">Pago al afiliado</span>
                        <span className="text-2xl font-bold">{fmt(fixed, plan.currency)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">CPA neto efectivo (fijo / FTDs)</span>
                        <span className={`font-semibold ${calc.cpaEfectivoObjetivo > cpaNeto ? "text-destructive" : ""}`}>
                          {fmt(calc.cpaEfectivoObjetivo, plan.currency)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Fijo máximo recomendado</span>
                        <span className="font-semibold">{fmt(calc.maxFijoPosible, plan.currency)}</span>
                      </div>
                      {calc.cpaEfectivoObjetivo > cpaNeto && (
                        <p className="text-xs text-destructive">
                          ⚠ El fijo ofrecido excede el CPA neto disponible. Reduce el valor o aumenta el objetivo de FTDs.
                        </p>
                      )}
                    </div>

                    <div className="rounded-lg border p-4 space-y-3">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                        Escenario real
                        <Badge variant={calc.cumplio ? "default" : "secondary"}>
                          {calc.cumplio ? "Objetivo alcanzado" : "Bajo objetivo"}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <span className="text-sm">Pago al afiliado ({ftdA} FTDs)</span>
                        <span className="text-2xl font-bold">{fmt(calc.pagoReal, plan.currency)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">CPA neto efectivo</span>
                        <span className="font-semibold">{fmt(calc.cpaEfectivoReal, plan.currency)}</span>
                      </div>
                      {!calc.cumplio && netMin === 0 && (
                        <p className="text-xs text-destructive">
                          ⚠ El operador no tiene CPA neto mínimo configurado. Edítalo en la ficha del Operador.
                        </p>
                      )}
                    </div>
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
