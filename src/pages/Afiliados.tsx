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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2, Lock, X, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";


const CONVERSION_TYPES = ["NCO", "NNCO"] as const;

type CommissionPlan = {
  plan_start_date: string;
  currency: string;
  description: string;
  country_ids: string[];
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
  plan_start_date: "", currency: "", description: "", country_ids: [], brand: "",
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
    fixed_name: "", alias: "", aliases: [] as string[], email: "", phone: "", country_ids: [] as string[],
    status: "active", notes: "",
  };
  const [form, setForm] = useState<any>(empty);
  const [aliasInput, setAliasInput] = useState("");

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
    const affIds: string[] = Array.isArray(row?.country_ids) && row.country_ids.length > 0
      ? row.country_ids
      : (row?.country_id ? [row.country_id] : []);
    setForm({ ...row, country_ids: affIds });
    setChannelIds(row.affiliate_channel_links?.map((l: any) => l.channel_id) ?? []);
    const links: Record<string, string> = {};
    row.affiliate_channel_links?.forEach((l: any) => { if (l.link) links[l.channel_id] = l.link; });
    setChannelLinks(links);
    setPlans(
      (row.affiliate_commission_plans ?? []).map((p: any) => ({
        plan_start_date: p.plan_start_date ?? "",
        currency: p.currency ?? "",
        description: p.description ?? "",
        country_ids: Array.isArray(p.country_ids) && p.country_ids.length > 0 ? p.country_ids : (p.country_id ? [p.country_id] : []),
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
      country_ids: Array.isArray(form.country_ids) ? form.country_ids : [],
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
          country_ids: Array.isArray(p.country_ids) ? p.country_ids : [],
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
    window.location.reload();
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
          <Dialog
            open={open}
            onOpenChange={(v) => {
              if (!v && open) {
                if (!window.confirm("¿Cerrar el formulario? Se perderán los cambios no guardados.")) return;
              }
              setOpen(v);
            }}
          >
            <DialogTrigger asChild><Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Nuevo afiliado</Button></DialogTrigger>
            <DialogContent
              className="max-w-2xl max-h-[90vh] overflow-y-auto"
              onPointerDownOutside={(e) => e.preventDefault()}
              onInteractOutside={(e) => e.preventDefault()}
            >
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
                  <Label>GEO's (países)</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline" className="w-full justify-between font-normal">
                        <span className="truncate">
                          {(form.country_ids ?? []).length === 0
                            ? "Selecciona uno o más"
                            : countries
                                .filter((c) => (form.country_ids ?? []).includes(c.id))
                                .map((c) => c.name)
                                .join(", ")}
                        </span>
                        <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[280px] p-2 max-h-72 overflow-y-auto overscroll-contain"
                      align="start"
                      onWheel={(e) => { e.currentTarget.scrollTop += e.deltaY; e.stopPropagation(); }}
                      onTouchMove={(e) => e.stopPropagation()}
                    >
                      <div className="space-y-1">
                        {[...countries].sort((a, b) => a.name.localeCompare(b.name)).map((c) => {
                          const checked = (form.country_ids ?? []).includes(c.id);
                          return (
                            <label key={c.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer">
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(v) => {
                                  const cur: string[] = form.country_ids ?? [];
                                  setForm({ ...form, country_ids: v ? [...cur, c.id] : cur.filter((id) => id !== c.id) });
                                }}
                              />
                              <span className="text-sm">{c.name}</span>
                            </label>
                          );
                        })}
                        {countries.length === 0 && (
                          <p className="text-sm text-muted-foreground p-2">Sin países disponibles</p>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
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
                    <Collapsible key={i} defaultOpen={false} className="border rounded-md bg-muted/30">
                      <div className="flex items-center justify-between p-3">
                        <CollapsibleTrigger asChild>
                          <button type="button" className="flex items-center gap-2 flex-1 text-left min-w-0">
                            <ChevronDown className="h-4 w-4 transition-transform [[data-state=closed]>&]:-rotate-90" />
                            <span className="text-xs font-medium text-muted-foreground">Plan #{i + 1}</span>
                            <span className="text-sm font-medium truncate">{pl.description || "Sin descripción"}</span>
                            <div className="flex gap-2 ml-2">
                              <Badge variant="secondary">CPA: {pl.cpa || "—"}</Badge>
                              <Badge variant="secondary">Rev Share: {pl.rev_share_pct ? `${pl.rev_share_pct}%` : "—"}</Badge>
                            </div>
                          </button>
                        </CollapsibleTrigger>
                        <Button type="button" size="icon" variant="ghost" onClick={() => removePlan(i)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <CollapsibleContent className="px-3 pb-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="col-span-2 space-y-1">
                            <Label className="text-xs">Descripción</Label>
                            <Input value={pl.description}
                              onChange={(e) => updatePlan(i, { description: e.target.value })} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Fecha de inicio del plan</Label>
                            <Input type="date" value={pl.plan_start_date}
                              onChange={(e) => updatePlan(i, { plan_start_date: e.target.value })} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Moneda</Label>
                            <Select value={pl.currency} onValueChange={(v) => updatePlan(i, { currency: v })}>
                              <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="USD">USD</SelectItem>
                                <SelectItem value="EUR">EUR</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">GEO's (países)</Label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button type="button" variant="outline" className="w-full justify-between font-normal h-9">
                                  <span className="truncate text-xs">
                                    {(pl.country_ids ?? []).length === 0
                                      ? "Selecciona uno o más"
                                      : countries
                                          .filter((c) => (pl.country_ids ?? []).includes(c.id))
                                          .map((c) => c.name)
                                          .join(", ")}
                                  </span>
                                  <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent
                                className="w-[280px] p-2 max-h-72 overflow-y-auto overscroll-contain"
                                align="start"
                                onWheel={(e) => { e.currentTarget.scrollTop += e.deltaY; e.stopPropagation(); }}
                                onTouchMove={(e) => e.stopPropagation()}
                              >
                                <div className="space-y-1">
                                  {[...countries].sort((a, b) => a.name.localeCompare(b.name)).map((c) => {
                                    const checked = (pl.country_ids ?? []).includes(c.id);
                                    return (
                                      <label key={c.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer">
                                        <Checkbox
                                          checked={checked}
                                          onCheckedChange={(v) => {
                                            const cur: string[] = pl.country_ids ?? [];
                                            updatePlan(i, { country_ids: v ? [...cur, c.id] : cur.filter((id) => id !== c.id) });
                                          }}
                                        />
                                        <span className="text-sm">{c.name}</span>
                                      </label>
                                    );
                                  })}
                                  {countries.length === 0 && (
                                    <p className="text-sm text-muted-foreground p-2">Sin países disponibles</p>
                                  )}
                                </div>
                              </PopoverContent>
                            </Popover>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Marca</Label>
                            <Input value={pl.brand} placeholder="Nombre de la marca"
                              onChange={(e) => updatePlan(i, { brand: e.target.value })} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Línea base</Label>
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
                            <Label className="text-xs">Apuesta</Label>
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
                      </CollapsibleContent>
                    </Collapsible>
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
