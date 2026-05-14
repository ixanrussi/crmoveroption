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
import { Plus, Pencil, Trash2, Lock, X, ChevronDown, DollarSign, TrendingDown, TrendingUp, Percent } from "lucide-react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import AffiliateEarnings from "@/components/AffiliateEarnings";
import AffiliateGoals from "@/components/AffiliateGoals";
import { toast } from "sonner";


const CONVERSION_TYPES = ["NCO", "NNCO"] as const;
import { useCurrencies } from "@/lib/currencies";

type CommissionPlan = {
  template_id?: string;
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
  template_id: "",
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
  const [search, setSearch] = useState("");
  const [countries, setCountries] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [clientPlans, setClientPlans] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [channelIds, setChannelIds] = useState<string[]>([]);
  const [channelLinks, setChannelLinks] = useState<Record<string, string[]>>({});
  const [plans, setPlans] = useState<CommissionPlan[]>([]);
  const [saving, setSaving] = useState(false);

  const empty: any = {
    fixed_name: "", alias: "", aliases: [] as string[], email: "", phone: "", country_ids: [] as string[],
    status: "active", notes: "", fixed_remuneration: "", fixed_remuneration_currency: "",
    fixed_remuneration_min_ftd: "", fixed_remuneration_fallback_cpa: "",
  };
  const [form, setForm] = useState<any>(empty);
  const [aliasInput, setAliasInput] = useState("");

  const [commissionShares, setCommissionShares] = useState<Record<string, { earned: number; pct: number; currency: string | null }>>({});
  const [goalProgress, setGoalProgress] = useState<Record<string, { target: number; current: number; pct: number }>>({});

  const load = async () => {
    const { data } = await supabase
      .from("affiliates")
      .select("*, country:countries(name), affiliate_channel_links(channel_id, link, channel:affiliate_channels(name)), affiliate_commission_plans(*, country:countries(name), template:commission_plan_templates(name))")
      .order("fixed_name", { ascending: true });
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

    // Compute goal progress per affiliate (sum of all goals: target vs qualified)
    const { data: goals } = await supabase
      .from("affiliate_goals")
      .select("affiliate_id, scope, period, client_id, brand, ftd_target");

    const progress: Record<string, { target: number; current: number; pct: number }> = {};
    (goals ?? []).forEach((g: any) => {
      let current = 0;
      (items ?? []).forEach((it: any) => {
        if (it.affiliate_id !== g.affiliate_id) return;
        const cls: any = closureMap.get(it.closure_id);
        if (!cls) return;
        if (g.scope === "monthly" && g.period && cls.period !== g.period) return;
        if (g.client_id && cls.client_id !== g.client_id) return;
        if (g.brand) {
          const a = (it.brand || "").toLowerCase();
          const b = g.brand.toLowerCase();
          if (!(a.includes(b) || b.includes(a))) return;
        }
        current += it.qualified_players || 0;
      });
      const prev = progress[g.affiliate_id] ?? { target: 0, current: 0, pct: 0 };
      prev.target += Number(g.ftd_target || 0);
      prev.current += current;
      progress[g.affiliate_id] = prev;
    });
    Object.keys(progress).forEach((k) => {
      const p = progress[k];
      p.pct = p.target > 0 ? Math.min(100, Math.round((p.current / p.target) * 100)) : 0;
    });
    setGoalProgress(progress);
  };
  const loadLookups = async () => {
    const [c, ch, cl, tpl, cp] = await Promise.all([
      supabase.from("countries").select("*").order("name"),
      supabase.from("affiliate_channels").select("*").order("name"),
      supabase.from("clients").select("id, company_name, brands").order("company_name"),
      supabase.from("commission_plan_templates").select("*, client:clients(company_name)").order("name", { ascending: true }),
      supabase.from("client_commission_plans").select("client_id, brand, cpa, plan_start_date"),
    ]);
    setCountries(c.data ?? []);
    setChannels(ch.data ?? []);
    setClients(cl.data ?? []);
    setTemplates(tpl.data ?? []);
    setClientPlans(cp.data ?? []);
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
    const grouped: Record<string, string[]> = {};
    (row.affiliate_channel_links ?? []).forEach((l: any) => {
      if (!grouped[l.channel_id]) grouped[l.channel_id] = [];
      grouped[l.channel_id].push(l.link ?? "");
    });
    Object.keys(grouped).forEach((k) => {
      if (grouped[k].length === 0) grouped[k] = [""];
    });
    setChannelIds(Object.keys(grouped));
    setChannelLinks(grouped);
    setPlans(
      (row.affiliate_commission_plans ?? []).map((p: any) => ({
        template_id: p.template_id ?? "",
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

  // Returns margin pct between operator (overgroup) CPA and affiliate CPA, or null if not computable
  const getPlanMargin = (pl: CommissionPlan): number | null => {
    const affCpa = Number(pl.cpa);
    if (!pl.client_id || !pl.cpa || !Number.isFinite(affCpa) || affCpa <= 0) return null;
    const bl = (pl.brand || "").toLowerCase();
    const cands = clientPlans
      .filter((cp: any) => cp.client_id === pl.client_id && cp.cpa != null)
      .filter((cp: any) => !pl.brand || !cp.brand || cp.brand.toLowerCase() === bl)
      .sort((a: any, b: any) => (b.plan_start_date || "").localeCompare(a.plan_start_date || ""));
    const opCpa = cands[0]?.cpa != null ? Number(cands[0].cpa) : null;
    if (opCpa == null || !Number.isFinite(opCpa) || opCpa <= 0) return null;
    return ((opCpa - affCpa) / opCpa) * 100;
  };
  const affiliateMinMargin = (r: any): number | null => {
    const ps = Array.isArray(r?.affiliate_commission_plans) ? r.affiliate_commission_plans : [];
    let min: number | null = null;
    for (const p of ps) {
      const m = getPlanMargin({
        client_id: p.client_id ?? "",
        brand: p.brand ?? "",
        cpa: p.cpa?.toString() ?? "",
      } as CommissionPlan);
      if (m != null && (min == null || m < min)) min = m;
    }
    return min;
  };
  const addPlanFromTemplate = (templateId: string) => {
    const t = templates.find((x) => x.id === templateId);
    if (!t) return;
    setPlans((p) => [...p, {
      template_id: t.id,
      plan_start_date: t.plan_start_date ?? "",
      currency: t.currency ?? "",
      description: t.description ?? t.name ?? "",
      country_ids: Array.isArray(t.country_ids) ? t.country_ids : [],
      client_id: t.client_id ?? "",
      brand: t.brand ?? "",
      baseline: t.baseline?.toString() ?? "",
      baseline_currency: t.baseline_currency ?? "",
      cpa: t.cpa?.toString() ?? "",
      cpa_currency: t.cpa_currency ?? "",
      rev_share_pct: t.rev_share_pct?.toString() ?? "",
      cpl: t.cpl?.toString() ?? "",
      cpl_currency: t.cpl_currency ?? "",
      wager: t.wager?.toString() ?? "",
      wager_currency: t.wager_currency ?? "",
      conversion_type: t.conversion_type ?? "",
      cap: t.cap?.toString() ?? "",
    }]);
    toast.success(`Plan "${t.name}" añadido desde el catálogo`);
  };

  const save = async () => {
    if (!form.fixed_name?.trim()) { toast.error("Nombre fijo es requerido"); return; }
    for (const cid of channelIds) {
      const trimmed = (channelLinks[cid] ?? []).map((l) => l.trim()).filter(Boolean);
      if (new Set(trimmed).size !== trimmed.length) {
        toast.error("No se permiten links duplicados en el mismo canal");
        return;
      }
    }
    const aliasesArr: string[] = Array.isArray(form.aliases) ? form.aliases.filter((x: string) => x && x.trim()) : [];
    const payload: any = {
      fixed_name: form.fixed_name,
      alias: aliasesArr[0] || form.alias || null,
      aliases: aliasesArr,
      email: form.email || null, phone: form.phone || null,
      country_ids: Array.isArray(form.country_ids) ? form.country_ids : [],
      notes: form.notes || null,
      fixed_remuneration: form.fixed_remuneration === "" || form.fixed_remuneration == null ? null : Number(form.fixed_remuneration),
      fixed_remuneration_currency: form.fixed_remuneration_currency || null,
      fixed_remuneration_min_ftd: form.fixed_remuneration_min_ftd === "" || form.fixed_remuneration_min_ftd == null ? null : Math.trunc(Number(form.fixed_remuneration_min_ftd)),
      fixed_remuneration_fallback_cpa: form.fixed_remuneration_fallback_cpa === "" || form.fixed_remuneration_fallback_cpa == null ? null : Number(form.fixed_remuneration_fallback_cpa),
    };
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("affiliates-manage", {
      body: {
        action: editing ? "update" : "insert",
        id: editing?.id,
        affiliate: payload,
        channel_ids: channelIds,
        channel_links: channelIds.flatMap((cid) => {
          const arr = (channelLinks[cid] ?? [""]).map((l) => l.trim()).filter((l, i, a) => a.indexOf(l) === i);
          if (arr.length === 0 || (arr.length === 1 && !arr[0])) return [{ channel_id: cid, link: null }];
          return arr.filter(Boolean).map((link) => ({ channel_id: cid, link }));
        }),
        commission_plans: plans.map((p) => ({
          template_id: p.template_id || null,
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

  const toggleCh = (id: string) => setChannelIds((p) => {
    if (p.includes(id)) {
      const next = { ...channelLinks };
      delete next[id];
      setChannelLinks(next);
      return p.filter((x) => x !== id);
    }
    setChannelLinks({ ...channelLinks, [id]: [""] });
    return [...p, id];
  });

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
                        const links = channelLinks[cid] ?? [""];
                        const updateLinks = (next: string[]) =>
                          setChannelLinks({ ...channelLinks, [cid]: next });
                        return (
                          <div key={cid} className="grid gap-1">
                            {links.map((val, idx) => {
                              const trimmed = val.trim();
                              const isDup =
                                trimmed.length > 0 &&
                                links.findIndex((l, i) => i !== idx && l.trim() === trimmed) !== -1;
                              const isLast = idx === links.length - 1;
                              return (
                                <div key={idx} className="grid grid-cols-[140px_1fr_auto_auto] items-center gap-2">
                                  <Label className="text-sm truncate">{idx === 0 ? ch?.name ?? "—" : ""}</Label>
                                  <Input
                                    type="url"
                                    placeholder="https://..."
                                    value={val}
                                    aria-invalid={isDup}
                                    className={isDup ? "border-destructive" : ""}
                                    onChange={(e) => {
                                      const next = [...links];
                                      next[idx] = e.target.value;
                                      updateLinks(next);
                                    }}
                                  />
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8"
                                    disabled={links.length === 1}
                                    onClick={() => updateLinks(links.filter((_, i) => i !== idx))}
                                    title="Eliminar link"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8"
                                    disabled={!isLast}
                                    onClick={() => {
                                      const trimmedAll = links.map((l) => l.trim());
                                      if (trimmedAll.some((l, i) => l && trimmedAll.indexOf(l) !== i)) {
                                        toast.error("No se permiten links duplicados en el mismo canal");
                                        return;
                                      }
                                      updateLinks([...links, ""]);
                                    }}
                                    title="Añadir otro link"
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="col-span-2 rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold">Remuneración fija</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Monto y moneda</Label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={form.fixed_remuneration ?? ""}
                          onChange={(e) => setForm({ ...form, fixed_remuneration: e.target.value })}
                        />
                        <Select
                          value={form.fixed_remuneration_currency ?? ""}
                          onValueChange={(v) => setForm({ ...form, fixed_remuneration_currency: v })}
                        >
                          <SelectTrigger className="w-28"><SelectValue placeholder="Moneda" /></SelectTrigger>
                          <SelectContent>
                            {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Volumen mínimo de FTD/mes</Label>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="Ej. 50"
                        value={form.fixed_remuneration_min_ftd ?? ""}
                        onChange={(e) => setForm({ ...form, fixed_remuneration_min_ftd: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <Label className="text-xs text-muted-foreground">CPA fallback (si no alcanza el volumen)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={form.fixed_remuneration_fallback_cpa ?? ""}
                        onChange={(e) => setForm({ ...form, fixed_remuneration_fallback_cpa: e.target.value })}
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Si el afiliado alcanza el volumen mínimo de FTDs en el mes, recibe la remuneración fija. En caso contrario, se le paga el CPA fallback por FTD.
                  </p>
                </div>

                <div className="col-span-2 space-y-2 border rounded-md p-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <Label className="text-base">Comisiones</Label>
                    <div className="flex items-center gap-2">
                      <Select value="" onValueChange={(v) => { if (v) addPlanFromTemplate(v); }}>
                        <SelectTrigger className="h-8 w-[220px]">
                          <SelectValue placeholder="Asignar desde catálogo…" />
                        </SelectTrigger>
                        <SelectContent>
                          {templates.length === 0 ? (
                            <div className="px-2 py-1.5 text-xs text-muted-foreground">Sin planes en el catálogo</div>
                          ) : templates.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              <span className="flex w-full min-w-0 items-center gap-2">
                                <span className="truncate">
                                  {t.name || "Sin nombre"}{t.client?.company_name ? ` · ${t.client.company_name}` : ""}
                                </span>
                                {t.brand && (
                                  <span className="shrink-0 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                                    {t.brand}
                                  </span>
                                )}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button type="button" size="sm" variant="outline" onClick={addPlan}>
                        <Plus className="h-4 w-4 mr-1" /> Agregar plan
                      </Button>
                    </div>
                  </div>
                  {plans.length === 0 && (
                    <p className="text-sm text-muted-foreground">Sin planes de comisión.</p>
                  )}
                  {plans.map((pl, i) => {
                    const margin = getPlanMargin(pl);
                    const lowMargin = margin != null && margin < 30;
                    return (
                    <Collapsible key={i} defaultOpen={false} className={`border rounded-md ${lowMargin ? "bg-orange-100 dark:bg-orange-950/40 border-orange-300 dark:border-orange-700" : "bg-muted/30"}`}>
                      <div className="flex items-center justify-between p-3">
                        <CollapsibleTrigger asChild>
                          <button type="button" className="flex items-center gap-2 flex-1 text-left min-w-0">
                            <ChevronDown className="h-4 w-4 transition-transform [[data-state=closed]>&]:-rotate-90" />
                            <span className="text-base font-bold text-primary truncate">
                              {clients.find((c) => c.id === pl.client_id)?.company_name || "Sin cliente"}
                            </span>
                            {pl.brand && (
                              <Badge variant="default" className="text-[10px] truncate">
                                {pl.brand}
                              </Badge>
                            )}
                            <span className="text-sm text-muted-foreground truncate">{templates.find((t) => t.id === pl.template_id)?.name || "Sin nombre"}</span>
                            <div className="flex gap-2 ml-2">
                              <Badge variant="secondary">CPA: {pl.cpa || "—"}</Badge>
                              <Badge variant="secondary">Rev Share: {pl.rev_share_pct ? `${pl.rev_share_pct}%` : "—"}</Badge>
                              {lowMargin && (
                                <Badge className="bg-orange-500 hover:bg-orange-500 text-white">
                                  Margen {margin!.toFixed(0)}%
                                </Badge>
                              )}
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
                            <Label className="text-xs">Operador</Label>
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
                                <Input value={pl.brand} placeholder={pl.client_id ? "Operador sin marcas" : "Nombre de la marca"}
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
                    );
                  })}
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
          <div className="p-3 border-b">
            <Input
              placeholder="Buscar por nombre o alias…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
          </div>
          <div className="[&>div]:max-h-[calc(100vh-260px)]">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background shadow-[0_1px_0_0_hsl(var(--border))]"><TableRow>
              <TableHead>ID</TableHead><TableHead>Nombre fijo</TableHead>
              <TableHead className="w-10 text-center">Margen</TableHead>
              <TableHead className="w-10 text-center">Planes</TableHead>
              <TableHead>País</TableHead><TableHead>
                <span className="inline-flex items-center gap-1">
                  % MB
                  <HoverCard openDelay={100}>
                    <HoverCardTrigger asChild>
                      <span className="inline-flex items-center justify-center h-4 w-4 rounded-full border text-[10px] text-muted-foreground cursor-help">?</span>
                    </HoverCardTrigger>
                    <HoverCardContent className="w-64 text-xs" align="start">
                      Impacto del afiliado en el Margen Bruto (MB) de la empresa.
                    </HoverCardContent>
                  </HoverCard>
                </span>
              </TableHead>
              <TableHead className="min-w-[160px]">Objetivo</TableHead>
              <TableHead>Estado</TableHead>
              {isAdmin && <TableHead className="w-24"></TableHead>}
            </TableRow></TableHeader>
            <TableBody>
              {[...list].sort((a, b) => (a.fixed_name || "").localeCompare(b.fixed_name || "")).filter((r) => {
                const q = search.trim().toLowerCase();
                if (!q) return true;
                if (r.fixed_name?.toLowerCase().includes(q)) return true;
                if (r.alias?.toLowerCase().includes(q)) return true;
                if (Array.isArray(r.aliases) && r.aliases.some((a: string) => a?.toLowerCase().includes(q))) return true;
                return false;
              }).map((r) => (
                <TableRow key={r.id} className="[&>td]:py-2">
                  <TableCell className="font-mono text-xs">{r.unique_id}</TableCell>
                  <TableCell className="font-medium">
                    <button
                      type="button"
                      className="text-left hover:underline text-primary"
                      onClick={() => openEdit(r)}
                    >
                      {r.fixed_name}
                    </button>
                    {(() => {
                      const g = goalProgress[r.id];
                      if (!g || g.target === 0) return null;
                      const now = new Date();
                      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
                      const daily = g.target / daysInMonth;
                      return (
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          Meta diaria: {daily.toFixed(1)} FTD
                        </div>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="text-center align-middle">
                    {affiliateHasLowMargin(r) && (
                      <HoverCard openDelay={100}>
                        <HoverCardTrigger asChild>
                          <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-orange-500/15 text-orange-600 cursor-help" aria-label="Margen bajo">
                            <TrendingDown className="h-3 w-3" />
                          </span>
                        </HoverCardTrigger>
                        <HoverCardContent className="w-64 p-2 text-xs" align="start">
                          Tiene planes de comisión con margen menor al 30% respecto al CPA del operador.
                        </HoverCardContent>
                      </HoverCard>
                    )}
                  </TableCell>
                  <TableCell className="text-center align-middle">
                    {Array.isArray(r.affiliate_commission_plans) && r.affiliate_commission_plans.length > 0 && (
                      <HoverCard openDelay={100}>
                        <HoverCardTrigger asChild>
                          <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-emerald-500/15 text-emerald-600 cursor-help">
                            <DollarSign className="h-3 w-3" />
                          </span>
                        </HoverCardTrigger>
                        <HoverCardContent className="w-72 p-2" align="start">
                          <p className="text-xs font-semibold mb-1.5">Planes de comisión</p>
                          <ul className="divide-y divide-border rounded-md overflow-hidden border">
                            {r.affiliate_commission_plans.map((p: any, idx: number) => (
                              <li key={p.id} className={`text-xs flex items-center gap-2 px-2 py-1.5 ${idx % 2 === 0 ? "bg-muted/40" : "bg-background"}`}>
                                <span className="font-medium truncate">{clients.find((c) => c.id === p.client_id)?.company_name || "—"} — {p.template?.name || "Sin nombre"}</span>
                                {p.brand && <Badge variant="outline" className="shrink-0 text-[10px]">{p.brand}</Badge>}
                              </li>
                            ))}
                          </ul>
                        </HoverCardContent>
                      </HoverCard>
                    )}
                  </TableCell>
                  <TableCell>{r.country?.name}</TableCell>
                  <TableCell>
                    {(() => {
                      const s = commissionShares[r.id];
                      if (!s || s.earned === 0) return <span className="text-muted-foreground text-xs">—</span>;
                      return <span className="font-medium">{s.pct.toFixed(2)}%</span>;
                    })()}
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const g = goalProgress[r.id];
                      if (!g || g.target === 0) return <span className="text-muted-foreground text-xs">—</span>;
                      const now = new Date();
                      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
                      const dayOfMonth = now.getDate();
                      const remainingDays = Math.max(1, daysInMonth - dayOfMonth + 1);
                      const expectedPct = (dayOfMonth / daysInMonth) * 100;
                      const ratio = expectedPct > 0 ? g.pct / expectedPct : 1;
                      // green: on/above pace (>=95%), orange: behind (>=70%), red: very behind
                      const color =
                        g.pct >= 100 || ratio >= 0.95
                          ? "hsl(142 71% 45%)"
                          : ratio >= 0.7
                          ? "hsl(32 95% 54%)"
                          : "hsl(0 84% 60%)";
                      const textColor =
                        g.pct >= 100 || ratio >= 0.95
                          ? "text-[hsl(142_71%_45%)]"
                          : ratio >= 0.7
                          ? "text-[hsl(32_95%_54%)]"
                          : "text-[hsl(0_84%_60%)]";
                      const remaining = Math.max(0, g.target - g.current);
                      const dailyNeeded = remaining / remainingDays;
                      return (
                        <div className="flex flex-col gap-1 min-w-[140px]">
                          <div className="flex items-center gap-2">
                            <div className="relative flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full transition-all rounded-full"
                                style={{ width: `${Math.min(100, g.pct)}%`, backgroundColor: color }}
                              />
                              <div
                                className="absolute top-0 bottom-0 w-px bg-foreground/40"
                                style={{ left: `${Math.min(100, expectedPct)}%` }}
                                title={`Pace esperado: ${expectedPct.toFixed(0)}%`}
                              />
                            </div>
                            <span className={`text-xs font-semibold ${textColor}`}>{g.pct}%</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            {remaining > 0
                              ? `${dailyNeeded.toFixed(1)} FTD/día (${remainingDays}d)`
                              : "Objetivo alcanzado"}
                          </span>
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
                <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">Sin afiliados registrados</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
