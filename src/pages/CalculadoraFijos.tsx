import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calculator, Printer, Share2, Plus, Trash2, Save, History, Trash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import SalaryPlusCpaCalculator from "@/components/SalaryPlusCpaCalculator";


import jsPDF from "jspdf";

import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import overoptionLogo from "@/assets/overoption-logo.png";

const OO_MARGIN_PCT = 30;


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
  recommended_margin_pct: number | null;
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
    maximumFractionDigits: 0,
  }).format(Math.round(n));

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

type SavedSimulation = {
  id: string;
  name: string;
  prospect_name: string | null;
  country_id: string | null;
  selections: Selection[];
  total_fijo_usd: number;
  created_at: string;
};

export default function CalculadoraFijos() {
  const { user, isSuperAdmin } = useAuth();
  const [operators, setOperators] = useState<Operator[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [simName, setSimName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<SavedSimulation[]>([]);
  const [countryId, setCountryId] = useState<string>("all");
  const [selections, setSelections] = useState<Selection[]>([newSelection()]);
  const [prospectName, setProspectName] = useState<string>("");
  const [proposalPct, setProposalPct] = useState<number>(0); // 0 = recomendado, 100 = máximo
  

  const handlePrint = async () => {
    const result = await buildPdf();
    if (!result) return;
    const url = URL.createObjectURL(result.blob);
    const w = window.open(url, "_blank");
    if (w) {
      w.addEventListener("load", () => {
        try { w.focus(); w.print(); } catch { /* noop */ }
      });
    } else {
      const a = document.createElement("a");
      a.href = url; a.download = result.fileName; a.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const loadLogoDataUrl = async (): Promise<{ dataUrl: string; w: number; h: number } | null> => {
    try {
      const res = await fetch(overoptionLogo);
      const blob = await res.blob();
      const dataUrl: string = await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result as string);
        fr.onerror = reject;
        fr.readAsDataURL(blob);
      });
      const img = new Image();
      img.src = dataUrl;
      await new Promise((r) => { img.onload = r; img.onerror = r; });
      return { dataUrl, w: img.width || 400, h: img.height || 100 };
    } catch {
      return null;
    }
  };

  const buildPdf = async (): Promise<{ blob: Blob; fileName: string } | null> => {
    if (!hasAny) return null;
    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 40;

    // Paleta
    const COL_PRIMARY: [number, number, number] = [37, 99, 235]; // azul
    const COL_DARK: [number, number, number] = [15, 23, 42];
    const COL_MUTED: [number, number, number] = [100, 116, 139];
    const COL_BORDER: [number, number, number] = [226, 232, 240];
    const COL_BG_SOFT: [number, number, number] = [248, 250, 252];

    // Banda superior
    pdf.setFillColor(...COL_PRIMARY);
    pdf.rect(0, 0, pageW, 6, "F");

    // Logo
    const logo = await loadLogoDataUrl();
    let headerBottom = margin;
    if (logo) {
      const logoH = 36;
      const logoW = logoH * (logo.w / logo.h);
      pdf.addImage(logo.dataUrl, "PNG", margin, margin, logoW, logoH);
      headerBottom = margin + logoH;
    }

    // Fecha (derecha)
    const today = new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "long", year: "numeric" });
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(...COL_MUTED);
    pdf.text(today.toUpperCase(), pageW - margin, margin + 14, { align: "right" });

    // Título
    let y = headerBottom + 28;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(20);
    pdf.setTextColor(...COL_DARK);
    pdf.text("Oferta de Fijo", margin, y);
    if (prospectName) {
      y += 18;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(11);
      pdf.setTextColor(...COL_MUTED);
      pdf.text(`Preparada para ${prospectName}`, margin, y);
    }

    // Caja destacada del total
    y += 24;
    const boxH = 78;
    pdf.setFillColor(...COL_PRIMARY);
    pdf.roundedRect(margin, y, pageW - margin * 2, boxH, 8, 8, "F");
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(255, 255, 255);
    pdf.text("FIJO PROPUESTA (USD)", margin + 18, y + 22);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(28);
    pdf.text(fmt(totalFijoPropuestaUsd, "USD"), margin + 18, y + 54);
    const totalCpas = validRows.reduce((s, r) => s + r.ftdT, 0);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.text(`${totalCpas} CPAs objetivo`, pageW - margin - 18, y + 54, { align: "right" });

    y += boxH + 24;

    // Sección detalle
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.setTextColor(...COL_DARK);
    pdf.text("Detalle por operador", margin, y);
    y += 14;

    const ensureSpace = (needed: number) => {
      if (y + needed > pageH - margin - 30) {
        pdf.addPage();
        pdf.setFillColor(...COL_PRIMARY);
        pdf.rect(0, 0, pageW, 6, "F");
        y = margin;
      }
    };

    for (const r of validRows) {
      const cardH = r.tierLabel ? 92 : 64;
      ensureSpace(cardH + 10);

      pdf.setDrawColor(...COL_BORDER);
      pdf.setFillColor(...COL_BG_SOFT);
      pdf.roundedRect(margin, y, pageW - margin * 2, cardH, 6, 6, "FD");

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12);
      pdf.setTextColor(...COL_DARK);
      pdf.text(r.operator.company_name, margin + 14, y + 20);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(...COL_MUTED);
      const subtitle = `${r.plan.brand ? r.plan.brand + " · " : ""}${r.plan.description || ""}`.trim();
      if (subtitle) pdf.text(subtitle, margin + 14, y + 34);

      // Badge CPAs
      const badge = `${r.ftdT} CPAs objetivo`;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      const badgeW = pdf.getTextWidth(badge) + 16;
      pdf.setFillColor(...COL_DARK);
      pdf.roundedRect(pageW - margin - 14 - badgeW, y + 10, badgeW, 18, 4, 4, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.text(badge, pageW - margin - 14 - badgeW / 2, y + 22, { align: "center" });

      // Fijo propuesta de la fila
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(...COL_MUTED);
      pdf.text("FIJO PROPUESTA", margin + 14, y + 50);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(13);
      pdf.setTextColor(...COL_DARK);
      pdf.text(fmt(computePropuesta(r), r.plan.currency), margin + 14, y + 60);

      if (r.tierLabel) {
        pdf.setDrawColor(...COL_BORDER);
        pdf.line(margin + 14, y + 70, pageW - margin - 14, y + 70);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.setTextColor(...COL_MUTED);
        pdf.text(`ESCENARIO REAL · ${r.tierLabel.toUpperCase()}`, margin + 14, y + 82);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10);
        pdf.setTextColor(...COL_DARK);
        pdf.text(
          `Pago al afiliado (${r.ftdA} CPAs): ${fmt(r.pagoRealAfiliado, r.plan.currency)}`,
          pageW - margin - 14,
          y + 82,
          { align: "right" },
        );
      }

      y += cardH + 10;
    }

    // Footer
    const pageCount = pdf.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      pdf.setPage(i);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(...COL_MUTED);
      pdf.text("Overoption · Oferta confidencial", margin, pageH - 18);
      pdf.text(`Página ${i} de ${pageCount}`, pageW - margin, pageH - 18, { align: "right" });
    }

    const fileName = `Oferta Overoption.pdf`;
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

  const loadHistory = async () => {
    const { data, error } = await supabase
      .from("calculator_simulations")
      .select("id, name, prospect_name, country_id, selections, total_fijo_usd, created_at")
      .order("created_at", { ascending: false });
    if (error) { toast.error("No se pudo cargar el historial"); return; }
    setSaved((data ?? []) as any);
  };

  const handleOpenSave = () => {
    setSimName(prospectName ? `Simulación ${prospectName}` : "");
    setSaveDialogOpen(true);
  };

  const handleSave = async () => {
    if (!simName.trim()) { toast.error("Ingresa un nombre para la simulación"); return; }
    if (!user) { toast.error("Debes iniciar sesión"); return; }
    setSaving(true);
    const { error } = await supabase.from("calculator_simulations").insert({
      name: simName.trim(),
      prospect_name: prospectName || null,
      country_id: countryId === "all" ? null : countryId,
      selections: selections as any,
      total_fijo_usd: totalFijoUsd,
      created_by: user.id,
    });
    setSaving(false);
    if (error) { toast.error("No se pudo guardar"); return; }
    toast.success("Simulación guardada");
    setSaveDialogOpen(false);
    setSimName("");
    if (historyOpen) loadHistory();
  };

  const handleLoadSim = (s: SavedSimulation) => {
    setProspectName(s.prospect_name ?? "");
    setCountryId(s.country_id ?? "all");
    setSelections(Array.isArray(s.selections) && s.selections.length ? s.selections : [newSelection()]);
    setHistoryOpen(false);
    toast.success(`Simulación "${s.name}" cargada`);
  };

  const handleDeleteSim = async (id: string) => {
    const { error } = await supabase.from("calculator_simulations").delete().eq("id", id);
    if (error) { toast.error("No se pudo eliminar"); return; }
    setSaved((prev) => prev.filter((x) => x.id !== id));
    toast.success("Simulación eliminada");
  };

  useEffect(() => {
    (async () => {
      const [{ data: ops }, { data: cs }] = await Promise.all([
        supabase
          .from("clients")
          .select("id, company_name, brands, login, net_min_cpa, country_ids, client_commission_plans(id, description, brand, currency, cpa, overoption_retention, fallback_cpa, cpa_at_80, cpa_at_90, proportional_enabled, proportional_min_pct, country_ids, fixed_margin_pct, recommended_margin_pct)")
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
    const recommendedMarginPct = OO_MARGIN_PCT;
    const ftdT = parseFloat(sel.ftdTarget) || 0;
    const ftdA = sel.ftdActual === "" ? ftdT : (parseFloat(sel.ftdActual) || 0);
    const fixed = cpaNeto * ftdT;
    const marginFactor = Math.max(0, 1 - fixedMarginPct / 100);
    const recommendedFactor = Math.max(0, 1 - recommendedMarginPct / 100);
    const fijoMaximo = fixed * marginFactor;
    const fijoRecomendado = fixed * recommendedFactor;

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
      sel, operator, plan, cpaNeto, fallbackCpa, cpa80, cpa90, fixedMarginPct, recommendedMarginPct,
      ftdT, ftdA, fixed, fijoMaximo, fijoRecomendado, pagoReal, pagoRealAfiliado, tierLabel, cpaTier,
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
    () => validRows.reduce((s, r) => s + toUsd(r.fijoMaximo, r.plan.currency), 0),
    [validRows],
  );
  const totalFijoRecomendadoUsd = useMemo(
    () => validRows.reduce((s, r) => s + toUsd(r.fijoRecomendado, r.plan.currency), 0),
    [validRows],
  );
  const totalFijoPropuestaUsd = useMemo(
    () => totalFijoRecomendadoUsd + (totalFijoUsd - totalFijoRecomendadoUsd) * (proposalPct / 100),
    [totalFijoUsd, totalFijoRecomendadoUsd, proposalPct],
  );
  const toEur = (amount: number, currency?: string | null) => {
    const usd = toUsd(amount, currency);
    return usd / (FX_TO_USD.EUR || 1);
  };
  const totalMarginEur = useMemo(
    () => validRows.reduce((s, r) => {
      const propuesta = r.fijoRecomendado + (r.fijoMaximo - r.fijoRecomendado) * (proposalPct / 100);
      return s + toEur(r.fixed - propuesta, r.plan.currency);
    }, 0),
    [validRows, proposalPct],
  );

  const computePropuesta = (r: NonNullable<ReturnType<typeof computeRow>>) =>
    r.fijoRecomendado + (r.fijoMaximo - r.fijoRecomendado) * (proposalPct / 100);

  const hasAny = validRows.length > 0;

  return (
    <div className="space-y-6">
      <style>{`@media print {
        body * { visibility: hidden; }
        #print-area, #print-area * { visibility: visible; }
        #print-area { position: absolute; left: 0; top: 0; width: 100%; padding: 24px; }
        .no-print { display: none !important; }
      }
      /* Ocultar flechas de inputs numéricos */
      input[type=number]::-webkit-inner-spin-button,
      input[type=number]::-webkit-outer-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }
      input[type=number] {
        -moz-appearance: textfield;
      }
      `}</style>
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
            <Calculator className="h-5 w-5 md:h-6 md:w-6 shrink-0" /> Calculadora de Fijos
          </h1>
          <p className="text-muted-foreground text-sm">
            Simula el valor fijo a ofrecer a un afiliado en base a CPAs comprometidos por uno o varios operadores.
          </p>
        </div>
        <div className="grid grid-cols-2 md:flex md:flex-wrap gap-2 no-print md:justify-end">
          <Button size="sm" onClick={() => { setHistoryOpen(true); loadHistory(); }} variant="outline">
            <History className="h-4 w-4 mr-2" /> Historial
          </Button>
          <Button size="sm" onClick={handleOpenSave} variant="secondary" disabled={!hasAny}>
            <Save className="h-4 w-4 mr-2" /> Guardar
          </Button>
          <Button size="sm" onClick={handleShare} variant="default" disabled={!hasAny}>
            <Share2 className="h-4 w-4 mr-2" /> Compartir
          </Button>
          <Button size="sm" onClick={handlePrint} variant="outline" disabled={!hasAny} className="col-span-2 md:col-span-1">
            <Printer className="h-4 w-4 mr-2" /> <span className="md:inline">Imprimir / Exportar PDF</span>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="fijos" className="space-y-4">
        <TabsList>
          <TabsTrigger value="fijos">Fijo (CPAs)</TabsTrigger>
          <TabsTrigger value="salario-cpa">Sueldo fijo + CPA</TabsTrigger>
        </TabsList>
        <TabsContent value="fijos" className="space-y-6">
      <div className="space-y-1 max-w-xl">
        <Label>Nombre del afiliado prospecto (opcional)</Label>
        <Input
          placeholder="Ej. Juan / AffiliateXYZ"
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
              const recommendedMarginPct = OO_MARGIN_PCT;
              const ftdT = parseFloat(sel.ftdTarget) || 0;
              const fijoMax = cpaNeto * ftdT * Math.max(0, 1 - fixedMarginPct / 100);
              const fijoRec = cpaNeto * ftdT * Math.max(0, 1 - recommendedMarginPct / 100);

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

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label>CPAs objetivo</Label>
                      <Input type="number" min="0" value={sel.ftdTarget}
                        onChange={(e) => updateSelection(sel.uid, { ftdTarget: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label>Fijo máximo</Label>
                      <Input type="text" readOnly tabIndex={-1} className="bg-muted cursor-not-allowed"
                        value={plan && ftdT > 0 ? fmt(fijoMax, plan.currency) : ""} placeholder="" />
                    </div>
                    <div className="space-y-1">
                      <Label>Fijo recomendado</Label>
                      <Input type="text" readOnly tabIndex={-1} className="bg-muted cursor-not-allowed"
                        value={plan && ftdT > 0 ? fmt(fijoRec, plan.currency) : ""} placeholder="" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label>CAPs logrados</Label>
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

        <div className="space-y-6">
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
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">Fijo propuesta (USD)</div>
                      <div className="text-3xl font-bold">{fmt(totalFijoPropuestaUsd, "USD")}</div>
                      <div className="text-xs text-muted-foreground pt-1 border-t">
                        Total CPAs objetivo: <span className="font-semibold text-foreground">{validRows.reduce((s, r) => s + r.ftdT, 0)}</span>
                      </div>
                    </div>
                  )}

                  {validRows.map((r) => (
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

                      <div className="pt-2 border-t text-sm">
                        <div className="flex flex-col">
                          <span className="text-muted-foreground text-xs">Fijo propuesta</span>
                          <span className="font-semibold">{fmt(computePropuesta(r), r.plan.currency)}</span>
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

          {hasAny && (
            <Card className="no-print border-primary/30">
              <CardHeader>
                <CardTitle className="text-base">Ajuste de propuesta (uso interno)</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Desliza para definir el "Fijo propuesta" entre el recomendado y el máximo. Estos valores no se incluyen al compartir ni en el PDF.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-md border p-2 bg-muted/40">
                    <div className="text-[10px] uppercase text-muted-foreground">Recomendado</div>
                    <div className="font-semibold">{fmt(totalFijoRecomendadoUsd, "USD")}</div>
                  </div>
                  <div className="rounded-md border-2 border-primary p-2 bg-primary/10 space-y-1">
                    <div className="text-[10px] uppercase text-muted-foreground">Propuesta (USD)</div>
                    <Input
                      type="number"
                      step={10}
                      min={Math.round(totalFijoRecomendadoUsd)}
                      max={Math.round(totalFijoUsd)}
                      value={Math.round(totalFijoPropuestaUsd)}
                      onChange={(e) => {
                        const range = totalFijoUsd - totalFijoRecomendadoUsd;
                        if (range <= 0) return;
                        const raw = Number(e.target.value);
                        if (!Number.isFinite(raw)) return;
                        const snapped = Math.round(raw / 10) * 10;
                        const clamped = Math.min(Math.max(snapped, totalFijoRecomendadoUsd), totalFijoUsd);
                        setProposalPct(((clamped - totalFijoRecomendadoUsd) / range) * 100);
                      }}
                      className="h-8 text-center font-bold text-base"
                    />
                  </div>
                  <div className="rounded-md border p-2 bg-muted/40">
                    <div className="text-[10px] uppercase text-muted-foreground">Máximo</div>
                    <div className="font-semibold">{fmt(totalFijoUsd, "USD")}</div>
                  </div>
                </div>
                <Slider
                  value={[proposalPct]}
                  onValueChange={(v) => {
                    const range = totalFijoUsd - totalFijoRecomendadoUsd;
                    if (range <= 0) { setProposalPct(v[0]); return; }
                    const usd = totalFijoRecomendadoUsd + (v[0] / 100) * range;
                    const snapped = Math.round(usd / 10) * 10;
                    const clamped = Math.min(Math.max(snapped, totalFijoRecomendadoUsd), totalFijoUsd);
                    setProposalPct(((clamped - totalFijoRecomendadoUsd) / range) * 100);
                  }}
                  min={0}
                  max={100}
                  step={0.01}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Recomendado</span>
                  <span>{Math.round(proposalPct)}%</span>
                  <span>Máximo</span>
                </div>

              </CardContent>
            </Card>
          )}

          {isSuperAdmin && hasAny && (
            <Card className="border-amber-500/40 bg-amber-50/40 dark:bg-amber-950/10 no-print">
              <CardHeader>
                <CardTitle className="text-base text-amber-700 dark:text-amber-400">
                  Margen Overoption (solo super admin)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between items-baseline">
                  <span className="text-sm text-muted-foreground">Margen estimado</span>
                  <span className="text-2xl font-bold">{fmt(totalMarginEur, "EUR")}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Diferencia entre el bruto del CPA y el fijo propuesta actual, consolidada en EUR. Esta información no se incluye en la oferta compartida.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
        </TabsContent>
        <TabsContent value="salario-cpa">
          <SalaryPlusCpaCalculator />
        </TabsContent>
      </Tabs>



      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Guardar simulación</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Nombre de la simulación *</Label>
            <Input
              autoFocus
              value={simName}
              onChange={(e) => setSimName(e.target.value)}
              placeholder="Ej. Propuesta Juan Pérez - Mayo"
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !simName.trim()}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Historial de simulaciones</DialogTitle></DialogHeader>
          {saved.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No hay simulaciones guardadas todavía.</p>
          ) : (
            <div className="space-y-2">
              {saved.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 border rounded-lg p-3 hover:bg-muted/50">
                  <button className="text-left flex-1 min-w-0" onClick={() => handleLoadSim(s)}>
                    <div className="font-semibold truncate">{s.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {s.prospect_name ? `${s.prospect_name} · ` : ""}
                      {fmt(Number(s.total_fijo_usd) || 0, "USD")} ·{" "}
                      {new Date(s.created_at).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })}
                    </div>
                  </button>
                  <Button variant="ghost" size="sm" onClick={() => handleDeleteSim(s.id)}>
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

