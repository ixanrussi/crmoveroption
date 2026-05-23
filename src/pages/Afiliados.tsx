import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2, Lock, X, ChevronDown, DollarSign, TrendingDown, TrendingUp, Percent, Link2, BarChart3 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import AffiliateEarnings from "@/components/AffiliateEarnings";
import AffiliateGoals from "@/components/AffiliateGoals";
import AffiliateTrackingLinks from "@/components/AffiliateTrackingLinks";
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
  const navigate = useNavigate();
  const { isAdmin, isSuperAdmin } = useAuth();
  const CURRENCIES = useCurrencies();
  const [list, setList] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [countries, setCountries] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [clientPlans, setClientPlans] = useState<any[]>([]);
  const [validationRates, setValidationRates] = useState<Record<string, number>>({});
  const [templates, setTemplates] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [channelIds, setChannelIds] = useState<string[]>([]);
  const [channelLinks, setChannelLinks] = useState<Record<string, string[]>>({});
  const [plans, setPlans] = useState<CommissionPlan[]>([]);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState<{ message: string; affiliate_id: string; affiliate_name: string } | null>(null);

  const empty: any = {
    fixed_name: "", alias: "", aliases: [] as string[], email: "", phone: "", country_ids: [] as string[],
    status: "active", notes: "", fixed_remuneration: "", fixed_remuneration_currency: "",
    fixed_remuneration_min_ftd: "", fixed_remuneration_fallback_cpa: "", fixed_remuneration_fallback_cpa_currency: "",
    fixed_remuneration_installments: [] as { pct: string; date: string; description: string }[],
    avatar_url: "", ext_id_oo: "",
  };
  const [form, setForm] = useState<any>(empty);
  const [aliasInput, setAliasInput] = useState("");

  const [commissionShares, setCommissionShares] = useState<Record<string, { earned: number; pct: number; currency: string | null }>>({});
  const [goalProgress, setGoalProgress] = useState<Record<string, { target: number; current: number; pct: number }>>({});
  const [missingLinks, setMissingLinks] = useState<Record<string, number>>({});

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

    // Compute missing tracking links per affiliate (plans without a link for client+brand)
    const { data: tlinks } = await supabase
      .from("affiliate_tracking_links")
      .select("affiliate_id, client_id, brand");
    const linkSet = new Set<string>();
    (tlinks ?? []).forEach((l: any) => {
      linkSet.add(`${l.affiliate_id}::${l.client_id}::${(l.brand || "").toLowerCase()}`);
    });
    const missing: Record<string, number> = {};
    (data ?? []).forEach((aff: any) => {
      const seen = new Set<string>();
      let cnt = 0;
      (aff.affiliate_commission_plans ?? []).forEach((p: any) => {
        const key = `${aff.id}::${p.client_id}::${(p.brand || "").toLowerCase()}`;
        if (seen.has(key)) return;
        seen.add(key);
        if (!linkSet.has(key)) cnt++;
      });
      if (cnt > 0) missing[aff.id] = cnt;
    });
    setMissingLinks(missing);
  };
  const loadLookups = async () => {
    const [c, ch, cl, tpl, cp] = await Promise.all([
      supabase.from("countries").select("*").order("name"),
      supabase.from("affiliate_channels").select("*").order("name"),
      supabase.from("clients").select("id, company_name, brands").order("company_name"),
      supabase.from("commission_plan_templates").select("*, client:clients(company_name)").order("name", { ascending: true }),
      supabase.from("client_commission_plans").select("client_id, brand, cpa, rev_share_pct, plan_start_date"),
    ]);
    setCountries(c.data ?? []);
    setChannels(ch.data ?? []);
    setClients(cl.data ?? []);
    setTemplates(tpl.data ?? []);
    setClientPlans(cp.data ?? []);

    // Tasa de validación por operador: qualified / locked a partir de cierres mensuales.
    const { data: ci } = await supabase
      .from("commission_closure_items")
      .select("closure_id, qualified_players, locked_players, closure:commission_closures(client_id)");
    const agg: Record<string, { q: number; l: number }> = {};
    (ci ?? []).forEach((row: any) => {
      const cid = row?.closure?.client_id;
      if (!cid) return;
      const q = Number(row.qualified_players) || 0;
      const l = Number(row.locked_players) || 0;
      if (!agg[cid]) agg[cid] = { q: 0, l: 0 };
      agg[cid].q += q;
      agg[cid].l += l;
    });
    const rates: Record<string, number> = {};
    Object.entries(agg).forEach(([cid, { q, l }]) => {
      if (l > 0) rates[cid] = q / l;
    });
    setValidationRates(rates);
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
    const installmentsArr = Array.isArray(row?.fixed_remuneration_installments)
      ? row.fixed_remuneration_installments.map((x: any) => ({
          pct: x?.pct == null ? "" : String(x.pct),
          date: x?.date ?? "",
          description: x?.description ?? "",
        }))
      : [];
    setForm({ ...row, country_ids: affIds, aliases: aliasesArr, fixed_remuneration_installments: installmentsArr });
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
  // Rentabilidad esperada para Overoption por plantilla.
  // Combina el margen de CPA retenido, los puntos de RS retenidos y, cuando hay
  // historial de cierres, la tasa de validación (qualified/locked) del operador.
  const getTemplateScore = (t: any): { score: number; cpaProfit: number | null; rsPp: number | null; valRate: number; hasValData: boolean } => {
    const affCpa = t.cpa != null ? Number(t.cpa) : null;
    const affRs = t.rev_share_pct != null ? Number(t.rev_share_pct) : null;
    const bl = (t.brand || "").toLowerCase();
    const cands = clientPlans
      .filter((cp: any) => cp.client_id === t.client_id)
      .filter((cp: any) => !t.brand || !cp.brand || cp.brand.toLowerCase() === bl)
      .sort((a: any, b: any) => (b.plan_start_date || "").localeCompare(a.plan_start_date || ""));
    const op = cands[0];
    const opCpa = op?.cpa != null ? Number(op.cpa) : null;
    const opRs = op?.rev_share_pct != null ? Number(op.rev_share_pct) : null;
    const valRate = t.client_id && validationRates[t.client_id] != null ? validationRates[t.client_id] : 1;
    const hasValData = t.client_id ? validationRates[t.client_id] != null : false;
    const cpaProfit = opCpa != null && affCpa != null && Number.isFinite(opCpa - affCpa) ? (opCpa - affCpa) : null;
    const rsPp = opRs != null && affRs != null && Number.isFinite(opRs - affRs) ? (opRs - affRs) : null;
    const score = ((cpaProfit ?? 0) * valRate) + (rsPp ?? 0);
    return { score, cpaProfit, rsPp, valRate, hasValData };
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
      fixed_remuneration_fallback_cpa_currency: form.fixed_remuneration_fallback_cpa_currency || null,
      fixed_remuneration_installments: Array.isArray(form.fixed_remuneration_installments)
        ? form.fixed_remuneration_installments
            .map((x: any) => ({
              pct: x?.pct === "" || x?.pct == null ? null : Number(x.pct),
              date: x?.date || null,
              description: x?.description?.trim() ? x.description.trim() : null,
            }))
            .filter((x: any) => x.pct != null || x.date || x.description)
        : [],
      avatar_url: form.avatar_url || null,
      ext_id_oo: form.ext_id_oo?.trim() || null,
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
    let respBody: any = (data as any) || {};
    if (!respBody?.error && (error as any)?.context) {
      try {
        const ctx = (error as any).context;
        if (typeof ctx?.json === "function") respBody = await ctx.json();
        else if (typeof ctx?.text === "function") respBody = JSON.parse(await ctx.text());
        else if (ctx?.body) respBody = ctx.body;
      } catch { /* ignore */ }
    }
    const errMsg = respBody?.error || error?.message;
    const conflictInfo = respBody?.conflict;
    if (errMsg) {
      if (conflictInfo?.affiliate_id) {
        setConflict({ message: errMsg, affiliate_id: conflictInfo.affiliate_id, affiliate_name: conflictInfo.affiliate_name });
      } else {
        toast.error(errMsg);
      }
      return;
    }
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
                <TabsList className={editing ? "grid w-full grid-cols-4" : "grid w-full grid-cols-1"}>
                  <TabsTrigger value="datos">Datos & Comisiones</TabsTrigger>
                  {editing && <TabsTrigger value="links">Tracking Links</TabsTrigger>}
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
                <div className="col-span-2 space-y-1">
                  <Label>Imagen del afiliado (avatar para landing pages)</Label>
                  <div className="flex items-center gap-3">
                    {form.avatar_url ? (
                      <img
                        src={form.avatar_url}
                        alt="Avatar del afiliado"
                        className="h-16 w-16 rounded-full object-cover border bg-white"
                      />
                    ) : (
                      <div className="h-16 w-16 rounded-full border border-dashed flex items-center justify-center text-[10px] text-muted-foreground text-center px-1">
                        Sin imagen
                      </div>
                    )}
                    <Input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const ext = file.name.split(".").pop()?.toLowerCase() || "png";
                        const base = (form.fixed_name || "affiliate")
                          .toLowerCase()
                          .replace(/[^a-z0-9]+/g, "-")
                          .replace(/^-|-$/g, "") || "affiliate";
                        const path = `${base}-${Date.now()}.${ext}`;
                        const { error: upErr } = await supabase.storage
                          .from("affiliate-avatars")
                          .upload(path, file, { upsert: true, contentType: file.type });
                        if (upErr) { toast.error(upErr.message); return; }
                        const { data: pub } = supabase.storage.from("affiliate-avatars").getPublicUrl(path);
                        setForm((f: any) => ({ ...f, avatar_url: pub.publicUrl }));
                        toast.success("Imagen subida");
                      }}
                    />
                    {form.avatar_url && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setForm((f: any) => ({ ...f, avatar_url: "" }))}
                      >
                        Quitar
                      </Button>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Recomendado: imagen cuadrada (ej. 400×400) tipo perfil. Se mostrará en la landing page del afiliado.
                  </p>
                </div>
                <div className="col-span-2 space-y-1">
                  <Label>EXT_ID_OO</Label>
                  <Input
                    value={form.ext_id_oo ?? ""}
                    onChange={(e) => setForm({ ...form, ext_id_oo: e.target.value })}
                    placeholder="ID externo en otras plataformas de Over Option"
                  />
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
                      <Label className="text-xs text-muted-foreground">Volumen mínimo de CPA/mes</Label>
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
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={form.fixed_remuneration_fallback_cpa ?? ""}
                          onChange={(e) => setForm({ ...form, fixed_remuneration_fallback_cpa: e.target.value })}
                        />
                        <Select
                          value={form.fixed_remuneration_fallback_cpa_currency ?? ""}
                          onValueChange={(v) => setForm({ ...form, fixed_remuneration_fallback_cpa_currency: v })}
                        >
                          <SelectTrigger className="w-28"><SelectValue placeholder="Moneda" /></SelectTrigger>
                          <SelectContent>
                            {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Si el afiliado alcanza el volumen mínimo de CPAs en el mes, recibe la remuneración fija. En caso contrario, se le paga el CPA fallback por CPA.
                  </p>

                  {(() => {
                    const installments: { pct: string; date: string; description: string }[] = Array.isArray(form.fixed_remuneration_installments) ? form.fixed_remuneration_installments : [];
                    const totalPct = installments.reduce((s, x) => s + (Number(x.pct) || 0), 0);
                    const update = (next: typeof installments) => setForm({ ...form, fixed_remuneration_installments: next });
                    return (
                      <div className="rounded-md border border-border bg-background p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div>
                            <Label className="text-xs font-semibold">Forma de pago — Cuotas</Label>
                            <p className="text-[11px] text-muted-foreground">Define una o más cuotas con porcentaje, fecha y regla opcional.</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={totalPct === 100 ? "default" : totalPct > 100 ? "destructive" : "outline"} className="text-[10px]">
                              Total: {totalPct}%
                            </Badge>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8"
                              onClick={() => update([...installments, { pct: "", date: "", description: "" }])}
                            >
                              <Plus className="h-3.5 w-3.5 mr-1" /> Añadir cuota
                            </Button>
                          </div>
                        </div>
                        {installments.length === 0 ? (
                          <p className="text-[11px] text-muted-foreground italic">Sin cuotas configuradas — el pago se realiza en una sola vez.</p>
                        ) : (
                          <div className="space-y-2">
                            {installments.map((it, idx) => (
                              <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                                <div className="col-span-12 md:col-span-1 text-xs text-muted-foreground pb-2">#{idx + 1}</div>
                                <div className="col-span-4 md:col-span-2 space-y-1">
                                  <Label className="text-[10px] text-muted-foreground">Porcentaje</Label>
                                  <div className="relative">
                                    <Input
                                      type="number"
                                      min="0"
                                      max="100"
                                      step="0.01"
                                      placeholder="50"
                                      value={it.pct}
                                      onChange={(e) => {
                                        const next = [...installments];
                                        next[idx] = { ...next[idx], pct: e.target.value };
                                        update(next);
                                      }}
                                      className="pr-7"
                                    />
                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                                  </div>
                                </div>
                                <div className="col-span-8 md:col-span-3 space-y-1">
                                  <Label className="text-[10px] text-muted-foreground">Fecha de pago</Label>
                                  <Input
                                    type="date"
                                    value={it.date}
                                    onChange={(e) => {
                                      const next = [...installments];
                                      next[idx] = { ...next[idx], date: e.target.value };
                                      update(next);
                                    }}
                                  />
                                </div>
                                <div className="col-span-11 md:col-span-5 space-y-1">
                                  <Label className="text-[10px] text-muted-foreground">Descripción / regla</Label>
                                  <Input
                                    placeholder="Ej. Al firmar el contrato"
                                    value={it.description}
                                    onChange={(e) => {
                                      const next = [...installments];
                                      next[idx] = { ...next[idx], description: e.target.value };
                                      update(next);
                                    }}
                                  />
                                </div>
                                <div className="col-span-1 flex justify-end">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive"
                                    onClick={() => update(installments.filter((_, i) => i !== idx))}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                            {totalPct !== 100 && installments.length > 0 && (
                              <p className="text-[11px] text-destructive">La suma de porcentajes debe ser 100% (actual: {totalPct}%).</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>


                <div className="col-span-2 space-y-2 border rounded-md p-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <Label className="text-base">Comisiones</Label>
                    <div className="flex items-center gap-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button type="button" variant="outline" size="sm" className="h-8 w-[220px] justify-between font-normal">
                            <span className="truncate text-muted-foreground">Asignar desde catálogo…</span>
                            <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[360px] p-0" align="end">
                          {(() => {
                            const usedIds = new Set(plans.map((p) => p.template_id).filter(Boolean));
                            const available = templates
                              .map((t) => ({ t, s: getTemplateScore(t) }))
                              .sort((a, b) => b.s.score - a.s.score)
                              .filter(({ t }) => !usedIds.has(t.id));
                            if (templates.length === 0) {
                              return <div className="px-3 py-3 text-xs text-muted-foreground">Sin planes en el catálogo</div>;
                            }
                            if (available.length === 0) {
                              return <div className="px-3 py-3 text-xs text-muted-foreground">Todos los planes ya fueron asignados</div>;
                            }
                            return (
                              <Command
                                filter={(value, search) => {
                                  const s = search.toLowerCase().trim();
                                  if (!s) return 1;
                                  const [brand = "", client = "", name = ""] = value.split("|||");
                                  if (brand.includes(s)) return 1;
                                  if (client.includes(s)) return 0.7;
                                  if (name.includes(s)) return 0.4;
                                  return 0;
                                }}
                              >
                                <CommandInput placeholder="Buscar por marca u operador…" />
                                <CommandList>
                                  <CommandEmpty>Sin resultados.</CommandEmpty>
                                  <CommandGroup>
                                    {available.map(({ t, s }) => {
                                      const parts: string[] = [];
                                      if (s.cpaProfit != null) parts.push(`CPA +${s.cpaProfit.toFixed(2)}`);
                                      if (s.rsPp != null) parts.push(`RS +${s.rsPp.toFixed(1)}pp`);
                                      if (s.hasValData) parts.push(`val ${(s.valRate * 100).toFixed(0)}%`);
                                      const badge = parts.length > 0 ? parts.join(" · ") : "sin datos";
                                      const tone = s.score > 0
                                        ? "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400"
                                        : s.score < 0
                                        ? "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400"
                                        : "border-muted bg-muted text-muted-foreground";
                                      const searchValue = `${(t.brand || "").toLowerCase()}|||${(t.client?.company_name || "").toLowerCase()}|||${(t.name || "").toLowerCase()}|||${t.id}`;
                                      return (
                                        <CommandItem
                                          key={t.id}
                                          value={searchValue}
                                          onSelect={() => addPlanFromTemplate(t.id)}
                                        >
                                          <span className="flex w-full min-w-0 items-center gap-2">
                                            <span className="truncate">
                                              {t.name || "Sin nombre"}{t.client?.company_name ? ` · ${t.client.company_name}` : ""}
                                            </span>
                                            {t.brand && (
                                              <span className="shrink-0 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                                                {t.brand}
                                              </span>
                                            )}
                                            <span
                                              className={`shrink-0 ml-auto rounded-full border px-2 py-0.5 text-[10px] font-semibold ${tone}`}
                                              title={`Rentabilidad estimada Overoption${s.hasValData ? "" : " (sin tasa de validación histórica, asumida 100%)"}`}
                                            >
                                              {badge}
                                            </span>
                                          </span>
                                        </CommandItem>
                                      );
                                    })}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            );
                          })()}
                        </PopoverContent>
                      </Popover>
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
                  <TabsContent value="links">
                    <AffiliateTrackingLinks affiliateId={editing.id} />
                  </TabsContent>
                )}
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
              <TableHead className="w-10 text-center">Tracking</TableHead>
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
                    <button
                      type="button"
                      onClick={() => openEdit(r)}
                      className={`inline-flex items-center justify-center ${missingLinks[r.id] > 0 ? "text-destructive" : "text-success"}`}
                      title={missingLinks[r.id] > 0 ? "Operadores con plan asignado pero sin tracking link" : "Todos los tracking links asignados"}
                    >
                      <Link2 className="h-4 w-4" />
                    </button>
                  </TableCell>
                  <TableCell className="text-center align-middle">
                    {(() => {
                      const m = affiliateMinMargin(r);
                      if (m == null) return null;
                      let cls = "";
                      let Icon: any = null;
                      let label = "";
                      if (m < 28) { cls = "bg-orange-500/15 text-orange-600"; Icon = TrendingDown; label = "Margen bajo"; }
                      else if (m <= 32) { cls = "bg-emerald-500/15 text-emerald-600"; Icon = Percent; label = "Margen en rango"; }
                      else if (m >= 33) { cls = "bg-emerald-500/15 text-emerald-600"; Icon = TrendingUp; label = "Margen alto"; }
                      else return null;
                      return (
                        <HoverCard openDelay={100}>
                          <HoverCardTrigger asChild>
                            <span className={`inline-flex items-center justify-center h-5 w-5 rounded-full cursor-help ${cls}`} aria-label={label}>
                              <Icon className="h-3 w-3" />
                            </span>
                          </HoverCardTrigger>
                          <HoverCardContent className="w-64 p-2 text-xs" align="start">
                            {label}: peor margen del afiliado vs CPA del operador es {m.toFixed(0)}%.
                          </HoverCardContent>
                        </HoverCard>
                      );
                    })()}
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
                      <Button size="icon" variant="ghost" title="Ver performance" onClick={() => navigate(`/afiliados/${r.id}/performance`)}><BarChart3 className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                      {isSuperAdmin && <Button size="icon" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></Button>}
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {list.length === 0 && (
                <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-8">Sin afiliados registrados</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!conflict} onOpenChange={(v) => { if (!v) setConflict(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">Duplicado detectado</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3 pt-2">
                <p className="text-sm">
                  {conflict?.message?.replace(conflict?.affiliate_name ?? "", "").trim()}{" "}
                  {conflict?.affiliate_name && (
                    <button
                      type="button"
                      className="text-primary underline font-medium hover:no-underline"
                      onClick={() => {
                        const row = list.find((r) => r.id === conflict.affiliate_id);
                        if (row) {
                          setConflict(null);
                          openEdit(row);
                        } else {
                          toast.error("No se encontró el afiliado en la lista");
                        }
                      }}
                    >
                      {conflict.affiliate_name}
                    </button>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">Ajusta el nombre o los alias e intenta nuevamente.</p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConflict(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
