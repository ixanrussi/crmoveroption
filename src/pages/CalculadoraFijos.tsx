import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calculator, Printer, Share2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

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

type Selection = {
  uid: string;
  opId: string;
  planId: string;
  ftdTarget: string;
  ftdActual: string;
};

const newSelection = (): Selection => ({
  uid: Math.random().toString(36).slice(2),
  opId: "", planId: "", ftdTarget: "", ftdActual: "",
});

export default function CalculadoraFijos() {
  const [operators, setOperators] = useState<Operator[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [countryId, setCountryId] = useState<string>("all");
  const [selections, setSelections] = useState<Selection[]>([newSelection()]);
  const [prospectName, setProspectName] = useState<string>("");

  const handlePrint = () => window.print();

  const buildPdf = async (): Promise<{ blob: Blob; fileName: string } | null> => {
    const el = document.getElementById("print-area");
    if (!el) return null;
    const canvas = await html2canvas(el, { scale: 2, backgroundColor: "#ffffff" });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 24;
    const imgW = pageW - margin * 2;
    const imgH = (canvas.height * imgW) / canvas.width;
    let heightLeft = imgH;
    let position = margin;
    pdf.addImage(imgData, "PNG", margin, position, imgW, imgH);
    heightLeft -= pageH - margin * 2;
    while (heightLeft > 0) {
      position = margin - (imgH - heightLeft);
      pdf.addPage();
      pdf.addImage(imgData, "PNG", margin, position, imgW, imgH);
      heightLeft -= pageH - margin * 2;
    }
    const safe = (prospectName || "afiliado").replace(/[^a-z0-9-_]+/gi, "_");
    const fileName = `oferta-fijo-${safe}.pdf`;
    return { blob: pdf.output("blob"), fileName };
  };

  const handleShare = async () => {
    try {
      const result = await buildPdf();
      if (!result) return;
      const { blob, fileName } = result;
      const file = new File([blob], fileName, { type: "application/pdf" });
      const nav = navigator as any;
      if (nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({
          files: [file],
          title: "Oferta de Fijo",
          text: prospectName ? `Oferta para ${prospectName}` : "Oferta de Fijo",
        });
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = fileName; a.click();
      URL.revokeObjectURL(url);
      toast.info("PDF descargado. Adjúntalo en WhatsApp o email para compartir.");
    } catch (e: any) {
      if (e?.name !== "AbortError") toast.error("No se pudo compartir el PDF");
    }
  };

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
    if (wwId && countryId === wwId) return arr.includes(wwId);
    if (wwId && arr.includes(wwId)) return true;
    const expanded = new Set<string>(arr);
    if (latamId && arr.includes(latamId)) latamCountryIds.forEach((id) => expanded.add(id));
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

  const updateSelection = (uid: string, patch: Partial<Selection>) =>
    setSelections((prev) => prev.map((s) => (s.uid === uid ? { ...s, ...patch } : s)));
  const addSelection = () => setSelections((prev) => [...prev, newSelection()]);
  const removeSelection = (uid: string) =>
    setSelections((prev) => (prev.length === 1 ? prev : prev.filter((s) => s.uid !== uid)));

  const computeRow = (sel: Selection) => {
    const operator = filteredOperators.find((o) => o.id === sel.opId);
    const plan = operator?.client_commission_plans.find((p) => p.id === sel.planId);
    if (!plan || !operator) return null;
    const cpaBruto = plan.cpa ?? 0;
    const retencion = plan.overoption_retention ?? 0;
    const cpaNeto = Math.max(0, cpaBruto - retencion);
    const fallbackCpa = plan.fallback_cpa ?? operator.net_min_cpa ?? 0;
    const cpa80 = plan.cpa_at_80 ?? 0;
    const cpa90 = plan.cpa_at_90 ?? 0;
    const proportionalEnabled = !!plan.proportional_enabled;
    const proportionalMinPct = plan.proportional_min_pct ?? 0;
    const fixedMarginPct = plan.fixed_margin_pct ?? 0;
    const ftdT = parseFloat(sel.ftdTarget) || 0;
    const ftdA = sel.ftdActual === "" ? ftdT : (parseFloat(sel.ftdActual) || 0);
    const fixed = cpaNeto * ftdT;
    const marginFactor = Math.max(0, 1 - fixedMarginPct / 100);
    const fijoRecomendado = fixed * marginFactor;

    let cpaTier = 0; let tierLabel = ""; let pagoReal = 0;
    if (ftdT > 0) {
      const pct = ftdA / ftdT;
      const cumplio = pct >= 1;
      if (cumplio) { tierLabel = "Objetivo alcanzado (100%)"; pagoReal = fixed; }
      else if (proportionalEnabled) {
        const minPct = proportionalMinPct / 100;
        const appliedPct = Math.max(pct, minPct);
        cpaTier = cpaNeto * appliedPct;
        tierLabel = `Proporcional (${(appliedPct * 100).toFixed(0)}% del CPA)`;
        pagoReal = ftdA * cpaTier;
      } else if (pct >= 0.9 && cpa90 > 0) { cpaTier = cpa90; tierLabel = "≥ 90% del objetivo"; pagoReal = ftdA * cpaTier; }
      else if (pct >= 0.8 && cpa80 > 0) { cpaTier = cpa80; tierLabel = "≥ 80% del objetivo"; pagoReal = ftdA * cpaTier; }
      else { cpaTier = fallbackCpa; tierLabel = "Bajo objetivo (fallback)"; pagoReal = ftdA * cpaTier; }
    }
    const pagoRealAfiliado = pagoReal * marginFactor;
    return {
      sel, operator, plan, cpaNeto, fallbackCpa, cpa80, cpa90, fixedMarginPct,
      ftdT, ftdA, fixed, fijoRecomendado, pagoReal, pagoRealAfiliado, tierLabel, cpaTier,
    };
  };

  const rows = selections.map(computeRow).filter(Boolean) as NonNullable<ReturnType<typeof computeRow>>[];
  const validRows = rows.filter((r) => r.ftdT > 0);

  // Tasas de cambio aproximadas a USD para consolidar la oferta en una sola moneda
  const FX_TO_USD: Record<string, number> = { USD: 1, EUR: 1.08, GBP: 1.27, BRL: 0.20, MXN: 0.055, ARS: 0.001 };
  const toUsd = (amount: number, currency?: string | null) => {
    const cur = (currency || "USD").toUpperCase();
    const rate = FX_TO_USD[cur] ?? 1;
    return amount * rate;
  };
  const totalFijoUsd = useMemo(
    () => validRows.reduce((s, r) => s + toUsd(r.fijoRecomendado, r.plan.currency), 0),
    [validRows],
  );

  const hasAny = validRows.length > 0;

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
            Simula el valor fijo a ofrecer a un afiliado en base a CPAs comprometidos por uno o varios operadores.
          </p>
        </div>
        <div className="flex gap-2 no-print">
          <Button onClick={handleShare} variant="default" disabled={!hasAny}>
            <Share2 className="h-4 w-4 mr-2" /> Compartir
          </Button>
          <Button onClick={handlePrint} variant="outline" disabled={!hasAny}>
            <Printer className="h-4 w-4 mr-2" /> Imprimir / Exportar PDF
          </Button>
        </div>
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
              <Select value={countryId} onValueChange={(v) => {
                setCountryId(v);
                setSelections((prev) => prev.map((s) => ({ ...s, opId: "", planId: "" })));
              }}>
                <SelectTrigger><SelectValue placeholder="Seleccionar país o región" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Seleccionar país o región</SelectItem>
                  {countries.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selections.map((sel, idx) => {
              const operator = filteredOperators.find((o) => o.id === sel.opId);
              const plans = operator?.client_commission_plans ?? [];
              const plan = plans.find((p) => p.id === sel.planId);
              const cpaBruto = plan?.cpa ?? 0;
              const retencion = plan?.overoption_retention ?? 0;
              const cpaNeto = Math.max(0, cpaBruto - retencion);
              const fixedMarginPct = plan?.fixed_margin_pct ?? 0;
              const ftdT = parseFloat(sel.ftdTarget) || 0;
              const fijoRec = cpaNeto * ftdT * Math.max(0, 1 - fixedMarginPct / 100);

              return (
                <div key={sel.uid} className="rounded-lg border p-3 space-y-3 relative">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground uppercase">Operador {idx + 1}</span>
                    {selections.length > 1 && (
                      <Button variant="ghost" size="sm" onClick={() => removeSelection(sel.uid)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <div className="space-y-1">
                    <Label>Operador</Label>
                    <Select value={sel.opId} onValueChange={(v) => updateSelection(sel.uid, { opId: v, planId: "" })}>
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
                    <Select value={sel.planId} onValueChange={(v) => updateSelection(sel.uid, { planId: v })} disabled={!operator}>
                      <SelectTrigger><SelectValue placeholder={operator ? "Selecciona un plan" : "Primero elige operador"} /></SelectTrigger>
                      <SelectContent>
                        {plans.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.description || "Sin nombre"}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>CPAs objetivo</Label>
                      <Input type="number" min="0" value={sel.ftdTarget}
                        onChange={(e) => updateSelection(sel.uid, { ftdTarget: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label>Fijo recomendado</Label>
                      <Input type="text" readOnly tabIndex={-1} className="bg-muted cursor-not-allowed"
                        value={plan && ftdT > 0 ? fmt(fijoRec, plan.currency) : ""} placeholder="" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label>CPAs reales (simulación)</Label>
                    <Input type="number" min="0" placeholder={`Por defecto = objetivo (${ftdT || 0})`}
                      value={sel.ftdActual} onChange={(e) => updateSelection(sel.uid, { ftdActual: e.target.value })} />
                  </div>
                </div>
              );
            })}

            <Button variant="outline" onClick={addSelection} className="w-full">
              <Plus className="h-4 w-4 mr-2" /> Añadir otro operador
            </Button>
          </CardContent>
        </Card>

        <Card id="print-area">
          <CardHeader>
            <CardTitle className="text-lg">
              Oferta {prospectName ? `para ${prospectName}` : "— Resultado"}
            </CardTitle>
            {prospectName && validRows.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {validRows.map((r) => `${r.operator.company_name}${r.plan.brand ? " · " + r.plan.brand : ""}`).join(" + ")}
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {!hasAny ? (
              <p className="text-sm text-muted-foreground">Selecciona al menos un operador, plan y CPAs objetivo para ver el cálculo.</p>
            ) : (
              <>
                {totalFijoUsd > 0 && (
                  <div className="rounded-lg border-2 border-primary/40 p-4 space-y-2 bg-primary/5">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Fijo total recomendado al afiliado</div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-sm text-muted-foreground">USD</span>
                      <span className="text-2xl font-bold">{fmt(totalFijoUsd, "USD")}</span>
                    </div>
                    <div className="text-xs text-muted-foreground pt-1 border-t">
                      Total CPAs objetivo: <span className="font-semibold text-foreground">{validRows.reduce((s, r) => s + r.ftdT, 0)}</span>
                    </div>
                  </div>
                )}

                {validRows.map((r, i) => (
                  <div key={r.sel.uid} className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="font-semibold">{r.operator.company_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.plan.brand ? `${r.plan.brand} · ` : ""}{r.plan.description || ""}
                        </div>
                      </div>
                      <Badge variant="outline">{r.ftdT} CPAs objetivo</Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm pt-2 border-t">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">CPA neto</span>
                        <span className="font-semibold">{fmt(r.cpaNeto, r.plan.currency)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Fijo recomendado</span>
                        <span className="font-semibold">{fmt(r.fijoRecomendado, r.plan.currency)}</span>
                      </div>
                    </div>

                    {r.tierLabel && (
                      <div className="pt-2 border-t space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground uppercase">Escenario real</span>
                          <Badge variant={r.ftdA >= r.ftdT ? "default" : "secondary"}>{r.tierLabel}</Badge>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Pago al afiliado ({r.ftdA} CPAs)</span>
                          <span className="font-semibold">{fmt(r.pagoRealAfiliado, r.plan.currency)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
