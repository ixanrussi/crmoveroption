import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, X, ChevronDown, ExternalLink, Lock, Unlock, DollarSign, ShieldCheck, Link2, BarChart3 } from "lucide-react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { toast } from "sonner";
import { useCurrencies } from "@/lib/currencies";
import ClientContractsUploader from "@/components/ClientContractsUploader";

const STATUSES = ["active", "inactive", "prospect"] as const;
const CLIENT_TYPES = ["Directo", "Agencia", "Network"] as const;
const CHANNELS = [
  { value: "telegram", label: "Telegram" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
  { value: "telefono", label: "Teléfono" },
  { value: "teams", label: "Teams" },
] as const;

type Contact = { name: string; channel: string; contact_id: string; role: string };

const CONTACT_ROLES = [
  { value: "team_leader", label: "Jefe de equipo" },
  { value: "account_manager", label: "Gerente de cuentas" },
  { value: "financial", label: "Finanzas" },
  { value: "technical", label: "Técnico" },
];
type CommissionPlan = {
  plan_start_date: string;
  currency: string;
  description: string;
  country_ids: string[];
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
  overoption_retention: string;
  fallback_cpa: string;
  cpa_at_80: string;
  cpa_at_90: string;
  proportional_enabled: boolean;
  proportional_min_pct: string;
  fixed_margin_pct: string;
  recommended_margin_pct: string;
  fixed_remuneration: string;
  fixed_remuneration_currency: string;
  fixed_remuneration_min_ftd: string;
  fixed_remuneration_fallback_cpa: string;
  fixed_remuneration_fallback_cpa_currency: string;
  fixed_remuneration_installments: { pct: string; date: string; description: string }[];
};
const emptyPlan: CommissionPlan = {
  plan_start_date: "", currency: "", description: "", country_ids: [], brand: "",
  baseline: "", baseline_currency: "", cpa: "", cpa_currency: "", rev_share_pct: "",
  cpl: "", cpl_currency: "", wager: "", wager_currency: "", conversion_type: "", cap: "",
  overoption_retention: "", fallback_cpa: "", cpa_at_80: "", cpa_at_90: "",
  proportional_enabled: false, proportional_min_pct: "", fixed_margin_pct: "", recommended_margin_pct: "",
  fixed_remuneration: "", fixed_remuneration_currency: "",
  fixed_remuneration_min_ftd: "", fixed_remuneration_fallback_cpa: "",
  fixed_remuneration_fallback_cpa_currency: "",
  fixed_remuneration_installments: [],
};
const CONVERSION_TYPES = ["NCO", "NNCO"] as const;

export default function Clientes() {
  const { isAdmin, isSuperAdmin } = useAuth();
  const CURRENCIES = useCurrencies();
  const [list, setList] = useState<any[]>([]);
  const [countries, setCountries] = useState<any[]>([]);
  const [softwares, setSoftwares] = useState<any[]>([]);
  const [affiliates, setAffiliates] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [softwareId, setSoftwareId] = useState<string | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [plans, setPlans] = useState<CommissionPlan[]>([]);
  const [viewing, setViewing] = useState<any | null>(null);
  const [search, setSearch] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const noRsFilter = searchParams.get("filter") === "no-rs";
  const [nameUnlocked, setNameUnlocked] = useState(false);


  const empty = {
    company_name: "", website: "",
    address: "", country_ids: [] as string[], status: "active", notes: "", login: "", senha: "",
    client_type: "", brands: [] as string[], brand_aliases: {} as Record<string, string[]>, net_min_cpa: "", logo_url: "", routy_account_id: "", ext_id_oo: "",
  };
  const [form, setForm] = useState<any>(empty);
  const [brandInput, setBrandInput] = useState("");

   const load = async () => {
     const { data } = await supabase
       .from("clients")
       .select("*, country:countries(name), affiliate:affiliates(unique_id, fixed_name), client_software_links(software_id, software:softwares(name)), client_contacts(id, name, channel, contact_id, role), client_commission_plans(*, country:countries(name))")
       .order("company_name", { ascending: true });
     setList(data ?? []);
   };
  const loadLookups = async () => {
    const [c, s, a] = await Promise.all([
      supabase.from("countries").select("*").order("name"),
      supabase.from("softwares").select("*").order("name"),
      supabase.from("affiliates").select("id, unique_id, fixed_name").order("fixed_name"),
    ]);
    setCountries(c.data ?? []);
    setSoftwares(s.data ?? []);
    setAffiliates(a.data ?? []);
  };
  useEffect(() => { load(); loadLookups(); }, []);

  const countryNames = (row: any): string => {
    const ids: string[] = Array.isArray(row?.country_ids) && row.country_ids.length > 0
      ? row.country_ids
      : (row?.country_id ? [row.country_id] : []);
    if (ids.length === 0) return row?.country?.name ?? "";
    const map = new Map(countries.map((c) => [c.id, c.name]));
    return ids.map((id) => map.get(id) ?? "").filter(Boolean).join(", ");
  };

  const filteredList = list.filter((r) => {
    if (noRsFilter) {
      const plans = Array.isArray(r.client_commission_plans) ? r.client_commission_plans : [];
      const hasRs = plans.some((p: any) => p.rev_share_pct != null && Number(p.rev_share_pct) > 0);
      if (hasRs) return false;
    }
    const q = search.trim().toLowerCase();
    if (!q) return true;
    if (r.company_name?.toLowerCase().includes(q)) return true;
    if (Array.isArray(r.brands) && r.brands.some((b: string) => b?.toLowerCase().includes(q))) return true;
    if (countryNames(r).toLowerCase().includes(q)) return true;
    return false;
  });

  const openNew = () => {
    setEditing(null);
    setForm(empty);
    setSoftwareId(null);
    setContacts([]);
    setPlans([]);
    setBrandInput("");
    setNameUnlocked(false);
    setOpen(true);
  };
  const openEdit = (row: any) => {
    setEditing(row);
    setNameUnlocked(false);
    const ids: string[] = Array.isArray(row.country_ids) && row.country_ids.length > 0
      ? row.country_ids
      : (row.country_id ? [row.country_id] : []);
    setForm({
      ...row,
      country_ids: ids,
      client_type: row.client_type ?? "",
      brands: Array.isArray(row.brands) ? row.brands : [],
      brand_aliases: (row.brand_aliases && typeof row.brand_aliases === "object" && !Array.isArray(row.brand_aliases)) ? row.brand_aliases : {},
      net_min_cpa: row.net_min_cpa?.toString() ?? "",
      routy_account_id: row.routy_account_id ?? "",
    });
    setSoftwareId(row.client_software_links?.[0]?.software_id ?? null);
    setContacts(
      (row.client_contacts ?? []).map((c: any) => ({
        name: c.name ?? "",
        channel: c.channel ?? "email",
        contact_id: c.contact_id ?? "",
        role: c.role ?? "",
      })),
    );
    setPlans(
      (row.client_commission_plans ?? []).map((p: any) => ({
        plan_start_date: p.plan_start_date ?? "",
        currency: p.currency ?? "",
        description: p.description ?? "",
        country_ids: Array.isArray(p.country_ids) && p.country_ids.length > 0 ? p.country_ids : (p.country_id ? [p.country_id] : []),
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
        overoption_retention: p.overoption_retention?.toString() ?? "",
        fallback_cpa: p.fallback_cpa?.toString() ?? "",
        cpa_at_80: p.cpa_at_80?.toString() ?? "",
        cpa_at_90: p.cpa_at_90?.toString() ?? "",
        proportional_enabled: !!p.proportional_enabled,
        proportional_min_pct: p.proportional_min_pct?.toString() ?? "",
        fixed_margin_pct: p.fixed_margin_pct?.toString() ?? "",
        recommended_margin_pct: p.recommended_margin_pct?.toString() ?? "",
        fixed_remuneration: p.fixed_remuneration?.toString() ?? "",
        fixed_remuneration_currency: p.fixed_remuneration_currency ?? "",
        fixed_remuneration_min_ftd: p.fixed_remuneration_min_ftd?.toString() ?? "",
        fixed_remuneration_fallback_cpa: p.fixed_remuneration_fallback_cpa?.toString() ?? "",
        fixed_remuneration_fallback_cpa_currency: p.fixed_remuneration_fallback_cpa_currency ?? "",
        fixed_remuneration_installments: Array.isArray(p.fixed_remuneration_installments)
          ? p.fixed_remuneration_installments.map((it: any) => ({
              pct: it?.pct?.toString() ?? "",
              date: it?.date ?? "",
              description: it?.description ?? "",
            }))
          : [],
      })),
    );
    setBrandInput("");
    setOpen(true);
  };

  const [saving, setSaving] = useState(false);

  const addContact = () => setContacts((p) => [...p, { name: "", channel: "email", contact_id: "", role: "" }]);
  const updateContact = (i: number, patch: Partial<Contact>) =>
    setContacts((p) => p.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const removeContact = (i: number) => setContacts((p) => p.filter((_, idx) => idx !== i));

  const addPlan = () => setPlans((p) => [...p, { ...emptyPlan }]);
  const updatePlan = (i: number, patch: Partial<CommissionPlan>) =>
    setPlans((p) => p.map((pl, idx) => (idx === i ? { ...pl, ...patch } : pl)));
  const removePlan = (i: number) => setPlans((p) => p.filter((_, idx) => idx !== i));

  const save = async () => {
    if (!form.company_name?.trim()) { toast.error("Nombre de empresa requerido"); return; }
    const cleanContacts = contacts
      .map((c) => ({ name: c.name.trim(), channel: c.channel, contact_id: c.contact_id.trim(), role: c.role || null }))
      .filter((c) => c.name || c.contact_id);
    for (const c of cleanContacts) {
      if (!c.name || !c.contact_id) { toast.error("Cada contacto necesita nombre e ID"); return; }
    }
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("clients-manage", {
      body: {
        action: editing ? "update" : "insert",
        id: editing?.id,
        client: {
          company_name: form.company_name,
          website: form.website,
          address: form.address,
          country_ids: Array.isArray(form.country_ids) ? form.country_ids : [],
          status: form.status,
          notes: form.notes,
          login: form.login,
          senha: form.senha,
          client_type: form.client_type || null,
          brands: Array.isArray(form.brands) ? form.brands : [],
          net_min_cpa: form.net_min_cpa === "" ? null : form.net_min_cpa,
          logo_url: form.logo_url || null,
          routy_account_id: form.routy_account_id || null,
          ext_id_oo: form.ext_id_oo || null,
        },
        software_ids: softwareId ? [softwareId] : [],
        contacts: cleanContacts,
        commission_plans: plans.map((p) => ({
          plan_start_date: p.plan_start_date || null,
          currency: p.currency || null,
          description: p.description || null,
          country_ids: Array.isArray(p.country_ids) ? p.country_ids : [],
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
          overoption_retention: p.overoption_retention === "" ? null : p.overoption_retention,
          fallback_cpa: p.fallback_cpa === "" ? null : p.fallback_cpa,
          cpa_at_80: p.cpa_at_80 === "" ? null : p.cpa_at_80,
          cpa_at_90: p.cpa_at_90 === "" ? null : p.cpa_at_90,
          proportional_enabled: !!p.proportional_enabled,
          proportional_min_pct: p.proportional_min_pct === "" ? null : p.proportional_min_pct,
          fixed_margin_pct: p.fixed_margin_pct === "" ? null : p.fixed_margin_pct,
          recommended_margin_pct: p.recommended_margin_pct === "" ? null : p.recommended_margin_pct,
          fixed_remuneration: p.fixed_remuneration === "" ? null : p.fixed_remuneration,
          fixed_remuneration_currency: p.fixed_remuneration_currency || null,
          fixed_remuneration_min_ftd: p.fixed_remuneration_min_ftd === "" ? null : p.fixed_remuneration_min_ftd,
          fixed_remuneration_fallback_cpa: p.fixed_remuneration_fallback_cpa === "" ? null : p.fixed_remuneration_fallback_cpa,
          fixed_remuneration_fallback_cpa_currency: p.fixed_remuneration_fallback_cpa_currency || null,
          fixed_remuneration_installments: Array.isArray(p.fixed_remuneration_installments)
            ? p.fixed_remuneration_installments
                .map((it) => ({
                  pct: it.pct === "" ? 0 : Number(it.pct),
                  date: it.date || null,
                  description: (it.description || "").trim() || null,
                }))
                .filter((it) => it.pct > 0 || it.date || it.description)
            : [],
        })),
      },
    });
    setSaving(false);
    const errMsg = (data as any)?.error || (error as any)?.context?.body?.error || error?.message;
    if (errMsg) { toast.error(errMsg); return; }
    toast.success("Guardado");
    setOpen(false);
    window.location.reload();
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar cliente?")) return;
    const { data, error } = await supabase.functions.invoke("clients-manage", {
      body: { action: "delete", id },
    });
    const errMsg = (data as any)?.error || (error as any)?.context?.body?.error || error?.message;
    if (errMsg) { toast.error(errMsg); return; }
    toast.success("Eliminado");
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold">Operadores</h1>
          <p className="text-muted-foreground text-sm">Gestión de clientes de Overoption</p>
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
            <DialogTrigger asChild>
              <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Nuevo cliente</Button>
            </DialogTrigger>
            <DialogContent
              className="max-w-2xl max-h-[90vh] overflow-y-auto"
              onPointerDownOutside={(e) => e.preventDefault()}
              onInteractOutside={(e) => e.preventDefault()}
            >
              <DialogHeader><DialogTitle>{editing ? "Editar Operador" : "Nuevo Operador"}</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1">
                  <Label>Empresa *</Label>
                  <div className="flex gap-1">
                    <Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} disabled={!!editing && !nameUnlocked} />
                    {editing && isSuperAdmin && (
                      <Button type="button" variant="outline" size="icon" title={nameUnlocked ? "Bloquear edición" : "Editar nombre (super admin)"} onClick={() => setNameUnlocked((v) => !v)}>
                        {nameUnlocked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                      </Button>
                    )}
                  </div></div>
                <div className="space-y-1"><Label>Sitio web</Label>
                  <Input value={form.website ?? ""} onChange={(e) => setForm({ ...form, website: e.target.value })} /></div>
                <div className="space-y-1"><Label>Login</Label>
                  <Input value={form.login ?? ""} onChange={(e) => setForm({ ...form, login: e.target.value })} /></div>
                <div className="space-y-1"><Label>Seña</Label>
                  <Input type="text" value={form.senha ?? ""} onChange={(e) => setForm({ ...form, senha: e.target.value })} /></div>
                <div className="col-span-2 space-y-1"><Label>EXT_ID_OO</Label>
                  <Input value={form.ext_id_oo ?? ""} onChange={(e) => setForm({ ...form, ext_id_oo: e.target.value })} placeholder="ID externo en otras plataformas de Over Option" /></div>
                <div className="col-span-2 space-y-1">
                  <Label>Logo del operador (PNG, JPG, SVG, WEBP)</Label>
                  <div className="flex items-center gap-3">
                    {form.logo_url ? (
                      <img src={form.logo_url} alt="Logo" className="h-12 w-24 object-contain rounded border bg-white p-1" />
                    ) : (
                      <div className="h-12 w-24 rounded border border-dashed flex items-center justify-center text-[10px] text-muted-foreground">Sin logo</div>
                    )}
                    <Input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const ext = file.name.split(".").pop()?.toLowerCase() || "png";
                        const path = `${(form.company_name || "operator").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now()}.${ext}`;
                        const { error: upErr } = await supabase.storage.from("operator-logos").upload(path, file, { upsert: true, contentType: file.type });
                        if (upErr) { toast.error(upErr.message); return; }
                        const { data: pub } = supabase.storage.from("operator-logos").getPublicUrl(path);
                        setForm((f: any) => ({ ...f, logo_url: pub.publicUrl }));
                        toast.success("Logo subido");
                      }}
                    />
                    {form.logo_url && (
                      <Button type="button" variant="outline" size="sm" onClick={() => setForm((f: any) => ({ ...f, logo_url: "" }))}>Quitar</Button>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">Se usará en formato rectangular en el header/hero de las landing pages.</p>
                </div>
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
                      onWheel={(e) => {
                        e.currentTarget.scrollTop += e.deltaY;
                        e.stopPropagation();
                      }}
                      onTouchMove={(e) => e.stopPropagation()}
                    >
                      <div className="space-y-1">
                        {countries.length > 0 && (() => {
                          const allChecked = (form.country_ids ?? []).length === countries.length;
                          return (
                            <label className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer border-b mb-1 font-medium">
                              <Checkbox
                                checked={allChecked}
                                onCheckedChange={(v) => {
                                  setForm({
                                    ...form,
                                    country_ids: v ? countries.map((c) => c.id) : [],
                                  });
                                }}
                              />
                              <span className="text-sm">Todos</span>
                            </label>
                          );
                        })()}
                        {[...countries].sort((a, b) => a.name.localeCompare(b.name)).map((c) => {
                          const checked = (form.country_ids ?? []).includes(c.id);
                          return (
                            <label key={c.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer">
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(v) => {
                                  const cur: string[] = form.country_ids ?? [];
                                  setForm({
                                    ...form,
                                    country_ids: v ? [...cur, c.id] : cur.filter((id) => id !== c.id),
                                  });
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
                  <Label>Estado</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Tipo de cliente</Label>
                  <Select value={form.client_type ?? ""} onValueChange={(v) => setForm({ ...form, client_type: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                    <SelectContent>
                      {CLIENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Routy Account ID</Label>
                  <Input
                    value={form.routy_account_id ?? ""}
                    onChange={(e) => setForm({ ...form, routy_account_id: e.target.value })}
                    placeholder="Ej: 12345"
                  />
                </div>


                <div className="col-span-2 space-y-2 border rounded-md p-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base">Contactos</Label>
                    <Button type="button" size="sm" variant="outline" onClick={addContact}>
                      <Plus className="h-4 w-4 mr-1" /> Agregar contacto
                    </Button>
                  </div>
                  {contacts.length === 0 && (
                    <p className="text-sm text-muted-foreground">Sin contactos. Agrega el primero.</p>
                  )}
                  {contacts.map((ct, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-3 space-y-1">
                        <Label className="text-xs">Nombre</Label>
                        <Input value={ct.name} onChange={(e) => updateContact(i, { name: e.target.value })} />
                      </div>
                      <div className="col-span-2 space-y-1">
                        <Label className="text-xs">Canal</Label>
                        <Select value={ct.channel} onValueChange={(v) => updateContact(i, { channel: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {CHANNELS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-3 space-y-1">
                        <Label className="text-xs">ID de contacto</Label>
                        <Input value={ct.contact_id} onChange={(e) => updateContact(i, { contact_id: e.target.value })} />
                      </div>
                      <div className="col-span-3 space-y-1">
                        <Label className="text-xs">Cargo</Label>
                        <Select value={ct.role || undefined} onValueChange={(v) => updateContact(i, { role: v })}>
                          <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                          <SelectContent>
                            {CONTACT_ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-1">
                        <Button type="button" size="icon" variant="ghost" onClick={() => removeContact(i)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="col-span-2 space-y-2 border rounded-md p-3">
                  <Label className="text-base">Marcas</Label>
                  <p className="text-xs text-muted-foreground">Agrega las marcas del cliente (cuando tiene más de una).</p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Nombre de la marca"
                      value={brandInput}
                      onChange={(e) => setBrandInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const v = brandInput.trim();
                          if (v && !(form.brands ?? []).includes(v)) {
                            setForm({ ...form, brands: [...(form.brands ?? []), v] });
                          }
                          setBrandInput("");
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        const v = brandInput.trim();
                        if (v && !(form.brands ?? []).includes(v)) {
                          setForm({ ...form, brands: [...(form.brands ?? []), v] });
                        }
                        setBrandInput("");
                      }}
                    >
                      <Plus className="h-4 w-4 mr-1" /> Agregar
                    </Button>
                  </div>
                  {(form.brands ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sin marcas agregadas.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {(form.brands ?? []).map((b: string, i: number) => (
                        <Badge key={`${b}-${i}`} variant="secondary" className="flex items-center gap-1">
                          {b}
                          <button
                            type="button"
                            onClick={() => setForm({ ...form, brands: form.brands.filter((_: string, idx: number) => idx !== i) })}
                            className="hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div data-commission-plans-section className="col-span-2 space-y-2 border rounded-md p-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base">Commission Plans</Label>
                    <Button type="button" size="sm" variant="outline" onClick={addPlan}>
                      <Plus className="h-4 w-4 mr-1" /> Agregar plan
                    </Button>
                  </div>
                  {plans.length === 0 && (
                    <p className="text-sm text-muted-foreground">Sin planes de comisión.</p>
                  )}
                  {plans.map((pl, i) => (
                    <Collapsible key={i} defaultOpen={false} className="border rounded-md bg-muted/30">
                      <div className="flex items-center justify-between gap-2 p-3">
                        <CollapsibleTrigger asChild>
                          <button type="button" className="flex items-center gap-2 flex-1 text-left min-w-0">
                            <ChevronDown className="h-4 w-4 shrink-0 transition-transform [[data-state=closed]>&]:-rotate-90" />
                            <span className="text-xs font-medium text-muted-foreground shrink-0">Plan #{i + 1}</span>
                            <span className="text-sm font-medium truncate">{pl.description || "Sin nombre"}</span>
                            <div className="flex gap-2 ml-2 shrink-0">
                              {pl.fixed_remuneration && Number(pl.fixed_remuneration) > 0 ? (
                                <>
                                  <Badge variant="secondary" className="font-normal">Fijo: {pl.fixed_remuneration}{pl.fixed_remuneration_currency ? ` ${pl.fixed_remuneration_currency}` : ""}</Badge>
                                  <Badge variant="secondary" className="font-normal">Objetivo CPAs: {pl.fixed_remuneration_min_ftd || "—"}</Badge>
                                </>
                              ) : (
                                <>
                                  <Badge variant="secondary" className="font-normal">CPA: {pl.cpa || "—"}</Badge>
                                  <Badge variant="secondary" className="font-normal">Rev Share: {pl.rev_share_pct ? `${pl.rev_share_pct}%` : "—"}</Badge>
                                </>
                              )}
                            </div>
                          </button>
                        </CollapsibleTrigger>
                        <Button type="button" size="icon" variant="ghost" onClick={() => removePlan(i)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <CollapsibleContent className="px-3 pb-3 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="col-span-2 space-y-1">
                          <Label className="text-xs">Nombre</Label>
                          <Input value={pl.description}
                            onChange={(e) => updatePlan(i, { description: e.target.value })}
                            placeholder="Ej: Comisiones LATAM" />
                        </div>
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
                              {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">GEO's (países)</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button type="button" variant="outline" className="w-full justify-between font-normal">
                                <span className="truncate">
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
                              className="w-[260px] p-2 max-h-72 overflow-y-auto overscroll-contain"
                              align="start"
                              onWheel={(e) => {
                                e.currentTarget.scrollTop += e.deltaY;
                                e.stopPropagation();
                              }}
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
                                          updatePlan(i, {
                                            country_ids: v ? [...cur, c.id] : cur.filter((id) => id !== c.id),
                                          });
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
                          <Label className="text-xs">Wager</Label>
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
                        <div data-overoption-section className="col-span-2 mt-2 rounded-md border border-blue-200 bg-blue-50 dark:border-blue-900/50 dark:bg-blue-950/30 p-3">
                          <p className="text-sm font-semibold text-center mb-3">Configuración margen Overoption</p>
                          <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Retención Overoption (valor por CPA)</Label>
                            <Input type="number" step="0.01" value={pl.overoption_retention}
                              onChange={(e) => updatePlan(i, { overoption_retention: e.target.value })}
                              placeholder="Valor absoluto retenido por cada CPA" />
                            {(() => {
                              const cpa = parseFloat(pl.cpa);
                              const ret = parseFloat(pl.overoption_retention);
                              if (Number.isFinite(cpa) && cpa > 0 && Number.isFinite(ret)) {
                                const pct = (ret / cpa) * 100;
                                const neto = Math.max(0, cpa - ret);
                                return (
                                  <p className="text-xs text-muted-foreground">
                                    Equivale a <span className="font-semibold text-foreground">{pct.toFixed(2)}%</span> del CPA bruto · CPA neto al afiliado: <span className="font-semibold text-foreground">{neto.toFixed(2)}</span>
                                  </p>
                                );
                              }
                              return <p className="text-xs text-muted-foreground">Define CPA y retención para ver el % equivalente.</p>;
                            })()}
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">CPA fallback (bajo objetivo)</Label>
                            <Input type="number" step="0.01" value={pl.fallback_cpa}
                              onChange={(e) => updatePlan(i, { fallback_cpa: e.target.value })}
                              placeholder="CPA pagado si no alcanza el objetivo" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">CPA al 80% del objetivo</Label>
                            <Input type="number" step="0.01" value={pl.cpa_at_80}
                              onChange={(e) => updatePlan(i, { cpa_at_80: e.target.value })}
                              placeholder="Valor CPA si cumple ≥80%" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">CPA al 90% del objetivo</Label>
                            <Input type="number" step="0.01" value={pl.cpa_at_90}
                              onChange={(e) => updatePlan(i, { cpa_at_90: e.target.value })}
                              placeholder="Valor CPA si cumple ≥90%" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Margen fijo Overoption (%)</Label>
                            <Input type="number" step="0.01" min="0" max="100" value={pl.fixed_margin_pct}
                              onChange={(e) => updatePlan(i, { fixed_margin_pct: e.target.value })}
                              placeholder="Ej. 10 (= 10% retenido)" />
                            <p className="text-xs text-muted-foreground">Se descuenta del valor fijo ofrecido al afiliado en la calculadora (Fijo máximo).</p>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Margen recomendado (%)</Label>
                            <Input type="number" step="0.01" min="0" max="100" value={pl.recommended_margin_pct}
                              onChange={(e) => updatePlan(i, { recommended_margin_pct: e.target.value })}
                              placeholder="Ej. 20 (= 20% retenido)" />
                            <p className="text-xs text-muted-foreground">Define el "Fijo recomendado" (más bajo que el Fijo máximo) para dar al comercial un rango de oferta.</p>
                          </div>
                          <div className="col-span-2 border-t pt-3 mt-1 space-y-3">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <Label className="text-xs">Pago proporcional al % de entrega</Label>
                                <p className="text-xs text-muted-foreground">Si está activo, paga el % de CPA igual al % del objetivo alcanzado (ignora CPA fallback).</p>
                              </div>
                              <Switch checked={pl.proportional_enabled}
                                onCheckedChange={(v) => updatePlan(i, { proportional_enabled: v })} />
                            </div>
                            {pl.proportional_enabled && (
                              <div className="space-y-1 max-w-xs">
                                <Label className="text-xs">% mínimo a pagar del CPA</Label>
                                <Input type="number" step="0.01" min="0" max="100" value={pl.proportional_min_pct}
                                  onChange={(e) => updatePlan(i, { proportional_min_pct: e.target.value })}
                                  placeholder="Ej. 50 (= 50% del CPA)" />
                                <p className="text-xs text-muted-foreground">Piso garantizado: aunque el afiliado entregue menos, cada FTD se paga al menos a este % del CPA definido.</p>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="col-span-2 mt-2 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30 p-3 space-y-3">
                          <div>
                            <p className="text-sm font-semibold">Comisión fija por volumen de CPAs</p>
                            <p className="text-[11px] text-muted-foreground">Pago fijo si el afiliado alcanza un volumen mínimo de CPAs/mes. La diferencia con la comisión fija del afiliado para este operador es el margen de OO.</p>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Monto fijo y moneda</Label>
                              <div className="flex gap-2">
                                <Input type="number" step="0.01" min="0" placeholder="0.00"
                                  value={pl.fixed_remuneration}
                                  onChange={(e) => updatePlan(i, { fixed_remuneration: e.target.value })} />
                                <Select value={pl.fixed_remuneration_currency || "__none__"}
                                  onValueChange={(v) => updatePlan(i, { fixed_remuneration_currency: v === "__none__" ? "" : v })}>
                                  <SelectTrigger className="w-28"><SelectValue placeholder="Moneda" /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__">—</SelectItem>
                                    {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Volumen mínimo de CPAs/mes</Label>
                              <Input type="number" min="0" step="1" placeholder="Ej. 50"
                                value={pl.fixed_remuneration_min_ftd}
                                onChange={(e) => updatePlan(i, { fixed_remuneration_min_ftd: e.target.value })} />
                            </div>
                            <div className="space-y-1 md:col-span-2">
                              <Label className="text-xs">CPA fallback (si no alcanza el volumen)</Label>
                              <div className="flex gap-2">
                                <Input type="number" min="0" step="0.01" placeholder="0.00"
                                  value={pl.fixed_remuneration_fallback_cpa}
                                  onChange={(e) => updatePlan(i, { fixed_remuneration_fallback_cpa: e.target.value })} />
                                <Select value={pl.fixed_remuneration_fallback_cpa_currency || "__none__"}
                                  onValueChange={(v) => updatePlan(i, { fixed_remuneration_fallback_cpa_currency: v === "__none__" ? "" : v })}>
                                  <SelectTrigger className="w-28"><SelectValue placeholder="Moneda" /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__">—</SelectItem>
                                    {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </div>
                          {(() => {
                            const installments = pl.fixed_remuneration_installments ?? [];
                            const totalPct = installments.reduce((s, x) => s + (Number(x.pct) || 0), 0);
                            const update = (next: typeof installments) => updatePlan(i, { fixed_remuneration_installments: next });
                            return (
                              <div className="rounded-md border border-border bg-background p-3 space-y-2">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                  <div>
                                    <Label className="text-xs font-semibold">Forma de pago del operador — Cuotas</Label>
                                    <p className="text-[11px] text-muted-foreground">Define cómo el operador/cliente nos paga esta comisión fija: una o más cuotas con porcentaje, fecha y regla opcional.</p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge variant={totalPct === 100 ? "default" : totalPct > 100 ? "destructive" : "outline"} className="text-[10px]">
                                      Total: {totalPct}%
                                    </Badge>
                                    <Button type="button" variant="outline" size="sm" className="h-8"
                                      onClick={() => update([...installments, { pct: "", date: "", description: "" }])}>
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
                                            <Input type="number" min="0" max="100" step="0.01" placeholder="50"
                                              value={it.pct}
                                              onChange={(e) => {
                                                const next = [...installments];
                                                next[idx] = { ...next[idx], pct: e.target.value };
                                                update(next);
                                              }}
                                              className="pr-7" />
                                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                                          </div>
                                        </div>
                                        <div className="col-span-8 md:col-span-3 space-y-1">
                                          <Label className="text-[10px] text-muted-foreground">Fecha de pago</Label>
                                          <Input type="date" value={it.date}
                                            onChange={(e) => {
                                              const next = [...installments];
                                              next[idx] = { ...next[idx], date: e.target.value };
                                              update(next);
                                            }} />
                                        </div>
                                        <div className="col-span-11 md:col-span-5 space-y-1">
                                          <Label className="text-[10px] text-muted-foreground">Descripción / regla</Label>
                                          <Input placeholder="Ej. Al firmar el contrato" value={it.description}
                                            onChange={(e) => {
                                              const next = [...installments];
                                              next[idx] = { ...next[idx], description: e.target.value };
                                              update(next);
                                            }} />
                                        </div>
                                        <div className="col-span-1 flex justify-end">
                                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                                            onClick={() => update(installments.filter((_, j) => j !== idx))}>
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
                        </div>
                      </div>
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                </div>

                <div className="col-span-2 space-y-1">
                  <Label>Software utilizado</Label>
                  <Select value={softwareId ?? ""} onValueChange={(v) => setSoftwareId(v || null)}>
                    <SelectTrigger><SelectValue placeholder="Selecciona un software" /></SelectTrigger>
                    <SelectContent>
                      {softwares.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {editing?.id && (
                  <div className="col-span-2">
                    <ClientContractsUploader clientId={editing.id} canEdit={isAdmin} />
                  </div>
                )}
                {!editing?.id && (
                  <div className="col-span-2 text-xs text-muted-foreground rounded-md border border-dashed p-3">
                    Guarda el operador para poder adjuntar contratos o insertion orders.
                  </div>
                )}
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

      <div className="flex flex-wrap items-center gap-2">
        <div className="max-w-sm flex-1 min-w-[200px]">
          <Input
            placeholder="Buscar por nombre, marca o país..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {noRsFilter && (
          <Badge variant="secondary" className="gap-2">
            Filtro: operadores sin acuerdo de RS
            <button
              type="button"
              className="ml-1 text-muted-foreground hover:text-foreground"
              onClick={() => { searchParams.delete("filter"); setSearchParams(searchParams); }}
            >
              ✕
            </button>
          </Badge>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="[&>div]:max-h-[calc(100vh-260px)]">
          <Table className="w-full table-fixed">
            <TableHeader className="sticky top-0 z-10 bg-background shadow-[0_1px_0_0_hsl(var(--border))]"><TableRow>
              <TableHead className="w-[18%]">Empresa</TableHead>
              <TableHead className="w-[15%]">País</TableHead>
              <TableHead className="w-[15%]">Marcas</TableHead>
              <TableHead className="w-[8%]">Estado</TableHead>
              <TableHead className="w-[37%]">Contactos</TableHead>
              {isAdmin && <TableHead className="w-[7%]"></TableHead>}
            </TableRow></TableHeader>
            <TableBody>
              {filteredList.map((r) => (
                <TableRow key={r.id} className="align-top">
                  <TableCell className="font-medium align-top">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <button
                          type="button"
                          className="text-left hover:underline text-primary truncate"
                          onClick={() => setViewing(r)}
                        >
                          {r.company_name}
                        </button>
                        <div className="flex items-center gap-3 shrink-0 ml-auto pl-2">
                          <div className="w-5 flex items-center justify-center">
                            {r.website && (
                              <a
                                href={/^https?:\/\//i.test(r.website) ? r.website : `https://${r.website}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-muted-foreground hover:text-primary"
                                title="Abrir sitio web"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            )}
                          </div>
                          <div className="w-5 flex items-center justify-center">
                            {r.routy_account_id && (
                              <span
                                title={`Routy Account ID: ${r.routy_account_id}`}
                                className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-blue-500/15 text-blue-600"
                              >
                                <Link2 className="h-3 w-3" />
                              </span>
                            )}
                          </div>
                        </div>
                      </div>


                      <div className="flex items-center gap-1.5 shrink-0">
                        {(() => {
                          const plans = Array.isArray(r.client_commission_plans) ? r.client_commission_plans : [];
                          const hasPlans = plans.length > 0;
                          const colorCls = hasPlans ? "bg-emerald-500/15 text-emerald-600" : "bg-red-500/15 text-red-600";
                          const openPlans = () => {
                            if (!isAdmin) return;
                            openEdit(r);
                            setTimeout(() => {
                              const el = document.querySelector('[data-commission-plans-section]') as HTMLElement | null;
                              el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }, 250);
                          };
                          return (
                            <HoverCard openDelay={100}>
                              <HoverCardTrigger asChild>
                                <button
                                  type="button"
                                  onClick={openPlans}
                                  className={`inline-flex items-center justify-center h-5 w-5 rounded-full cursor-pointer hover:opacity-80 ${colorCls}`}
                                  title={hasPlans ? "Planes de comisión" : "Sin planes de comisión"}
                                >
                                  <DollarSign className="h-3 w-3" />
                                </button>
                              </HoverCardTrigger>
                              <HoverCardContent className="w-72 p-2" align="start">
                                <p className="text-xs font-semibold mb-1.5">Planes de comisión</p>
                                {hasPlans ? (
                                  <ul className="divide-y divide-border rounded-md overflow-hidden border">
                                    {plans.map((p: any, idx: number) => {
                                      const label = p.description?.trim() || [p.brand, p.country?.name].filter(Boolean).join(" · ") || "Sin nombre";
                                      return (
                                        <li key={p.id} className={`text-xs flex gap-2 px-2 py-1.5 ${idx % 2 === 0 ? "bg-muted/40" : "bg-background"}`}>
                                          <span className="font-medium truncate">{label}</span>
                                        </li>
                                      );
                                    })}
                                  </ul>
                                ) : (
                                  <p className="text-xs text-muted-foreground">Sin planes de comisión configurados</p>
                                )}
                              </HoverCardContent>
                            </HoverCard>
                          );
                        })()}
                        {(() => {
                          const plans = Array.isArray(r.client_commission_plans) ? r.client_commission_plans : [];
                          const isConfigured = (p: any) => {
                            const v = p?.overoption_retention;
                            if (v === null || v === undefined || v === "") return false;
                            const n = Number(v);
                            return Number.isFinite(n) && n > 0;
                          };
                          const configured = plans.filter(isConfigured).length;
                          const total = plans.length;
                          let colorCls = "bg-red-500/15 text-red-600";
                          let msg = "Margen Overoption no configurada";
                          if (total > 0) {
                            if (configured === total) {
                              colorCls = "bg-blue-500/15 text-blue-600";
                              msg = "Margen Overoption configurada";
                            } else if (configured > 0) {
                              colorCls = "bg-orange-500/15 text-orange-600";
                              msg = `Margen Overoption parcialmente configurada (${configured}/${total} planes)`;
                            } else {
                              colorCls = "bg-red-500/15 text-red-600";
                              msg = "Margen Overoption no configurada";
                            }
                          }
                          return (
                            <HoverCard openDelay={100}>
                              <HoverCardTrigger asChild>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!isAdmin) return;
                                    openEdit(r);
                                    setTimeout(() => {
                                      const el = document.querySelector('[data-overoption-section]') as HTMLElement | null;
                                      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    }, 250);
                                  }}
                                  className={`inline-flex items-center justify-center h-5 w-5 rounded-full cursor-pointer hover:opacity-80 ${colorCls}`}
                                  title={msg}
                                >
                                  <ShieldCheck className="h-3 w-3" />
                                </button>
                              </HoverCardTrigger>
                              <HoverCardContent className="w-auto p-2" align="start">
                                <p className="text-xs font-medium">{msg}</p>
                              </HoverCardContent>
                            </HoverCard>
                          );
                        })()}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs align-top">{countryNames(r) || "—"}</TableCell>
                  <TableCell className="text-xs align-top">{Array.isArray(r.brands) && r.brands.length ? r.brands.join(", ") : "—"}</TableCell>
                  <TableCell className="align-top"><Badge variant={r.status === "active" ? "default" : "secondary"}>{r.status}</Badge></TableCell>
                  <TableCell className="text-xs align-top">
                    {(r.client_contacts ?? []).map((c: any, idx: number) => (
                      <div key={idx}>{c.name} · {c.channel}: {c.contact_id}</div>
                    ))}
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="space-x-1 align-top whitespace-nowrap text-right">
                      <Button size="icon" variant="ghost" title="Ver análisis" asChild>
                        <Link to={`/clientes/${r.id}/analisis`}><BarChart3 className="h-4 w-4" /></Link>
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                      {isSuperAdmin && <Button size="icon" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></Button>}
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {filteredList.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">{search ? "Sin resultados" : "Sin clientes registrados"}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewing?.company_name}</DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-muted-foreground">Sitio web: </span>
                  {viewing.website ? (
                    <a
                      href={viewing.website.startsWith("http") ? viewing.website : `https://${viewing.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline break-all"
                    >
                      {viewing.website}
                    </a>
                  ) : "—"}
                </div>
                <div><span className="text-muted-foreground">GEO's: </span>{countryNames(viewing) || "—"}</div>
                <div>
                  <span className="text-muted-foreground">Login: </span>
                  {viewing.login ? (
                    <button
                      type="button"
                      onClick={() => { navigator.clipboard.writeText(viewing.login); toast.success("Login copiado"); }}
                      className="text-primary hover:underline"
                      title="Clic para copiar"
                    >
                      {viewing.login}
                    </button>
                  ) : "—"}
                </div>
                <div>
                  <span className="text-muted-foreground">Seña: </span>
                  {viewing.senha ? (
                    <button
                      type="button"
                      onClick={() => { navigator.clipboard.writeText(viewing.senha); toast.success("Seña copiada"); }}
                      className="text-primary hover:underline"
                      title="Clic para copiar"
                    >
                      {viewing.senha}
                    </button>
                  ) : "—"}
                </div>
                <div><span className="text-muted-foreground">Estado: </span><Badge variant={viewing.status === "active" ? "default" : "secondary"}>{viewing.status}</Badge></div>
                <div><span className="text-muted-foreground">Tipo: </span>{viewing.client_type || "—"}</div>
                <div><span className="text-muted-foreground">Software: </span>{viewing.client_software_links?.map((l: any) => l.software?.name).join(", ") || "—"}</div>
              </div>
              <div>
                <div className="text-muted-foreground mb-1">Marcas:</div>
                {(viewing.brands ?? []).length === 0 ? (
                  <div className="text-muted-foreground">—</div>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {viewing.brands.map((b: string, i: number) => (
                      <Badge key={i} variant="secondary">{b}</Badge>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <div className="text-muted-foreground mb-1">Contactos:</div>
                {(viewing.client_contacts ?? []).length === 0 && <div className="text-muted-foreground">—</div>}
                {(viewing.client_contacts ?? []).map((c: any, i: number) => (
                  <div key={i} className="border rounded px-2 py-1 mb-1">
                    <strong>{c.name}</strong> · {c.channel}: {c.contact_id}
                  </div>
                ))}
              </div>
              <div>
                <div className="text-muted-foreground mb-1">Comisiones:</div>
                {(viewing.client_commission_plans ?? []).length === 0 && <div className="text-muted-foreground">—</div>}
                {(viewing.client_commission_plans ?? []).map((p: any, i: number) => (
                  <div key={i} className="border rounded px-2 py-1 mb-1 text-xs space-y-0.5">
                    <div className="font-medium">
                      {p.brand || "—"} · {(Array.isArray(p.country_ids) && p.country_ids.length > 0 ? countries.filter((c) => p.country_ids.includes(c.id)).map((c) => c.name).join(", ") : (p.country?.name || "—"))} · {p.plan_start_date || "—"} {p.currency ? `(${p.currency})` : ""}
                    </div>
                    {p.description && <div className="text-muted-foreground">{p.description}</div>}
                    <div>
                      Baseline: {p.baseline ?? "—"} · CPA: {p.cpa ?? "—"} · Rev Share: {p.rev_share_pct ?? "—"}% · CPL: {p.cpl ?? "—"}
                    </div>
                    <div>Wager: {p.wager ?? "—"} · Condición: {p.conversion_type || "—"} · CAP: {p.cap ?? "—"}</div>
                  </div>
                ))}
              </div>
              {viewing.notes && (
                <div>
                  <div className="text-muted-foreground mb-1">Notas:</div>
                  <div className="whitespace-pre-wrap">{viewing.notes}</div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewing(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
