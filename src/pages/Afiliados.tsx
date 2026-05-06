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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import AffiliateEarnings from "@/components/AffiliateEarnings";
import AffiliateGoals from "@/components/AffiliateGoals";
import { toast } from "sonner";


const CONVERSION_TYPES = ["NCO", "NNCO"] as const;
import { useCurrencies } from "@/lib/currencies";

type CommissionPlan = {
  plan_start_date: string;
  currency: string;
  description: string;
  country_ids: string[];
  client_id: string;
  brand: string;
  baseline: string;
  baseline_currency: string;
  cpa: string;
  cpa_currency: string;
  rev_share_pct: string;
  cpl: string;
  cpl_currency: string;
  wager: string;
  wager_currency: string;
  conversion_type: string;
  cap: string;
};
const emptyPlan: CommissionPlan = {
  plan_start_date: "", currency: "", description: "", country_ids: [], client_id: "", brand: "",
  baseline: "", baseline_currency: "",
  cpa: "", cpa_currency: "",
  rev_share_pct: "",
  cpl: "", cpl_currency: "",
  wager: "", wager_currency: "",
  conversion_type: "", cap: "",
};

export default function Afiliados() {
  const { isAdmin, isSuperAdmin } = useAuth();
  const CURRENCIES = useCurrencies();
  const [list, setList] = useState<any[]>([]);
  const [countries, setCountries] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
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

  const [commissionShares, setCommissionShares] = useState<Record<string, { earned: number; pct: number; currency: string | null }>>({});

  const load = async () => {
    const { data } = await supabase
      .from("affiliates")
      .select("*, country:countries(name), affiliate_channel_links(channel_id, link, channel:affiliate_channels(name)), affiliate_commission_plans(*, country:countries(name))")
      .order("created_at", { ascending: false });
    setList(data ?? []);

    // Compute affiliate share of total billed (commission_total) by Overoption
    const [{ data: items }, { data: closures }] = await Promise.all([
      supabase.from("commission_closure_items").select("affiliate_id, commission_total, qualified_players, report_type, brand, closure_id, currency"),
      supabase.from("commission_closures").select("id, client_id, period, currency"),
    ]);
    const { data: plans } = await supabase
      .from("affiliate_commission_plans")
      .select("affiliate_id, client_id, brand, cpa, plan_start_date");

    const closureMap = new Map((closures ?? []).map((c: any) => [c.id, c]));
    const totalBilled = (items ?? []).reduce((s: number, it: any) => s + Number(it.commission_total || 0), 0);

    const findCpa = (affId: string, clientId: string, brand: string | null) => {
      const cands = (plans ?? []).filter((p: any) => p.affiliate_id === affId && p.cpa != null && (!p.client_id || p.client_id === clientId));
      const bl = (brand || "").toLowerCase();
      const elig = cands
        .filter((p: any) => !p.brand || bl.includes(p.brand.toLowerCase()) || p.brand.toLowerCase().includes(bl))
        .sort((a: any, b: any) => (b.plan_start_date || "").localeCompare(a.plan_start_date || ""));
      return elig[0]?.cpa ?? null;
    };

    const shares: Record<string, { earned: number; pct: number; currency: string | null }> = {};
    (items ?? []).forEach((it: any) => {
      if (!it.affiliate_id) return;
      const cls: any = closureMap.get(it.closure_id);
      if (!cls) return;
      const cpa = it.report_type === "cpa" ? findCpa(it.affiliate_id, cls.client_id, it.brand) : null;
      const earned = it.report_type === "cpa" && cpa != null ? Number(cpa) * Number(it.qualified_players || 0) : 0;
      const cur = it.currency || cls.currency || null;
      const cur0 = shares[it.affiliate_id]?.currency ?? cur;
      shares[it.affiliate_id] = {
        earned: (shares[it.affiliate_id]?.earned || 0) + earned,
        pct: 0,
        currency: cur0,
      };
    });
    Object.keys(shares).forEach((k) => {
      shares[k].pct = totalBilled > 0 ? (shares[k].earned / totalBilled) * 100 : 0;
    });
    setCommissionShares(shares);
  };
  const loadLookups = async () => {
    const [c, ch, cl] = await Promise.all([
      supabase.from("countries").select("*").order("name"),
      supabase.from("affiliate_channels").select("*").order("name"),
      supabase.from("clients").select("id, company_name, brands").order("company_name"),
    ]);
    setCountries(c.data ?? []);
    setChannels(ch.data ?? []);
    setClients(cl.data ?? []);
  };
  useEffect(() => { load(); loadLookups(); }, []);

  const openNew = () => { setEditing(null); setForm(empty); setChannelIds([]); setChannelLinks({}); setPlans([]); setAliasInput(""); setOpen(true); };
  const openEdit = (row: any) => {
    setEditing(row);
    const affIds: string[] = Array.isArray(row?.country_ids) && row.country_ids.length > 0
      ? row.country_ids
      : (row?.country_id ? [row.country_id] : []);
    const aliasesArr: string[] = Array.isArray(row?.aliases) && row.aliases.length > 0
      ? row.aliases
      : (row?.alias ? [row.alias] : []);
    setForm({ ...row, country_ids: affIds, aliases: aliasesArr });
    setAliasInput("");
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
        client_id: p.client_id ?? "",
        brand: p.brand ?? "",
        baseline: p.baseline?.toString() ?? "",
        baseline_currency: p.baseline_currency ?? "",
        cpa: p.cpa?.toString() ?? "",
        cpa_currency: p.cpa_currency ?? "",
        rev_share_pct: p.rev_share_pct?.toString() ?? "",
        cpl: p.cpl?.toString() ?? "",
        cpl_currency: p.cpl_currency ?? "",
        wager: p.wager?.toString() ?? "",
        wager_currency: p.wager_currency ?? "",
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
    const aliasesArr: string[] = Array.isArray(form.aliases) ? form.aliases.filter((x: string) => x && x.trim()) : [];
    const payload: any = {
      fixed_name: form.fixed_name,
      alias: aliasesArr[0] || form.alias || null,
      aliases: aliasesArr,
      email: form.email || null, phone: form.phone || null,
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
          client_id: p.client_id || null,
          brand: p.brand || null,
          baseline: p.baseline === "" ? null : p.baseline,
          baseline_currency: p.baseline_currency || null,
          cpa: p.cpa === "" ? null : p.cpa,
          cpa_currency: p.cpa_currency || null,
          rev_share_pct: p.rev_share_pct === "" ? null : p.rev_share_pct,
          cpl: p.cpl === "" ? null : p.cpl,
          cpl_currency: p.cpl_currency || null,
          wager: p.wager === "" ? null : p.wager,
          wager_currency: p.wager_currency || null,
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
  const [fixedNameUnlocked, setFixedNameUnlocked] = useState(false);
  useEffect(() => { setFixedNameUnlocked(!editing); }, [editing, open]);
  const requestUnlockFixedName = () => {
    if (!isSuperAdmin) return;
    if (window.confirm("¿Confirmas que deseas editar el nombre fijo de este afiliado? Esta acción es sensible y queda auditada.")) {
      setFixedNameUnlocked(true);
    }
  };

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
              <Tabs defaultValue="datos" className="w-full">
                <TabsList className={editing ? "grid w-full grid-cols-3" : "grid w-full grid-cols-1"}>
                  <TabsTrigger value="datos">Datos & Comisiones</TabsTrigger>
                  {editing && <TabsTrigger value="ganadas">Comisiones ganadas</TabsTrigger>}
                  {editing && <TabsTrigger value="objetivos">Objetivos</TabsTrigger>}
                </TabsList>
                <TabsContent value="datos">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1">
                  <Label className="flex items-center gap-1">
                    Nombre fijo * {!fixedNameUnlocked && <Lock className="h-3 w-3 text-muted-foreground" />}
                  </Label>
                  <div className="flex gap-2">
                    <Input value={form.fixed_name ?? ""} disabled={!fixedNameUnlocked}
                      onChange={(e) => setForm({ ...form, fixed_name: e.target.value })} />
                    {editing && isSuperAdmin && !fixedNameUnlocked && (
                      <Button type="button" variant="outline" size="sm" onClick={requestUnlockFixedName}>
                        Editar
                      </Button>
                    )}
                  </div>
                  {!fixedNameUnlocked && editing && (
                    <p className="text-xs text-muted-foreground">
                      {isSuperAdmin
                        ? "Bloqueado. Pulsa Editar y confirma para modificarlo."
                        : "Solo el super admin puede modificarlo."}
                    </p>
                  )}
                </div>
                <div className="col-span-2 space-y-2 border rounded-md p-3">
                  <Label className="text-base">Alias (puede cambiar con el tiempo)</Label>
                  <p className="text-xs text-muted-foreground">Escribe un alias y presiona Enter para agregarlo como tag.</p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Nuevo alias"
                      value={aliasInput}
                      onChange={(e) => setAliasInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const v = aliasInput.trim();
                          if (v && !(form.aliases ?? []).includes(v)) {
                            setForm({ ...form, aliases: [...(form.aliases ?? []), v] });
                          }
                          setAliasInput("");
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        const v = aliasInput.trim();
                        if (v && !(form.aliases ?? []).includes(v)) {
                          setForm({ ...form, aliases: [...(form.aliases ?? []), v] });
                        }
                        setAliasInput("");
                      }}
                    >
                      <Plus className="h-4 w-4 mr-1" /> Agregar
                    </Button>
                  </div>
                  {(form.aliases ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sin alias agregados.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {(form.aliases ?? []).map((a: string, i: number) => (
                        <Badge key={`${a}-${i}`} variant="secondary" className="flex items-center gap-1">
                          {a}
                          <button
                            type="button"
                            onClick={() => setForm({ ...form, aliases: form.aliases.filter((_: string, idx: number) => idx !== i) })}
                            className="hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
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
                                {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
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
                            <Label className="text-xs">Cliente</Label>
                            <Select
                              value={pl.client_id || "__none__"}
                              onValueChange={(v) => updatePlan(i, { client_id: v === "__none__" ? "" : v, brand: "" })}
                            >
                              <SelectTrigger><SelectValue placeholder="Selecciona cliente" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">— Sin cliente —</SelectItem>
                                {clients.map((c) => (
                                  <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Marca</Label>
                            {(() => {
                              const cli = clients.find((c) => c.id === pl.client_id);
                              const brandList: string[] = Array.isArray(cli?.brands) ? cli!.brands : [];
                              if (pl.client_id && brandList.length > 0) {
                                return (
                                  <Select value={pl.brand || "__none__"} onValueChange={(v) => updatePlan(i, { brand: v === "__none__" ? "" : v })}>
                                    <SelectTrigger><SelectValue placeholder="Selecciona marca" /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="__none__">— Sin marca —</SelectItem>
                                      {brandList.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                );
                              }
                              return (
                                <Input value={pl.brand} placeholder={pl.client_id ? "Cliente sin marcas" : "Nombre de la marca"}
                                  onChange={(e) => updatePlan(i, { brand: e.target.value })} />
                              );
                            })()}
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Línea base</Label>
                            <div className="flex gap-1">
                              <Input type="number" step="0.01" value={pl.baseline}
                                onChange={(e) => updatePlan(i, { baseline: e.target.value })} />
                              <Select value={pl.baseline_currency || "__none__"} onValueChange={(v) => updatePlan(i, { baseline_currency: v === "__none__" ? "" : v })}>
                                <SelectTrigger className="w-[90px]"><SelectValue placeholder="—" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">—</SelectItem>
                                  {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">CPA</Label>
                            <div className="flex gap-1">
                              <Input type="number" step="0.01" value={pl.cpa}
                                onChange={(e) => updatePlan(i, { cpa: e.target.value })} />
                              <Select value={pl.cpa_currency || "__none__"} onValueChange={(v) => updatePlan(i, { cpa_currency: v === "__none__" ? "" : v })}>
                                <SelectTrigger className="w-[90px]"><SelectValue placeholder="—" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">—</SelectItem>
                                  {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Rev Share %</Label>
                            <Input type="number" step="0.01" value={pl.rev_share_pct}
                              onChange={(e) => updatePlan(i, { rev_share_pct: e.target.value })} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">CPL</Label>
                            <div className="flex gap-1">
                              <Input type="number" step="0.01" value={pl.cpl}
                                onChange={(e) => updatePlan(i, { cpl: e.target.value })} />
                              <Select value={pl.cpl_currency || "__none__"} onValueChange={(v) => updatePlan(i, { cpl_currency: v === "__none__" ? "" : v })}>
                                <SelectTrigger className="w-[90px]"><SelectValue placeholder="—" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">—</SelectItem>
                                  {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Apuesta</Label>
                            <div className="flex gap-1">
                              <Input type="number" step="0.01" value={pl.wager}
                                onChange={(e) => updatePlan(i, { wager: e.target.value })} />
                              <Select value={pl.wager_currency || "__none__"} onValueChange={(v) => updatePlan(i, { wager_currency: v === "__none__" ? "" : v })}>
                                <SelectTrigger className="w-[90px]"><SelectValue placeholder="—" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">—</SelectItem>
                                  {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
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
                </TabsContent>
                {editing && (
                  <TabsContent value="ganadas">
                    <AffiliateEarnings affiliateId={editing.id} />
                  </TabsContent>
                )}
                {editing && (
                  <TabsContent value="objetivos">
                    <AffiliateGoals affiliateId={editing.id} />
                  </TabsContent>
                )}
              </Tabs>
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
                  <TableCell className="font-medium">
                    <button
                      type="button"
                      className="text-left hover:underline text-primary"
                      onClick={() => openEdit(r)}
                    >
                      {r.fixed_name}
                    </button>
                  </TableCell>
                  <TableCell>
                    {Array.isArray(r.aliases) && r.aliases.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {r.aliases.map((a: string, i: number) => (
                          <Badge key={`${a}-${i}`} variant="secondary" className="text-xs">{a}</Badge>
                        ))}
                      </div>
                    ) : (r.alias || "—")}
                  </TableCell>
                  <TableCell>{r.country?.name}</TableCell>
                  <TableCell className="text-xs">{r.affiliate_channel_links?.map((l: any) => l.channel?.name).join(", ")}</TableCell>
                  <TableCell>
                    {(() => {
                      const s = commissionShares[r.id];
                      if (!s || s.earned === 0) return <span className="text-muted-foreground text-xs">—</span>;
                      const fmt = new Intl.NumberFormat("es-ES", { style: "currency", currency: s.currency || "EUR" }).format(s.earned);
                      return (
                        <div className="flex flex-col">
                          <span className="font-medium text-success text-sm">{fmt}</span>
                          <span className="text-[10px] text-muted-foreground">{s.pct.toFixed(2)}% del total</span>
                        </div>
                      );
                    })()}
                  </TableCell>
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
