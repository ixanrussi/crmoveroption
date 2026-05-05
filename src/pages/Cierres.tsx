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
import { AlertCircle, ChevronDown, FileText, Info, MessageSquare, Plus, Send, Trash2, Upload } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

type Client = { id: string; company_name: string };
type Affiliate = { id: string; fixed_name: string; alias: string | null };
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

export default function Cierres() {
  const { isAdmin } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [closures, setClosures] = useState<Closure[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [newFeedback, setNewFeedback] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  // New closure dialog state
  const [openNew, setOpenNew] = useState(false);
  const [newClient, setNewClient] = useState("");
  const [newPeriod, setNewPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    const [{ data: cl }, { data: af }, { data: cs }, { data: it }] = await Promise.all([
      supabase.from("clients").select("id, company_name").order("company_name"),
      supabase.from("affiliates").select("id, fixed_name, alias").order("fixed_name"),
      supabase.from("commission_closures").select("*").order("created_at", { ascending: false }),
      supabase.from("commission_closure_items").select("*").order("brand"),
    ]);
    setClients(cl ?? []);
    setAffiliates(af ?? []);
    setClosures((cs ?? []) as Closure[]);
    setItems((it ?? []) as Item[]);
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  const affMap = useMemo(() => {
    const m = new Map<string, Affiliate>();
    affiliates.forEach((a) => m.set(a.id, a));
    return m;
  }, [affiliates]);
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
    // Also save the operator id mapping for future imports
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
                  <Upload className="h-4 w-4 mr-2" />{uploading ? "Procesando con IA…" : "Subir y procesar"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {loading && <p className="text-sm text-muted-foreground">Cargando…</p>}
      {!loading && closures.length === 0 && (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          Aún no hay cierres. Sube tu primer reporte en PDF.
        </CardContent></Card>
      )}

      {(() => {
        // Agrupar por cliente + periodo
        const groups = new Map<string, { client_id: string; period: string; closures: Closure[] }>();
        closures.forEach((c) => {
          const key = `${c.client_id}__${c.period}`;
          if (!groups.has(key)) groups.set(key, { client_id: c.client_id, period: c.period, closures: [] });
          groups.get(key)!.closures.push(c);
        });
        const groupList = Array.from(groups.values()).sort((a, b) => b.period.localeCompare(a.period));
        return groupList.map((g) => (
          <div key={`${g.client_id}-${g.period}`} className="space-y-2">
            <div className="flex items-baseline gap-2 px-1">
              <h2 className="text-lg font-semibold">{clientMap.get(g.client_id) ?? "Cliente"}</h2>
              <span className="text-sm text-muted-foreground">· {g.period}</span>
              <span className="text-xs text-muted-foreground">({g.closures.length} archivo{g.closures.length !== 1 ? "s" : ""})</span>
            </div>
            {g.closures.map((closure) => {
              const its = itemsByClosure.get(closure.id) ?? [];
              const byBrand = new Map<string, Item[]>();
              its.forEach((i) => {
                const k = i.brand ?? "—";
                if (!byBrand.has(k)) byBrand.set(k, []);
                byBrand.get(k)!.push(i);
              });
              const isRsType = closure.report_type === "revshare";
              return (
          <Card key={closure.id} className={isRsType ? "border-l-4 border-l-secondary" : "border-l-4 border-l-primary"}>
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
                            <Badge variant={isRsType ? "secondary" : "default"} className="text-xs">
                              {isRsType ? "RS" : "CPA"}
                            </Badge>
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

                  {Array.from(byBrand.entries()).map(([brand, rows]) => {
                    const isRs = closure.report_type === "revshare";
                    const totReg = rows.reduce((s, r) => s + r.qualified_players, 0);
                    const totDep = rows.reduce((s, r) => s + r.locked_players, 0);
                    const totVis = rows.reduce((s, r) => s + (r.visits || 0), 0);
                    const totAct = rows.reduce((s, r) => s + (r.active_accounts || 0), 0);
                    const totNgr = rows.reduce((s, r) => s + Number(r.casino_ngr || 0) + Number(r.sports_ngr || 0), 0);
                    const totCom = rows.reduce((s, r) => s + Number(r.commission_total), 0);
                    return (
                      <div key={brand} className="border rounded-md overflow-hidden">
                        <div className="bg-muted px-3 py-2 font-semibold text-sm flex justify-between">
                          <span>{brand}</span>
                          {isRs && <span className="text-xs text-muted-foreground font-normal">Revenue Share — no se reparte con afiliado</span>}
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
                                  <TableHead className="text-right">Comisión</TableHead>
                                </>
                              ) : (
                                <>
                                  <TableHead className="text-right">Calificados</TableHead>
                                  <TableHead className="text-right">Bloqueados</TableHead>
                                  <TableHead className="text-right">Comisión CPA</TableHead>
                                </>
                              )}
                              <TableHead>Match</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {rows.map((it) => {
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
                                      <TableCell className="text-right font-medium">{fmtMoney(Number(it.commission_total), it.currency)}</TableCell>
                                    </>
                                  ) : (
                                    <>
                                      <TableCell className="text-right">{it.qualified_players}</TableCell>
                                      <TableCell className="text-right">{it.locked_players}</TableCell>
                                      <TableCell className="text-right font-medium">{fmtMoney(Number(it.commission_total), it.currency)}</TableCell>
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
                                  <TableCell className="text-right">{fmtMoney(totCom, closure.currency)}</TableCell>
                                </>
                              ) : (
                                <>
                                  <TableCell className="text-right">{totReg}</TableCell>
                                  <TableCell className="text-right">{totDep}</TableCell>
                                  <TableCell className="text-right">{fmtMoney(totCom, closure.currency)}</TableCell>
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
        ));
      })()}
    </div>
  );
}
