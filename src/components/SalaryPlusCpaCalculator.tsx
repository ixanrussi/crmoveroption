import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Copy, FileDown, Save, Trash2, UserPlus, Check, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import overoptionLogo from "@/assets/overoption-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const fmtEur = (n: number) =>
  new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(
    isFinite(n) ? n : 0,
  );

const MIN_PCT = 30;
const MAX_PCT = 70;

type SPCPlan = {
  id: string;
  brand: string | null;
  currency: string | null;
  cpa: number | null;
  overoption_retention: number | null;
};
type SPCOperator = {
  id: string;
  company_name: string;
  client_commission_plans: SPCPlan[];
};


export default function SalaryPlusCpaCalculator() {
  const [cpaOp, setCpaOp] = useState<string>("20");
  const [capacidad, setCapacidad] = useState<string>("100");
  const [pct, setPct] = useState<number>(50);
  const [operators, setOperators] = useState<SPCOperator[]>([]);
  const [opId, setOpId] = useState<string>("");
  const [planId, setPlanId] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, company_name, client_commission_plans(id, brand, currency, cpa, overoption_retention)")
        .order("company_name", { ascending: true });
      setOperators((data ?? []) as any);
    })();
  }, []);

  const selectedOp = operators.find((o) => o.id === opId);
  const selectedPlan = selectedOp?.client_commission_plans.find((p) => p.id === planId);

  // When operator/plan changes, set CPA from the plan (net = cpa - overoption_retention)
  useEffect(() => {
    if (!selectedPlan) return;
    const net = Math.max(0, (selectedPlan.cpa ?? 0) - (selectedPlan.overoption_retention ?? 0));
    if (net > 0) setCpaOp(String(net));
  }, [planId, opId]);


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

      <ProposalBuilder cpaNum={cpaNum} capNum={capNum} presupuesto={presupuesto} />
    </div>
  );
}

const toDataUrl = (url: string) =>
  new Promise<string>((resolve, reject) => {
    fetch(url)
      .then((r) => r.blob())
      .then((b) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result as string);
        fr.onerror = reject;
        fr.readAsDataURL(b);
      })
      .catch(reject);
  });

function ProposalBuilder({
  cpaNum,
  capNum,
  presupuesto,
}: {
  cpaNum: number;
  capNum: number;
  presupuesto: number;
}) {
  type SavedProp = {
    id: string;
    name: string;
    pct: number;
    salario: number;
    comision: number;
    minCpas: number;
    total: number;
    capNum: number;
    cpaNum: number;
    presupuesto: number;
    createdAffiliateId?: string;
  };

  const [propPct, setPropPct] = useState<number>(50);
  const [affiliate, setAffiliate] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const [saved, setSaved] = useState<SavedProp[]>([]);
  const [creatingId, setCreatingId] = useState<string | null>(null);

  const salario = (propPct / 100) * presupuesto;
  const comision = capNum > 0 ? (presupuesto - salario) / capNum : 0;
  const minCpas = cpaNum > 0 ? Math.ceil(salario / cpaNum) : 0;
  const total = salario + comision * capNum;
  const valid = cpaNum > 0 && capNum > 0;

  const saveProposal = () => {
    if (!valid) { toast.error("Completa los datos de entrada"); return; }
    if (!affiliate.trim()) { toast.error("Indica el nombre de la propuesta / afiliado"); return; }
    const item: SavedProp = {
      id: crypto.randomUUID(),
      name: affiliate.trim(),
      pct: propPct, salario, comision, minCpas, total,
      capNum, cpaNum, presupuesto,
    };
    setSaved((s) => [item, ...s]);
    toast.success("Propuesta guardada");
    setAffiliate("");
  };

  const removeSaved = (id: string) => setSaved((s) => s.filter((x) => x.id !== id));

  const createAffiliateFromProposal = async (p: SavedProp) => {
    setCreatingId(p.id);
    try {
      const payload = {
        fixed_name: p.name,
        status: "prospect",
        notes: `Propuesta generada desde calculadora Sueldo fijo + CPA (${p.pct}%). Volumen CPA referencia: ${p.capNum}.`,
        fixed_remuneration: p.salario,
        fixed_remuneration_currency: "EUR",
        fixed_remuneration_min_ftd: p.minCpas,
        fixed_remuneration_fallback_cpa: p.comision,
        fixed_remuneration_fallback_cpa_currency: "EUR",
        fixed_remuneration_installments: [],
      };
      const { data, error } = await supabase.functions.invoke("affiliates-manage", {
        body: { action: "insert", affiliate: payload, channel_ids: [], channel_links: [], commission_plans: [] },
      });
      if (error) throw error;
      const newId = (data as any)?.data?.id || (data as any)?.id;
      setSaved((s) => s.map((x) => (x.id === p.id ? { ...x, createdAffiliateId: newId } : x)));
      toast.success(`Afiliado "${p.name}" creado`);
    } catch (e: any) {
      toast.error(e?.message ?? "Error al crear el afiliado");
    } finally {
      setCreatingId(null);
    }
  };

  const generatePdfFor = async (p: { name: string; pct: number; salario: number; comision: number; capNum: number; cpaNum: number }) => {
    setGenerating(true);
    try {
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();

      // ===== HEADER =====
      const headerH = 120;
      doc.setFillColor(10, 25, 60); doc.rect(0, 0, pageW, headerH, "F");
      doc.setFillColor(20, 45, 95); doc.rect(0, headerH - 60, pageW, 60, "F");
      doc.setFillColor(35, 75, 140); doc.rect(0, headerH - 25, pageW, 25, "F");
      doc.setDrawColor(80, 130, 200); doc.setLineWidth(0.6);
      for (let i = 0; i < 14; i++) {
        const x = pageW - 240 + i * 18;
        doc.line(x, 0, x - 80, headerH);
      }
      doc.setDrawColor(201, 168, 76); doc.setLineWidth(1.2);
      doc.line(0, headerH, pageW, headerH);

      try {
        const logoData = await toDataUrl(overoptionLogo);
        const chipW = 180, chipH = 50, chipX = 30, chipY = 28;
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(chipX, chipY, chipW, chipH, 6, 6, "F");
        doc.addImage(logoData, "PNG", chipX + 10, chipY + 7, chipW - 20, chipH - 14);
      } catch {}

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold"); doc.setFontSize(20);
      doc.text("Propuesta Comercial", pageW - 30, 55, { align: "right" });
      doc.setFont("helvetica", "normal"); doc.setFontSize(10);
      doc.setTextColor(200, 215, 240);
      doc.text("Sueldo fijo + CPA", pageW - 30, 75, { align: "right" });

      // ===== BODY =====
      let y = headerH + 50;
      doc.setTextColor(20, 20, 20);
      doc.setFont("helvetica", "bold"); doc.setFontSize(13);
      doc.text(`Para: ${p.name || "Afiliado"}`, 40, y);
      y += 22;
      doc.setFont("helvetica", "normal"); doc.setFontSize(11);
      doc.setTextColor(60, 60, 60);
      const intro =
        "Nos complace presentarte la siguiente propuesta de colaboración bajo el modelo " +
        "de sueldo fijo mensual más una comisión por cada CPA generado.";
      doc.text(doc.splitTextToSize(intro, pageW - 80), 40, y);
      y += 50;

      doc.setDrawColor(35, 75, 140); doc.setLineWidth(1);
      doc.setFillColor(245, 248, 255);
      doc.roundedRect(40, y, pageW - 80, 170, 8, 8, "FD");

      doc.setTextColor(10, 25, 60);
      doc.setFont("helvetica", "bold"); doc.setFontSize(14);
      doc.text("Detalle de la oferta", 60, y + 28);

      const rows: Array<[string, string]> = [
        ["Volumen de CPA's de referencia", String(p.capNum)],
        ["Fixed fee", fmtEur(p.salario)],
        ["Comisión por CPA", fmtEur(p.comision)],
      ];

      doc.setFontSize(11);
      let ry = y + 55;
      rows.forEach(([k, v], i) => {
        if (i % 2 === 0) {
          doc.setFillColor(232, 240, 252);
          doc.rect(50, ry - 12, pageW - 100, 22, "F");
        }
        doc.setFont("helvetica", "normal"); doc.setTextColor(40, 40, 40);
        doc.text(k, 60, ry + 3);
        doc.setFont("helvetica", "bold"); doc.setTextColor(10, 25, 60);
        doc.text(v, pageW - 60, ry + 3, { align: "right" });
        ry += 26;
      });

      y += 190;

      doc.setFillColor(201, 168, 76);
      doc.roundedRect(40, y, pageW - 80, 36, 6, 6, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold"); doc.setFontSize(12);
      doc.text("Esta oferta prevalecerá durante 5 días desde la fecha de emisión.", pageW / 2, y + 23, { align: "center" });

      y += 60;
      doc.setTextColor(80, 80, 80);
      doc.setFont("helvetica", "normal"); doc.setFontSize(10);
      doc.text(`Fecha de emisión: ${new Date().toLocaleDateString("es-ES")}`, 40, y);

      // ===== FOOTER =====
      const footerH = 50;
      doc.setFillColor(10, 25, 60);
      doc.rect(0, pageH - footerH, pageW, footerH, "F");
      doc.setDrawColor(201, 168, 76); doc.setLineWidth(1);
      doc.line(0, pageH - footerH, pageW, pageH - footerH);
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold"); doc.setFontSize(11);
      doc.text("OVEROPTION", 40, pageH - footerH + 20);
      doc.setFont("helvetica", "normal"); doc.setFontSize(9);
      doc.setTextColor(180, 200, 230);
      doc.text("Affiliate Management", 40, pageH - footerH + 35);
      doc.text(`© ${new Date().getFullYear()} Overoption — Documento confidencial`, pageW - 40, pageH - footerH + 30, { align: "right" });

      const fname = `propuesta-${(p.name || "afiliado").replace(/[^\w-]+/g, "_")}-${p.pct}pct.pdf`;
      doc.save(fname);
      toast.success("PDF generado");
    } catch (e: any) {
      toast.error(e?.message ?? "Error al generar el PDF");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Propuesta para el afiliado</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-lg border p-3 bg-muted/30">
          <div className="text-xs text-muted-foreground">Volumen de CPA's de referencia</div>
          <div className="text-xl font-bold">{capNum}</div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Capacidad media del afiliado utilizada para el cálculo del fijo
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <Label>% del presupuesto a sueldo fijo</Label>
            <span className="text-sm font-semibold">{propPct}%</span>
          </div>
          <Slider
            value={[propPct]}
            min={MIN_PCT}
            max={MAX_PCT}
            step={5}
            onValueChange={(v) => setPropPct(v[0] ?? MIN_PCT)}
            disabled={!valid}
          />
          <div className="flex justify-between text-[11px] text-muted-foreground">
            <span>{MIN_PCT}%</span>
            <span>{MAX_PCT}%</span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-lg border p-3 bg-muted/30">
            <div className="text-xs text-muted-foreground">CPAs mín. salario</div>
            <div className="text-xl font-bold">{minCpas}</div>
          </div>
          <div className="rounded-lg border p-3 bg-muted/30">
            <div className="text-xs text-muted-foreground">Sueldo fijo</div>
            <div className="text-xl font-bold">{fmtEur(salario)}</div>
          </div>
          <div className="rounded-lg border p-3 bg-muted/30">
            <div className="text-xs text-muted-foreground">Comisión por CPA</div>
            <div className="text-xl font-bold">{fmtEur(comision)}</div>
          </div>
          <div className="rounded-lg border p-3 bg-primary/10 border-primary/30">
            <div className="text-xs text-muted-foreground">Total a pagar</div>
            <div className="text-xl font-bold">{fmtEur(total)}</div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] items-end">
          <div className="space-y-1">
            <Label>Nombre de la propuesta / afiliado</Label>
            <Input
              value={affiliate}
              onChange={(e) => setAffiliate(e.target.value)}
              placeholder="Ej. Juan Pérez"
            />
          </div>
          <Button variant="outline" onClick={saveProposal} disabled={!valid}>
            <Save className="h-4 w-4" />
            Guardar propuesta
          </Button>
          <Button
            onClick={() => generatePdfFor({ name: affiliate, pct: propPct, salario, comision, capNum, cpaNum })}
            disabled={!valid || generating}
          >
            <FileDown className="h-4 w-4" />
            {generating ? "Generando..." : "Generar PDF"}
          </Button>
        </div>

        {saved.length > 0 && (
          <div className="space-y-2">
            <Label>Propuestas guardadas</Label>
            <div className="rounded-lg border divide-y">
              {saved.map((p) => (
                <div key={p.id} className="flex flex-wrap items-center gap-3 p-3">
                  <div className="flex-1 min-w-[160px]">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.pct}% · Fijo {fmtEur(p.salario)} · CPA {fmtEur(p.comision)} · Total {fmtEur(p.total)} · Ref {p.capNum} CPAs
                    </div>
                    {p.createdAffiliateId && (
                      <div className="text-[11px] text-emerald-600 mt-1">Afiliado creado ✓</div>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => generatePdfFor({ name: p.name, pct: p.pct, salario: p.salario, comision: p.comision, capNum: p.capNum, cpaNum: p.cpaNum })}
                    disabled={generating}
                    title="Generar PDF"
                  >
                    <FileDown className="h-4 w-4" />
                  </Button>
                  {!p.createdAffiliateId && (
                    <Button
                      size="sm"
                      onClick={() => createAffiliateFromProposal(p)}
                      disabled={creatingId === p.id}
                      title="Crear afiliado con estos datos"
                    >
                      <UserPlus className="h-4 w-4" />
                      {creatingId === p.id ? "Creando..." : "Crear Afiliado"}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeSaved(p.id)}
                    title="Borrar"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          La oferta generada prevalecerá durante 5 días desde su emisión.
        </p>
      </CardContent>
    </Card>
  );
}
