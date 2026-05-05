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
import { ChevronDown, FileText, Plus, Trash2, Upload, BarChart3 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

type Client = { id: string; company_name: string };
type Affiliate = { id: string; fixed_name: string; alias: string | null };
type Closure = {
  id: string; client_id: string; period: string; status: string; currency: string | null;
  total_commission: number; total_qualified: number; total_locked: number;
  source_file_name: string | null; source_file_path: string | null; created_at: string;
};
type Item = {
  id: string; closure_id: string; affiliate_id: string | null;
  raw_campaign_name: string | null; raw_campaign_id: string | null; brand: string | null;
  qualified_players: number; locked_players: number; commission_total: number;
  currency: string | null; match_status: string;
};

export default function Cierres() {
  const { isAdmin } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [closures, setClosures] = useState<Closure[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);

  // Dashboard filters
  const [dashPeriod, setDashPeriod] = useState<string>("all");
  const [dashClient, setDashClient] = useState<string>("all");

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

      {/* Dashboard */}
      <DashboardSection
        closures={closures}
        items={items}
        affMap={affMap}
        clientMap={clientMap}
        dashPeriod={dashPeriod}
        setDashPeriod={setDashPeriod}
        dashClient={dashClient}
        setDashClient={setDashClient}
        clients={clients}
        fmtMoney={fmtMoney}
      />

      {loading && <p className="text-sm text-muted-foreground">Cargando…</p>}
      {!loading && closures.length === 0 && (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          Aún no hay cierres. Sube tu primer reporte en PDF.
        </CardContent></Card>
      )}

      {closures.map((closure) => {
        const its = itemsByClosure.get(closure.id) ?? [];
        const byBrand = new Map<string, Item[]>();
        its.forEach((i) => {
          const k = i.brand ?? "—";
          if (!byBrand.has(k)) byBrand.set(k, []);
          byBrand.get(k)!.push(i);
        });
        return (
          <Card key={closure.id}>
            <Collapsible defaultOpen={false}>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-accent/40">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <ChevronDown className="h-4 w-4 transition-transform [[data-state=closed]>&]:-rotate-90" />
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <div className="min-w-0">
                        <CardTitle className="text-base truncate">
                          {clientMap.get(closure.client_id) ?? "Cliente"} · {closure.period}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground truncate">{closure.source_file_name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary">Reg: {closure.total_qualified}</Badge>
                      <Badge variant="secondary">Dep: {closure.total_locked}</Badge>
                      <Badge>{fmtMoney(closure.total_commission, closure.currency)}</Badge>
                      <Badge variant={closure.status === "paid" ? "default" : closure.status === "confirmed" ? "secondary" : "outline"}>
                        {closure.status}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
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
                      <Button variant="ghost" size="sm" onClick={() => deleteClosure(closure)}>
                        <Trash2 className="h-4 w-4 mr-1" />Eliminar
                      </Button>
                    </div>
                  )}

                  {Array.from(byBrand.entries()).map(([brand, rows]) => {
                    const totReg = rows.reduce((s, r) => s + r.qualified_players, 0);
                    const totDep = rows.reduce((s, r) => s + r.locked_players, 0);
                    const totCom = rows.reduce((s, r) => s + Number(r.commission_total), 0);
                    return (
                      <div key={brand} className="border rounded-md overflow-hidden">
                        <div className="bg-muted px-3 py-2 font-semibold text-sm">{brand}</div>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Afiliado</TableHead>
                              <TableHead>Campaign ID</TableHead>
                              <TableHead className="text-right">Registros</TableHead>
                              <TableHead className="text-right">Depositantes</TableHead>
                              <TableHead className="text-right">Comisión</TableHead>
                              <TableHead>Match</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {rows.map((it) => {
                              const aff = it.affiliate_id ? affMap.get(it.affiliate_id) : null;
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
                                  <TableCell className="text-right">{it.qualified_players}</TableCell>
                                  <TableCell className="text-right">{it.locked_players}</TableCell>
                                  <TableCell className="text-right font-medium">{fmtMoney(Number(it.commission_total), it.currency)}</TableCell>
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
                              <TableCell className="text-right">{totReg}</TableCell>
                              <TableCell className="text-right">{totDep}</TableCell>
                              <TableCell className="text-right">{fmtMoney(totCom, closure.currency)}</TableCell>
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
  );
}

// ============== Dashboard Section ==============
const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2, 173 58% 39%))",
  "hsl(var(--chart-3, 197 37% 44%))",
  "hsl(var(--chart-4, 43 74% 66%))",
  "hsl(var(--chart-5, 27 87% 67%))",
  "hsl(220 70% 50%)",
  "hsl(280 65% 60%)",
  "hsl(340 75% 55%)",
  "hsl(160 60% 45%)",
  "hsl(30 80% 55%)",
];

type DashProps = {
  closures: Closure[];
  items: Item[];
  affMap: Map<string, Affiliate>;
  clientMap: Map<string, string>;
  clients: Client[];
  dashPeriod: string;
  setDashPeriod: (v: string) => void;
  dashClient: string;
  setDashClient: (v: string) => void;
  fmtMoney: (n: number, cur?: string | null) => string;
};

function DashboardSection({
  closures, items, affMap, clientMap, clients,
  dashPeriod, setDashPeriod, dashClient, setDashClient, fmtMoney,
}: DashProps) {
  const periods = useMemoUnique(closures.map((c) => c.period));
  const filteredClosures = closures.filter((c) =>
    (dashPeriod === "all" || c.period === dashPeriod) &&
    (dashClient === "all" || c.client_id === dashClient)
  );
  const closureIds = new Set(filteredClosures.map((c) => c.id));
  const filteredItems = items.filter((i) => closureIds.has(i.closure_id));

  const currency = filteredClosures[0]?.currency ?? "EUR";

  // Aggregate by affiliate
  const byAffMap = new Map<string, { name: string; total: number; reg: number; dep: number }>();
  let unmatchedTotal = 0;
  filteredItems.forEach((i) => {
    const amt = Number(i.commission_total) || 0;
    if (!i.affiliate_id) {
      unmatchedTotal += amt;
      return;
    }
    const aff = affMap.get(i.affiliate_id);
    const name = aff?.fixed_name ?? "Desconocido";
    const cur = byAffMap.get(i.affiliate_id) ?? { name, total: 0, reg: 0, dep: 0 };
    cur.total += amt;
    cur.reg += i.qualified_players;
    cur.dep += i.locked_players;
    byAffMap.set(i.affiliate_id, cur);
  });
  const byAffArr = Array.from(byAffMap.values()).sort((a, b) => b.total - a.total);
  const grandTotal = byAffArr.reduce((s, a) => s + a.total, 0) + unmatchedTotal;
  const totalReg = filteredItems.reduce((s, i) => s + i.qualified_players, 0);
  const totalDep = filteredItems.reduce((s, i) => s + i.locked_players, 0);

  const pieData = byAffArr.slice(0, 9).map((a) => ({ name: a.name, value: a.total }));
  const otherTotal = byAffArr.slice(9).reduce((s, a) => s + a.total, 0) + unmatchedTotal;
  if (otherTotal > 0) pieData.push({ name: "Otros / Sin asignar", value: otherTotal });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4" /> Dashboard de cierre
          </CardTitle>
          <div className="flex gap-2">
            <Select value={dashClient} onValueChange={setDashClient}>
              <SelectTrigger className="w-44 h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los clientes</SelectItem>
                {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={dashPeriod} onValueChange={setDashPeriod}>
              <SelectTrigger className="w-36 h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los periodos</SelectItem>
                {periods.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPI label="Comisión total" value={fmtMoney(grandTotal, currency)} />
          <KPI label="Afiliados activos" value={String(byAffArr.length)} />
          <KPI label="Registros" value={String(totalReg)} />
          <KPI label="Depositantes" value={String(totalDep)} />
        </div>

        {filteredItems.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Sin datos para los filtros seleccionados.</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bar chart */}
            <div className="border rounded-md p-4">
              <h3 className="text-sm font-semibold mb-2">Comisión por afiliado</h3>
              <ResponsiveContainer width="100%" height={Math.max(260, byAffArr.length * 32)}>
                <BarChart data={byAffArr.slice(0, 15)} layout="vertical" margin={{ left: 20 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" width={140} tick={{ fontSize: 11 }} />
                  <RTooltip formatter={(v: any) => fmtMoney(Number(v), currency)} />
                  <Bar dataKey="total" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {/* Pie chart */}
            <div className="border rounded-md p-4">
              <h3 className="text-sm font-semibold mb-2">% de impacto</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={(e: any) => `${((e.value / grandTotal) * 100).toFixed(1)}%`}
                  >
                    {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <RTooltip formatter={(v: any) => fmtMoney(Number(v), currency)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Ranking table */}
        {byAffArr.length > 0 && (
          <div className="border rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Afiliado</TableHead>
                  <TableHead className="text-right">Registros</TableHead>
                  <TableHead className="text-right">Depositantes</TableHead>
                  <TableHead className="text-right">Comisión</TableHead>
                  <TableHead className="text-right w-24">% Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byAffArr.map((a, i) => (
                  <TableRow key={a.name + i}>
                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell className="text-right">{a.reg}</TableCell>
                    <TableCell className="text-right">{a.dep}</TableCell>
                    <TableCell className="text-right">{fmtMoney(a.total, currency)}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary">
                        {grandTotal > 0 ? ((a.total / grandTotal) * 100).toFixed(1) : "0.0"}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {unmatchedTotal > 0 && (
                  <TableRow className="bg-muted/30">
                    <TableCell />
                    <TableCell className="italic text-muted-foreground">Sin asignar</TableCell>
                    <TableCell />
                    <TableCell />
                    <TableCell className="text-right">{fmtMoney(unmatchedTotal, currency)}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="destructive">
                        {grandTotal > 0 ? ((unmatchedTotal / grandTotal) * 100).toFixed(1) : "0.0"}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function KPI({ label, value }: { label: string; value: string }) {
  return (
    <div className="border rounded-md p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-bold mt-1">{value}</div>
    </div>
  );
}

function useMemoUnique(arr: string[]) {
  return useMemo(() => Array.from(new Set(arr)).sort().reverse(), [arr.join("|")]);
}
