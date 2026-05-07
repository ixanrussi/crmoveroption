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
  fallback_cpa: number | null;
  cpa_at_80: number | null;
  cpa_at_90: number | null;
  proportional_enabled: boolean | null;
  proportional_min_pct: number | null;
  country_ids: string[] | null;
  fixed_margin_pct: number | null;
};

type Operator = {
  id: string;
  company_name: string;
  net_min_cpa: number | null;
  country_ids: string[] | null;
  client_commission_plans: Plan[];
};

const fmt = (n: number, currency?: string | null) =>
  new Intl.NumberFormat("es-ES", {
    style: currency ? "currency" : "decimal",
    currency: currency || undefined,
    maximumFractionDigits: 2,
  }).format(n);

type Country = { id: string; name: string; code: string | null };

export default function CalculadoraFijos() {
  const [operators, setOperators] = useState<Operator[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [countryId, setCountryId] = useState<string>("all");
  const [opId, setOpId] = useState<string>("");
  const [planId, setPlanId] = useState<string>("");
  const [ftdTarget, setFtdTarget] = useState<string>("");
  const [fixedAmount, setFixedAmount] = useState<string>("");
  const [ftdActual, setFtdActual] = useState<string>("");
  const [prospectName, setProspectName] = useState<string>("");

  const handlePrint = () => window.print();

  useEffect(() => {
    (async () => {
      const [{ data: ops }, { data: cs }] = await Promise.all([
        supabase
          .from("clients")
          .select("id, company_name, net_min_cpa, country_ids, client_commission_plans(id, description, brand, currency, cpa, overoption_retention, fallback_cpa, cpa_at_80, cpa_at_90, proportional_enabled, proportional_min_pct, country_ids, fixed_margin_pct)")
          .order("company_name"),
        supabase.from("countries").select("id, name, code").order("name"),
      ]);
      setOperators((ops ?? []) as any);
      setCountries((cs ?? []) as any);
    })();
  }, []);

  const wwId = countries.find((c) => c.code === "WW" || c.name.toLowerCase().includes("world"))?.id;
  const latamId = countries.find((c) => c.name.toLowerCase() === "latam")?.id;
  const latamCountryIds = useMemo(
    () => countries.filter((c) => c.id !== wwId && c.id !== latamId && c.name.toLowerCase() !== "españa").map((c) => c.id),
    [countries, wwId, latamId],
  );
  const matchesSelected = (ids: string[] | null | undefined): boolean => {
    if (countryId === "all") return true;
    const arr = ids ?? [];
    // WW selected: only operators/plans explícitamente marcados como WW
    if (wwId && countryId === wwId) return arr.includes(wwId);
    // Cualquier otro país/región: WW siempre aplica (opera en todos)
    if (wwId && arr.includes(wwId)) return true;
    // Expandir LATAM en los ids del operador/plan
    const expanded = new Set<string>(arr);
    if (latamId && arr.includes(latamId)) latamCountryIds.forEach((id) => expanded.add(id));
    // LATAM seleccionado: aceptar si tiene LATAM o cualquier país de LATAM
    if (latamId && countryId === latamId) {
      if (arr.includes(latamId)) return true;
      return latamCountryIds.some((id) => expanded.has(id));
    }
    return expanded.has(countryId);
  };

  const filteredOperators = useMemo(() => {
    if (countryId === "all") return operators;
    return operators.filter((o: any) => {
      const opHas = matchesSelected(o.country_ids);
      if (!opHas) return false;
      const plans = o.client_commission_plans ?? [];
      const planHas = plans.some((p: Plan) => matchesSelected(p.country_ids));
      return planHas;
    });
  }, [operators, countryId, countries, wwId, latamId, latamCountryIds]);

  const operator = filteredOperators.find((o) => o.id === opId);
  const filteredPlans = useMemo(() => {
    if (!operator) return [];
    return operator.client_commission_plans;
  }, [operator]);
  const plan = filteredPlans.find((p) => p.id === planId);

  const cpaBruto = plan?.cpa ?? 0;
  const retencion = plan?.overoption_retention ?? 0;
  const cpaNeto = Math.max(0, cpaBruto - retencion);
  const fallbackCpa = plan?.fallback_cpa ?? operator?.net_min_cpa ?? 0;
  const cpa80 = plan?.cpa_at_80 ?? 0;
  const cpa90 = plan?.cpa_at_90 ?? 0;
  const proportionalEnabled = !!plan?.proportional_enabled;
  const proportionalMinPct = plan?.proportional_min_pct ?? 0;

  const ftdT = parseFloat(ftdTarget) || 0;
  const fixed = parseFloat(fixedAmount) || 0;
  const ftdA = ftdActual === "" ? ftdT : (parseFloat(ftdActual) || 0);

  const calc = useMemo(() => {
    if (!plan || ftdT <= 0) return null;
    const cpaEfectivoObjetivo = fixed / ftdT;
    const maxFijoPosible = cpaNeto * ftdT;
    const pct = ftdA / ftdT;
    const cumplio = pct >= 1;
    let cpaTier = 0;
    let tierLabel = "";
    let pagoReal = 0;
    if (cumplio) {
      tierLabel = "Objetivo alcanzado (100%)";
      pagoReal = fixed;
    } else if (proportionalEnabled) {
      const minPct = (proportionalMinPct || 0) / 100;
      const appliedPct = Math.max(pct, minPct);
      cpaTier = cpaNeto * appliedPct;
      tierLabel = `Proporcional (${(appliedPct * 100).toFixed(0)}% del CPA${minPct > pct ? ` · piso ${(minPct*100).toFixed(0)}%` : ""})`;
      pagoReal = ftdA * cpaTier;
    } else if (pct >= 0.9 && cpa90 > 0) {
      cpaTier = cpa90;
      tierLabel = "≥ 90% del objetivo";
      pagoReal = ftdA * cpaTier;
    } else if (pct >= 0.8 && cpa80 > 0) {
      cpaTier = cpa80;
      tierLabel = "≥ 80% del objetivo";
      pagoReal = ftdA * cpaTier;
    } else {
      cpaTier = fallbackCpa;
      tierLabel = "Bajo objetivo (fallback)";
      pagoReal = ftdA * cpaTier;
    }
    const cpaEfectivoReal = ftdA > 0 ? pagoReal / ftdA : 0;
    return { cpaEfectivoObjetivo, maxFijoPosible, cumplio, pagoReal, cpaEfectivoReal, tierLabel, cpaTier };
  }, [plan, ftdT, fixed, ftdA, cpaNeto, fallbackCpa, cpa80, cpa90, proportionalEnabled, proportionalMinPct]);

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
              <Label>País / región</Label>
              <Select value={countryId} onValueChange={(v) => { setCountryId(v); setOpId(""); setPlanId(""); }}>
                <SelectTrigger><SelectValue placeholder="Seleccionar país o región" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Seleccionar país o región</SelectItem>
                  {countries.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Operador</Label>
              <Select value={opId} onValueChange={(v) => { setOpId(v); setPlanId(""); }}>
                <SelectTrigger><SelectValue placeholder={filteredOperators.length ? "Selecciona un operador" : "Sin operadores para el país"} /></SelectTrigger>
                <SelectContent>
                  {filteredOperators.map((o) => (
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
                  {filteredPlans.map((p) => (
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
                  {[
                    { label: "CPA neto disponible por FTD", value: cpaNeto },
                    { label: "CPA fallback (bajo objetivo)", value: fallbackCpa, fallbackBadge: true },
                    { label: "CPA al ≥90% del objetivo", value: cpa90 },
                    { label: "CPA al ≥80% del objetivo", value: cpa80 },
                  ]
                    .sort((a, b) => (b.value || 0) - (a.value || 0))
                    .map((r) => (
                      <div key={r.label} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{r.label}</span>
                        <span className="font-semibold">
                          {r.value > 0
                            ? fmt(r.value, plan.currency)
                            : r.fallbackBadge
                              ? <Badge variant="destructive">No configurado</Badge>
                              : <span className="text-muted-foreground">— usa fallback</span>}
                        </span>
                      </div>
                    ))}
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
                          {calc.tierLabel}
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
                      {!calc.cumplio && calc.cpaTier === 0 && (
                        <p className="text-xs text-destructive">
                          ⚠ No hay CPA configurado para este escenario. Edita el Commission Plan del Operador.
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
