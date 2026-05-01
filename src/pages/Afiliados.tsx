import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Lock, X } from "lucide-react";
import { toast } from "sonner";

const STATUSES = ["active", "inactive", "pending"] as const;
const CONVERSION_TYPES = ["NCO", "NNCO"] as const;

type CommissionPlan = {
  plan_start_date: string;
  currency: string;
  description: string;
  country_id: string | null;
  brand: string;
  baseline: string;
  cpa: string;
  rev_share_pct: string;
  cpl: string;
  wager: string;
  conversion_type: string;
  cap: string;
};
const emptyPlan: CommissionPlan = {
  plan_start_date: "", currency: "", description: "", country_id: null, brand: "",
  baseline: "", cpa: "", rev_share_pct: "", cpl: "", wager: "", conversion_type: "", cap: "",
};

export default function Afiliados() {
  const { isAdmin, isSuperAdmin } = useAuth();
  const [list, setList] = useState<any[]>([]);
  const [countries, setCountries] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [channelIds, setChannelIds] = useState<string[]>([]);
  const [channelLinks, setChannelLinks] = useState<Record<string, string>>({});
  const [plans, setPlans] = useState<CommissionPlan[]>([]);
  const [saving, setSaving] = useState(false);

  const empty: any = {
    fixed_name: "", alias: "", email: "", phone: "", country_id: null,
    status: "active", notes: "",
  };
  const [form, setForm] = useState<any>(empty);

  const load = async () => {
    const { data } = await supabase
      .from("affiliates")
      .select("*, country:countries(name), affiliate_channel_links(channel_id, link, channel:affiliate_channels(name)), affiliate_commission_plans(*, country:countries(name))")
      .order("created_at", { ascending: false });
    setList(data ?? []);
  };
  const loadLookups = async () => {
    const [c, ch] = await Promise.all([
      supabase.from("countries").select("*").order("name"),
      supabase.from("affiliate_channels").select("*").order("name"),
    ]);
    setCountries(c.data ?? []);
    setChannels(ch.data ?? []);
  };
  useEffect(() => { load(); loadLookups(); }, []);

  const openNew = () => { setEditing(null); setForm(empty); setChannelIds([]); setChannelLinks({}); setPlans([]); setOpen(true); };
  const openEdit = (row: any) => {
    setEditing(row);
    setForm({ ...row });
    setChannelIds(row.affiliate_channel_links?.map((l: any) => l.channel_id) ?? []);
    const links: Record<string, string> = {};
    row.affiliate_channel_links?.forEach((l: any) => { if (l.link) links[l.channel_id] = l.link; });
    setChannelLinks(links);
    setPlans(
      (row.affiliate_commission_plans ?? []).map((p: any) => ({
        plan_start_date: p.plan_start_date ?? "",
        currency: p.currency ?? "",
        description: p.description ?? "",
        country_id: p.country_id ?? null,
        brand: p.brand ?? "",
        baseline: p.baseline?.toString() ?? "",
        cpa: p.cpa?.toString() ?? "",
        rev_share_pct: p.rev_share_pct?.toString() ?? "",
        cpl: p.cpl?.toString() ?? "",
        wager: p.wager?.toString() ?? "",
        conversion_type: p.conversion_type ?? "",
        cap: p.cap?.toString() ?? "",
      })),
    );
    setOpen(true);
  };

  const addPlan = () => setPlans((p) => [...p, { ...emptyPlan }]);
  const updatePlan = (i: number, patch: Partial<CommissionPlan>) =>
    setPlans((p) => p.map((pl, idx) => (idx === i ? { ...pl, ...patch } : pl)));
  const removePlan = (i: number) => setPlans((p) => p.filter((_, idx) => idx !== i));

  const save = async () => {
    if (!form.fixed_name?.trim()) { toast.error("Nombre fijo es requerido"); return; }
    const payload: any = {
      fixed_name: form.fixed_name,
      alias: form.alias || null, email: form.email || null, phone: form.phone || null,
      country_id: form.country_id || null,
      notes: form.notes || null,
    };
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("affiliates-manage", {
      body: {
        action: editing ? "update" : "insert",
        id: editing?.id,
        affiliate: payload,
        channel_ids: channelIds,
        channel_links: channelIds.map((cid) => ({ channel_id: cid, link: channelLinks[cid] || null })),
        commission_plans: plans.map((p) => ({
          plan_start_date: p.plan_start_date || null,
          currency: p.currency || null,
          description: p.description || null,
          country_id: p.country_id || null,
          brand: p.brand || null,
          baseline: p.baseline === "" ? null : p.baseline,
          cpa: p.cpa === "" ? null : p.cpa,
          rev_share_pct: p.rev_share_pct === "" ? null : p.rev_share_pct,
          cpl: p.cpl === "" ? null : p.cpl,
          wager: p.wager === "" ? null : p.wager,
          conversion_type: p.conversion_type || null,
          cap: p.cap === "" ? null : p.cap,
        })),
      },
    });
    setSaving(false);
    const errMsg = (data as any)?.error || (error as any)?.context?.body?.error || error?.message;
    if (errMsg) { toast.error(errMsg); return; }
    toast.success(!editing && (data as any)?.unique_id ? `Afiliado creado: ${(data as any).unique_id}` : "Guardado");
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar afiliado?")) return;
    const { data, error } = await supabase.functions.invoke("affiliates-manage", {
      body: { action: "delete", id },
    });
    const errMsg = (data as any)?.error || (error as any)?.context?.body?.error || error?.message;
    if (errMsg) { toast.error(errMsg); return; }
    toast.success("Eliminado");
    load();
  };

  const toggleCh = (id: string) => setChannelIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  const canEditFixed = !editing || isSuperAdmin;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold">Afiliados</h1>
          <p className="text-muted-foreground text-sm">El ID único se genera automáticamente al crear el afiliado.</p>
        </div>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Nuevo afiliado</Button></DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editing ? `Editar afiliado ${editing.unique_id}` : "Nuevo afiliado"}</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1">
                  <Label className="flex items-center gap-1">
                    Nombre fijo * {!canEditFixed && <Lock className="h-3 w-3 text-muted-foreground" />}
                  </Label>
                  <Input value={form.fixed_name ?? ""} disabled={!canEditFixed}
                    onChange={(e) => setForm({ ...form, fixed_name: e.target.value })} />
                  {!canEditFixed && <p className="text-xs text-muted-foreground">Solo el super admin puede modificarlo.</p>}
                </div>
                <div className="col-span-2 space-y-1">
                  <Label>Alias (puede cambiar con el tiempo)</Label>
                  <Input value={form.alias ?? ""} onChange={(e) => setForm({ ...form, alias: e.target.value })} />
                </div>
                <div className="space-y-1"><Label>Email</Label>
                  <Input type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div className="space-y-1"><Label>Teléfono</Label>
                  <Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                <div className="space-y-1">
                  <Label>País</Label>
                  <Select value={form.country_id ?? ""} onValueChange={(v) => setForm({ ...form, country_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                    <SelectContent>{countries.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Canales</Label>
                  <div className="flex flex-wrap gap-2 p-2 border rounded-md">
                    {channels.map((c) => (
                      <Badge key={c.id} variant={channelIds.includes(c.id) ? "default" : "outline"}
                             className="cursor-pointer" onClick={() => toggleCh(c.id)}>{c.name}</Badge>
                    ))}
                  </div>
                  <div className="space-y-2 p-3 border rounded-md bg-muted/30">
                    <p className="text-xs font-medium">Link de promoción por canal</p>
                    {channelIds.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Selecciona uno o más canales arriba para agregar sus links.</p>
                    ) : (
                      channelIds.map((cid) => {
                        const ch = channels.find((c) => c.id === cid);
                        return (
                          <div key={cid} className="grid grid-cols-[140px_1fr] gap-2 items-center">
                            <Label className="text-sm">{ch?.name}</Label>
                            <Input
                              type="url"
                              placeholder="https://..."
                              value={channelLinks[cid] ?? ""}
                              onChange={(e) => setChannelLinks({ ...channelLinks, [cid]: e.target.value })}
                            />
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="col-span-2 space-y-2 border rounded-md p-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base">Comisiones</Label>
                    <Button type="button" size="sm" variant="outline" onClick={addPlan}>
                      <Plus className="h-4 w-4 mr-1" /> Agregar plan
                    </Button>
                  </div>
                  {plans.length === 0 && (
                    <p className="text-sm text-muted-foreground">Sin planes de comisión.</p>
                  )}
                  {plans.map((pl, i) => (
                    <div key={i} className="border rounded-md p-3 space-y-2 bg-muted/30">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">Plan #{i + 1}</span>
                        <Button type="button" size="icon" variant="ghost" onClick={() => removePlan(i)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Plan Start Date</Label>
                          <Input type="date" value={pl.plan_start_date}
                            onChange={(e) => updatePlan(i, { plan_start_date: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Currency</Label>
                          <Select value={pl.currency} onValueChange={(v) => updatePlan(i, { currency: v })}>
                            <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="USD">USD</SelectItem>
                              <SelectItem value="EUR">EUR</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-2 space-y-1">
                          <Label className="text-xs">Description</Label>
                          <Input value={pl.description}
                            onChange={(e) => updatePlan(i, { description: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Country</Label>
                          <Select value={pl.country_id ?? ""} onValueChange={(v) => updatePlan(i, { country_id: v })}>
                            <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                            <SelectContent>
                              {countries.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Brand</Label>
                          <Select value={pl.brand} onValueChange={(v) => updatePlan(i, { brand: v })}>
                            <SelectTrigger><SelectValue placeholder={(form.brands ?? []).length ? "Selecciona" : "Agrega marcas arriba"} /></SelectTrigger>
                            <SelectContent>
                              {(form.brands ?? []).map((b: string) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Baseline</Label>
                          <Input type="number" step="0.01" value={pl.baseline}
                            onChange={(e) => updatePlan(i, { baseline: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">CPA</Label>
                          <Input type="number" step="0.01" value={pl.cpa}
                            onChange={(e) => updatePlan(i, { cpa: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Rev Share %</Label>
                          <Input type="number" step="0.01" value={pl.rev_share_pct}
                            onChange={(e) => updatePlan(i, { rev_share_pct: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">CPL</Label>
                          <Input type="number" step="0.01" value={pl.cpl}
                            onChange={(e) => updatePlan(i, { cpl: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Wager</Label>
                          <Input type="number" step="0.01" value={pl.wager}
                            onChange={(e) => updatePlan(i, { wager: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Condición</Label>
                          <Select value={pl.conversion_type} onValueChange={(v) => updatePlan(i, { conversion_type: v })}>
                            <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                            <SelectContent>
                              {CONVERSION_TYPES.map((w) => <SelectItem key={w} value={w}>{w}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">CAP (conversiones autorizadas)</Label>
                          <Input type="number" step="1" value={pl.cap}
                            onChange={(e) => updatePlan(i, { cap: e.target.value })} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="col-span-2 space-y-1"><Label>Notas</Label>
                  <Textarea value={form.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button onClick={save} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>ID</TableHead><TableHead>Nombre fijo</TableHead><TableHead>Alias</TableHead>
              <TableHead>País</TableHead><TableHead>Canales</TableHead><TableHead>Comisión</TableHead>
              <TableHead>Estado</TableHead>
              {isAdmin && <TableHead className="w-24"></TableHead>}
            </TableRow></TableHeader>
            <TableBody>
              {list.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.unique_id}</TableCell>
                  <TableCell className="font-medium">{r.fixed_name}</TableCell>
                  <TableCell>{r.alias || "—"}</TableCell>
                  <TableCell>{r.country?.name}</TableCell>
                  <TableCell className="text-xs">{r.affiliate_channel_links?.map((l: any) => l.channel?.name).join(", ")}</TableCell>
                  <TableCell>{r.commission_pct}%</TableCell>
                  <TableCell><Badge variant={r.status === "active" ? "default" : "secondary"}>{r.status}</Badge></TableCell>
                  {isAdmin && (
                    <TableCell className="space-x-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                      {isSuperAdmin && <Button size="icon" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></Button>}
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {list.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Sin afiliados registrados</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
