import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertCircle, ChevronDown, FileText, Info, Loader2, MessageSquare, Plus, Send, Trash2, Upload } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

type Client = { id: string; company_name: string };
type Affiliate = { id: string; fixed_name: string; alias: string | null; aliases?: string[] | null; brands?: string[] | null };
type Closure = {
  id: string; client_id: string; period: string; status: string; currency: string | null;
  total_commission: number; total_qualified: number; total_locked: number;
  source_file_name: string | null; source_file_path: string | null; created_at: string;
  report_type: string;
};
type Item = {
  id: string; closure_id: string; affiliate_id: string | null;
  raw_campaign_name: string | null; raw_campaign_id: string | null; brand: string | null;
  qualified_players: number; locked_players: number; commission_total: number;
  visits: number; new_accounts: number; active_accounts: number; new_purchasing: number;
  casino_ngr: number; sports_ngr: number;
  currency: string | null; match_status: string;
  report_type: string; is_paid_to_affiliate: boolean;
};
type Feedback = { id: string; closure_id: string; kind: string; source: string; message: string; created_at: string };
type AffPlan = { id: string; affiliate_id: string; brand: string | null; cpa: number | null; currency: string | null; plan_start_date: string | null };

export default function Cierres() {
  const { isAdmin } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [closures, setClosures] = useState<Closure[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [affPlans, setAffPlans] = useState<AffPlan[]>([]);
  const [newFeedback, setNewFeedback] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  // New closure dialog state
  const [openNew, setOpenNew] = useState(false);
  const [newClient, setNewClient] = useState("");
  const [newPeriod, setNewPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!uploading) { setElapsed(0); return; }
    const start = Date.now();
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 250);
    return () => clearInterval(t);
  }, [uploading]);

  const loadAll = async () => {
    setLoading(true);
    const [{ data: cl }, { data: af }, { data: cs }, { data: it }, { data: fb }, { data: ap }] = await Promise.all([
      supabase.from("clients").select("id, company_name").order("company_name"),
      supabase.from("affiliates").select("id, fixed_name, alias").order("fixed_name"),
      supabase.from("commission_closures").select("*").order("created_at", { ascending: false }),
      supabase.from("commission_closure_items").select("*").order("brand"),
      supabase.from("commission_closure_feedback").select("*").order("created_at", { ascending: false }),
      supabase.from("affiliate_commission_plans").select("id, affiliate_id, brand, cpa, currency, plan_start_date"),
    ]);
    setClients(cl ?? []);
    setAffiliates(af ?? []);
    setClosures((cs ?? []) as Closure[]);
    setItems((it ?? []) as Item[]);
    setFeedback((fb ?? []) as Feedback[]);
    setAffPlans((ap ?? []) as AffPlan[]);
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  const affMap = useMemo(() => {
    const m = new Map<string, Affiliate>();
    affiliates.forEach((a) => m.set(a.id, a));
    return m;
  }, [affiliates]);

  // Look up affiliate CPA cost for a given (affiliate_id, brand, period). Picks the most recent plan that matches.
  const affPlanCpa = useMemo(() => {
    return (affiliateId: string | null, brand: string | null, period: string) => {
      if (!affiliateId) return null;
      const candidates = affPlans.filter((p) => p.affiliate_id === affiliateId && p.cpa != null);
      if (candidates.length === 0) return null;
      const brandLower = (brand || "").toLowerCase();
      const matchBrand = (p: AffPlan) => {
        if (!p.brand) return true; // generic plan
        const pb = p.brand.toLowerCase();
        return brandLower.includes(pb) || pb.includes(brandLower);
      };
      const periodDate = period ? `${period}-01` : null;
      const eligible = candidates
        .filter(matchBrand)
        .filter((p) => !periodDate || !p.plan_start_date || p.plan_start_date <= periodDate)
        .sort((a, b) => (b.plan_start_date || "").localeCompare(a.plan_start_date || ""));
      return eligible[0]?.cpa ?? null;
    };
  }, [affPlans]);

  const clientMap = useMemo(() => {
    const m = new Map<string, string>();
    clients.forEach((c) => m.set(c.id, c.company_name));
    return m;
  }, [clients]);

  const itemsByClosure = useMemo(() => {
    const m = new Map<string, Item[]>();
    items.forEach((i) => {
      if (!m.has(i.closure_id)) m.set(i.closure_id, []);
      m.get(i.closure_id)!.push(i);
    });
    return m;
  }, [items]);

  const feedbackByClosure = useMemo(() => {
    const m = new Map<string, Feedback[]>();
    feedback.forEach((f) => {
      if (!m.has(f.closure_id)) m.set(f.closure_id, []);
      m.get(f.closure_id)!.push(f);
    });
    return m;
  }, [feedback]);

  const addFeedback = async (closureId: string) => {
    const msg = (newFeedback[closureId] ?? "").trim();
    if (!msg) return;
    const { data, error } = await supabase
      .from("commission_closure_feedback")
      .insert({ closure_id: closureId, kind: "issue", source: "user", message: msg })
      .select("*")
      .single();
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    setFeedback((p) => [data as Feedback, ...p]);
    setNewFeedback((p) => ({ ...p, [closureId]: "" }));
  };

  const deleteFeedback = async (id: string) => {
    const { error } = await supabase.from("commission_closure_feedback").delete().eq("id", id);
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    setFeedback((p) => p.filter((f) => f.id !== id));
  };

  const handleUpload = async () => {
    if (!newClient || !newPeriod || !file) {
      toast({ title: "Faltan datos", description: "Selecciona cliente, periodo y archivo PDF", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const path = `${newClient}/${newPeriod}-${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("commission-reports").upload(path, file, {
        contentType: "application/pdf",
      });
      if (upErr) throw upErr;
      const { data, error } = await supabase.functions.invoke("parse-commission-pdf", {
        body: { storage_path: path, client_id: newClient, period: newPeriod },
      });
      if (error) throw error;
      toast({
        title: "Cierre creado",
        description: `${data.rows_count} filas extraídas, ${data.matched} matcheadas`,
      });
      setOpenNew(false);
      setFile(null);
      await loadAll();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message ?? "No se pudo procesar el PDF", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const updateItem = async (id: string, patch: Partial<Item>) => {
    const { error } = await supabase.from("commission_closure_items").update(patch).eq("id", id);
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  };

  const assignAffiliate = async (item: Item, affiliateId: string) => {
    await updateItem(item.id, {
      affiliate_id: affiliateId,
      match_status: "manual",
    });
    // Save the operator id mapping for future imports
    if (item.raw_campaign_id) {
      const closure = closures.find((c) => c.id === item.closure_id);
      if (closure) {
        await supabase.from("affiliate_operator_ids").upsert(
          {
            affiliate_id: affiliateId,
            client_id: closure.client_id,
            operator_campaign_id: item.raw_campaign_id,
            brand: item.brand,
          },
          { onConflict: "client_id,operator_campaign_id" },
        );
      }
    }
    // Add raw_campaign_name as alias to the affiliate (append if alias already exists)
    const rawName = (item.raw_campaign_name || "").trim();
    if (rawName) {
      const { data: aff } = await supabase
        .from("affiliates")
        .select("alias, fixed_name")
        .eq("id", affiliateId)
        .maybeSingle();
      if (aff && rawName.toLowerCase() !== (aff.fixed_name || "").toLowerCase()) {
        const existing = (aff.alias || "")
          .split(/[,;|]/)
          .map((s) => s.trim())
          .filter(Boolean);
        const lower = existing.map((s) => s.toLowerCase());
        if (!lower.includes(rawName.toLowerCase())) {
          const newAlias = [...existing, rawName].join(", ");
          const { error: aliasErr } = await supabase
            .from("affiliates")
            .update({ alias: newAlias })
            .eq("id", affiliateId);
          if (!aliasErr) {
            setAffiliates((prev) =>
              prev.map((a) => (a.id === affiliateId ? { ...a, alias: newAlias } : a)),
            );
            toast({ title: "Alias agregado", description: `"${rawName}" añadido al afiliado` });
          }
        }
      }
    }
  };

  const setStatus = async (closure: Closure, status: string) => {
    const { error } = await supabase.from("commission_closures").update({ status: status as any }).eq("id", closure.id);
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    setClosures((prev) => prev.map((c) => (c.id === closure.id ? { ...c, status } : c)));
  };

  const deleteClosure = async (closure: Closure) => {
    if (!confirm("¿Eliminar este cierre y todas sus filas?")) return;
    const { error } = await supabase.from("commission_closures").delete().eq("id", closure.id);
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    if (closure.source_file_path) {
      await supabase.storage.from("commission-reports").remove([closure.source_file_path]);
    }
    await loadAll();
  };

  const fmtMoney = (n: number, cur?: string | null) =>
    new Intl.NumberFormat("es-ES", { style: "currency", currency: cur || "EUR" }).format(n || 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cierre de Comisiones</h1>
          <p className="text-sm text-muted-foreground">Importa reportes mensuales en PDF y revisa las comisiones por afiliado.</p>
        </div>
        {isAdmin && (
          <Dialog open={openNew} onOpenChange={setOpenNew}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Nuevo cierre</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Importar reporte mensual</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Cliente</Label>
                  <Select value={newClient} onValueChange={setNewClient}>
                    <SelectTrigger><SelectValue placeholder="Selecciona cliente" /></SelectTrigger>
                    <SelectContent>
                      {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Periodo (YYYY-MM)</Label>
                  <Input type="month" value={newPeriod} onChange={(e) => setNewPeriod(e.target.value)} />
                </div>
                <div>
                  <Label>Archivo PDF</Label>
                  <Input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                </div>
                <Button onClick={handleUpload} disabled={uploading} className="w-full">
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Procesando con IA… {elapsed}s
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Subir y procesar
                    </>
                  )}
                </Button>
                {uploading && (
                  <div className="rounded-md border border-info/30 bg-info/5 p-3 space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-info opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-info" />
                      </span>
                      <span className="font-medium">Extrayendo datos del PDF</span>
                      <span className="ml-auto tabular-nums text-muted-foreground">{elapsed}s</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full w-1/3 rounded-full bg-info animate-[slide-in-right_1.5s_ease-in-out_infinite_alternate]" />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      El proceso puede tardar hasta 2 minutos según el tamaño del archivo.
                    </p>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {uploading && (
        <Card className="border-info/40 bg-info/5">
          <CardContent className="p-4 flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-info" />
            <div className="flex-1">
              <p className="text-sm font-medium">Procesando reporte con IA…</p>
              <p className="text-xs text-muted-foreground">Tiempo transcurrido: {elapsed}s</p>
            </div>
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-info opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-info" />
            </span>
          </CardContent>
        </Card>
      )}

      {loading && <p className="text-sm text-muted-foreground">Cargando…</p>}
      {!loading && closures.length === 0 && (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          Aún no hay cierres. Sube tu primer reporte en PDF.
        </CardContent></Card>
      )}

      {(() => {
        // Agrupar por cliente + año (consolidando todos los meses)
        const groups = new Map<string, { client_id: string; year: string; closures: Closure[] }>();
        closures.forEach((c) => {
          const year = (c.period || "").slice(0, 4) || "—";
          const key = `${c.client_id}__${year}`;
          if (!groups.has(key)) groups.set(key, { client_id: c.client_id, year, closures: [] });
          groups.get(key)!.closures.push(c);
        });
        const groupList = Array.from(groups.values())
          .map((g) => ({ ...g, closures: [...g.closures].sort((a, b) => b.period.localeCompare(a.period)) }))
          .sort((a, b) => b.year.localeCompare(a.year));
        return groupList.map((g) => {
          const periodsInGroup = [...new Set(g.closures.map((c) => c.period))].sort().reverse();
          // Subgrupos por mes
          const byMonth = new Map<string, Closure[]>();
          g.closures.forEach((c) => {
            const m = c.period;
            if (!byMonth.has(m)) byMonth.set(m, []);
            byMonth.get(m)!.push(c);
          });
          const monthList = [...byMonth.entries()].sort((a, b) => b[0].localeCompare(a[0]));
          const monthName = (p: string) => {
            const [, mm] = p.split("-");
            const names = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
            const idx = parseInt(mm || "0", 10) - 1;
            return names[idx] ?? p;
          };
          const totalCommissionYear = g.closures.reduce((s, c) => s + Number(c.total_commission || 0), 0);
          const currencyYear = g.closures.find((c) => c.currency)?.currency ?? null;
          return (
          <Card key={`${g.client_id}-${g.year}`} className="overflow-hidden">
            <Collapsible defaultOpen={false}>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-accent/40">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <ChevronDown className="h-4 w-4 transition-transform [[data-state=closed]>&]:-rotate-90" />
                      <CardTitle className="text-lg">{clientMap.get(g.client_id) ?? "Cliente"} · {g.year}</CardTitle>
                      <span className="text-xs text-muted-foreground">
                        {g.closures.length} archivo{g.closures.length !== 1 ? "s" : ""} · {monthList.length} mes{monthList.length !== 1 ? "es" : ""}
                      </span>
                    </div>
                    <Badge variant="secondary">{fmtMoney(totalCommissionYear, currencyYear)}</Badge>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-3">
                {monthList.map(([month, monthClosures]) => {
                  const monthCommission = monthClosures.reduce((s, c) => s + Number(c.total_commission || 0), 0);
                  const monthCurrency = monthClosures.find((c) => c.currency)?.currency ?? null;
                  return (
                  <div key={month} className="border rounded-md overflow-hidden">
                    <Collapsible defaultOpen={false}>
                      <CollapsibleTrigger asChild>
                        <div className="cursor-pointer hover:bg-accent/40 px-3 py-2 flex items-center justify-between gap-2 bg-muted/40">
                          <div className="flex items-center gap-2 min-w-0">
                            <ChevronDown className="h-3.5 w-3.5 transition-transform [[data-state=closed]>&]:-rotate-90" />
                            <span className="font-medium text-sm">{monthName(month)} · {month}</span>
                            <span className="text-xs text-muted-foreground">({monthClosures.length} archivo{monthClosures.length !== 1 ? "s" : ""})</span>
                          </div>
                          <Badge variant="outline">{fmtMoney(monthCommission, monthCurrency)}</Badge>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="p-2 space-y-2">
                          {monthClosures.map((closure) => {
              const its = itemsByClosure.get(closure.id) ?? [];
              const byBrand = new Map<string, Item[]>();
              its.forEach((i) => {
                const k = i.brand ?? "—";
                if (!byBrand.has(k)) byBrand.set(k, []);
                byBrand.get(k)!.push(i);
              });
              const isRsType = closure.report_type === "revshare";
              // Detectar datos pobres: RS sin visitas/activos, o sin comisión, o sin filas, o muchos sin match
              const totVisits = its.reduce((s, r) => s + (r.visits || 0), 0);
              const totActives = its.reduce((s, r) => s + (r.active_accounts || 0), 0);
              const unmatchedCount = its.filter((r) => r.match_status === "unmatched").length;
              const unmatchedPct = its.length > 0 ? (unmatchedCount / its.length) * 100 : 0;
              const isPoor =
                its.length === 0 ||
                Number(closure.total_commission || 0) === 0 ||
                (isRsType && totVisits === 0 && totActives === 0) ||
                unmatchedPct >= 50;
              const poorReasons: string[] = [];
              if (its.length === 0) poorReasons.push("sin filas");
              if (Number(closure.total_commission || 0) === 0) poorReasons.push("comisión 0");
              if (isRsType && totVisits === 0 && totActives === 0) poorReasons.push("sin visitas/activos");
              if (unmatchedPct >= 50) poorReasons.push(`${unmatchedCount}/${its.length} sin match`);
              return (
          <Card key={closure.id} style={{ borderLeft: `4px solid hsl(var(--${isPoor ? 'destructive' : isRsType ? 'info' : 'success'}))` }}>
            <Collapsible defaultOpen={false}>
              <div className="flex items-center pr-2">
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-accent/40 flex-1">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <ChevronDown className="h-4 w-4 transition-transform [[data-state=closed]>&]:-rotate-90" />
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <div className="min-w-0">
                          <CardTitle className="text-base truncate flex items-center gap-2">
                            {isPoor && (
                              <span title={`Datos pobres: ${poorReasons.join(", ")}`} className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-destructive/15 text-destructive">
                                <AlertCircle className="h-3 w-3" /> Alerta
                              </span>
                            )}
                            <span
                              className="text-xs font-semibold px-2 py-0.5 rounded"
                              style={{
                                backgroundColor: `hsl(var(--${isRsType ? 'info' : 'success'}) / 0.15)`,
                                color: `hsl(var(--${isRsType ? 'info' : 'success'}))`,
                              }}
                            >
                              {isRsType ? "RS" : "CPA"}
                            </span>
                            <span className="truncate">{closure.source_file_name}</span>
                          </CardTitle>
                          <p className="text-xs text-muted-foreground">{its.length} filas</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {closure.report_type === "cpa" ? (
                          <>
                            <Badge variant="secondary">Calif: {closure.total_qualified}</Badge>
                            <Badge variant="secondary">Lock: {closure.total_locked}</Badge>
                          </>
                        ) : null}
                        <Badge>{fmtMoney(closure.total_commission, closure.currency)}</Badge>
                        <Badge variant={closure.status === "paid" ? "default" : closure.status === "confirmed" ? "secondary" : "outline"}>
                          {closure.status}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => { e.stopPropagation(); deleteClosure(closure); }}
                    title="Eliminar parseo"
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <CollapsibleContent>
                <CardContent className="space-y-4">
                  {isAdmin && (
                    <div className="flex flex-wrap items-center gap-2">
                      <Label className="text-xs">Estado:</Label>
                      <Select value={closure.status} onValueChange={(v) => setStatus(closure, v)}>
                        <SelectTrigger className="w-40 h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">Borrador</SelectItem>
                          <SelectItem value="confirmed">Confirmado</SelectItem>
                          <SelectItem value="paid">Pagado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Feedback panel */}
                  <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <MessageSquare className="h-4 w-4" />
                      Feedback del procesamiento
                      <Badge variant="outline" className="ml-auto">{(feedbackByClosure.get(closure.id) ?? []).length}</Badge>
                    </div>
                    <div className="space-y-1.5 max-h-48 overflow-auto">
                      {(feedbackByClosure.get(closure.id) ?? []).length === 0 && (
                        <p className="text-xs text-muted-foreground">Sin observaciones aún.</p>
                      )}
                      {(feedbackByClosure.get(closure.id) ?? []).map((f) => {
                        const colorVar =
                          f.kind === "warning" ? "warning" :
                          f.kind === "issue" ? "destructive" :
                          f.kind === "suggestion" ? "info" : "muted-foreground";
                        const Icon = f.kind === "info" ? Info : AlertCircle;
                        return (
                          <div
                            key={f.id}
                            className="flex items-start gap-2 text-xs p-2 rounded border"
                            style={{ backgroundColor: `hsl(var(--${colorVar}) / 0.08)`, borderColor: `hsl(var(--${colorVar}) / 0.3)` }}
                          >
                            <Icon className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: `hsl(var(--${colorVar}))` }} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium uppercase" style={{ color: `hsl(var(--${colorVar}))` }}>{f.kind}</span>
                                <span className="text-muted-foreground">· {f.source === "auto" ? "automático" : "usuario"}</span>
                                <span className="text-muted-foreground">· {new Date(f.created_at).toLocaleString()}</span>
                              </div>
                              <p className="mt-0.5 break-words">{f.message}</p>
                            </div>
                            {isAdmin && (
                              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => deleteFeedback(f.id)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {isAdmin && (
                      <div className="flex gap-2 pt-1">
                        <Textarea
                          placeholder="Reportar limitación, sugerencia o problema en el parseo de este archivo…"
                          value={newFeedback[closure.id] ?? ""}
                          onChange={(e) => setNewFeedback((p) => ({ ...p, [closure.id]: e.target.value }))}
                          className="min-h-[60px] text-xs"
                        />
                        <Button size="sm" onClick={() => addFeedback(closure.id)} className="self-end">
                          <Send className="h-3.5 w-3.5 mr-1" />Añadir
                        </Button>
                      </div>
                    )}
                  </div>

                  {Array.from(byBrand.entries()).map(([brand, rows]) => {
                    const isRs = closure.report_type === "revshare";
                    const rowCalc = rows.map((r) => {
                      const affCpa = !isRs ? affPlanCpa(r.affiliate_id, r.brand ?? brand, closure.period) : null;
                      const qualified = r.qualified_players || 0;
                      const affCost = !isRs && affCpa != null ? affCpa * qualified : null;
                      const clientPaid = Number(r.commission_total || 0);
                      const margin = affCost != null ? clientPaid - affCost : null;
                      return { row: r, affCpa, affCost, clientPaid, margin };
                    });
                    const totReg = rows.reduce((s, r) => s + r.qualified_players, 0);
                    const totDep = rows.reduce((s, r) => s + r.locked_players, 0);
                    const totVis = rows.reduce((s, r) => s + (r.visits || 0), 0);
                    const totAct = rows.reduce((s, r) => s + (r.active_accounts || 0), 0);
                    const totNgr = rows.reduce((s, r) => s + Number(r.casino_ngr || 0) + Number(r.sports_ngr || 0), 0);
                    const totCom = rows.reduce((s, r) => s + Number(r.commission_total), 0);
                    const totAffCost = rowCalc.reduce((s, c) => s + (c.affCost ?? 0), 0);
                    const totMargin = totCom - totAffCost;
                    return (
                      <div key={brand} className="border rounded-md overflow-hidden">
                        <div className="bg-muted px-3 py-2 font-semibold text-sm flex justify-between">
                          <span>{brand}</span>
                          {isRs && <span className="text-xs text-muted-foreground font-normal">Revenue Share — ganancia 100% Overoption</span>}
                        </div>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Afiliado</TableHead>
                              <TableHead>Campaign ID</TableHead>
                              {isRs ? (
                                <>
                                  <TableHead className="text-right">Visitas</TableHead>
                                  <TableHead className="text-right">Cuentas</TableHead>
                                  <TableHead className="text-right">Activas</TableHead>
                                  <TableHead className="text-right">NGR</TableHead>
                                  <TableHead className="text-right">RS Overoption</TableHead>
                                </>
                              ) : (
                                <>
                                  <TableHead className="text-right">Calificados</TableHead>
                                  <TableHead className="text-right">Bloqueados</TableHead>
                                  <TableHead className="text-right" title="Lo que paga el cliente a Overoption">CPA cliente</TableHead>
                                  <TableHead className="text-right" title="Lo que Overoption paga al afiliado (plan CPA × calificados)">CPA afiliado</TableHead>
                                  <TableHead className="text-right" title="Ganancia neta de Overoption">Margen Overoption</TableHead>
                                </>
                              )}
                              <TableHead>Match</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {rowCalc.map(({ row: it, affCpa, affCost, clientPaid, margin }) => {
                              const aff = it.affiliate_id ? affMap.get(it.affiliate_id) : null;
                              const ngr = Number(it.casino_ngr || 0) + Number(it.sports_ngr || 0);
                              return (
                                <TableRow key={it.id}>
                                  <TableCell className="min-w-[220px]">
                                    {isAdmin ? (
                                      <Select
                                        value={it.affiliate_id ?? ""}
                                        onValueChange={(v) => {
                                          const a = affiliates.find((x) => x.id === v);
                                          if (a) assignAffiliate(it, v);
                                        }}
                                      >
                                        <SelectTrigger className="h-8">
                                          <SelectValue placeholder={it.raw_campaign_name ?? "Sin asignar"} />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {affiliates.map((a) => (
                                            <SelectItem key={a.id} value={a.id}>
                                              {a.fixed_name}{a.alias ? ` (${a.alias})` : ""}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    ) : (
                                      <span>{aff?.fixed_name ?? it.raw_campaign_name}</span>
                                    )}
                                    <div className="text-xs text-muted-foreground mt-0.5">PDF: {it.raw_campaign_name}</div>
                                  </TableCell>
                                  <TableCell className="font-mono text-xs">{it.raw_campaign_id}</TableCell>
                                  {isRs ? (
                                    <>
                                      <TableCell className="text-right">{it.visits || 0}</TableCell>
                                      <TableCell className="text-right">{it.new_accounts || 0}</TableCell>
                                      <TableCell className="text-right">{it.active_accounts || 0}</TableCell>
                                      <TableCell className={`text-right ${ngr < 0 ? "text-destructive" : ""}`}>{fmtMoney(ngr, it.currency)}</TableCell>
                                      <TableCell className="text-right font-medium text-success">{fmtMoney(Number(it.commission_total), it.currency)}</TableCell>
                                    </>
                                  ) : (
                                    <>
                                      <TableCell className="text-right">{it.qualified_players}</TableCell>
                                      <TableCell className="text-right">{it.locked_players}</TableCell>
                                      <TableCell className="text-right font-medium">{fmtMoney(clientPaid, it.currency)}</TableCell>
                                      <TableCell className="text-right">
                                        {affCost != null ? (
                                          <div>
                                            <div>{fmtMoney(affCost, it.currency)}</div>
                                            <div className="text-[10px] text-muted-foreground">{fmtMoney(affCpa!, it.currency)}/CPA</div>
                                          </div>
                                        ) : (
                                          <span className="text-xs text-muted-foreground" title="Sin plan CPA configurado para este afiliado/marca">—</span>
                                        )}
                                      </TableCell>
                                      <TableCell className={`text-right font-semibold ${margin == null ? "" : margin > 0 ? "text-success" : margin < 0 ? "text-destructive" : ""}`}>
                                        {margin != null ? fmtMoney(margin, it.currency) : <span className="text-xs text-muted-foreground">—</span>}
                                      </TableCell>
                                    </>
                                  )}
                                  <TableCell>
                                    <Badge variant={
                                      it.match_status === "auto_id" ? "default"
                                      : it.match_status === "auto_alias" ? "secondary"
                                      : it.match_status === "manual" ? "secondary"
                                      : "destructive"
                                    } className="text-xs">
                                      {it.match_status === "auto_id" ? "✓ ID" :
                                       it.match_status === "auto_alias" ? "✓ Alias" :
                                       it.match_status === "manual" ? "Manual" : "Sin match"}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                            <TableRow className="bg-muted/50 font-semibold">
                              <TableCell colSpan={2}>TOTAL {brand}</TableCell>
                              {isRs ? (
                                <>
                                  <TableCell className="text-right">{totVis}</TableCell>
                                  <TableCell className="text-right">{rows.reduce((s,r)=>s+(r.new_accounts||0),0)}</TableCell>
                                  <TableCell className="text-right">{totAct}</TableCell>
                                  <TableCell className={`text-right ${totNgr < 0 ? "text-destructive" : ""}`}>{fmtMoney(totNgr, closure.currency)}</TableCell>
                                  <TableCell className="text-right text-success">{fmtMoney(totCom, closure.currency)}</TableCell>
                                </>
                              ) : (
                                <>
                                  <TableCell className="text-right">{totReg}</TableCell>
                                  <TableCell className="text-right">{totDep}</TableCell>
                                  <TableCell className="text-right">{fmtMoney(totCom, closure.currency)}</TableCell>
                                  <TableCell className="text-right">{fmtMoney(totAffCost, closure.currency)}</TableCell>
                                  <TableCell className={`text-right ${totMargin > 0 ? "text-success" : totMargin < 0 ? "text-destructive" : ""}`}>{fmtMoney(totMargin, closure.currency)}</TableCell>
                                </>
                              )}
                              <TableCell />
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    );
                  })}
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
              );
            })}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                  );
                })}
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
          );
        });
      })()}
    </div>
  );
}
