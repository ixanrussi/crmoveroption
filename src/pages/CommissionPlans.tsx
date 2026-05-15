import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useCurrencies } from "@/lib/currencies";

const CONVERSION_TYPES = ["NCO", "NNCO"] as const;

type Template = {
  id?: string;
  name: string;
  description: string;
  plan_start_date: string;
  currency: string;
  client_id: string;
  brand: string;
  country_ids: string[];
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

const empty: Template = {
  name: "", description: "", plan_start_date: "", currency: "",
  client_id: "", brand: "", country_ids: [],
  baseline: "", baseline_currency: "",
  cpa: "", cpa_currency: "",
  rev_share_pct: "",
  cpl: "", cpl_currency: "",
  wager: "", wager_currency: "",
  conversion_type: "", cap: "",
};

export default function CommissionPlans() {
  const { isAdmin, isSuperAdmin } = useAuth();
  const CURRENCIES = useCurrencies();
  const [list, setList] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [countries, setCountries] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<Template>(empty);
  const [saving, setSaving] = useState(false);

  const compareToCpa = (val: any, cpa: any) => {
    const v = Number(val);
    const c = Number(cpa);
    if (!Number.isFinite(v) || !Number.isFinite(c)) return "";
    if (v < c) return "text-green-600";
    if (v === c) return "text-orange-500";
    return "text-red-600";
  };

  const load = async () => {
    const { data } = await supabase
      .from("commission_plan_templates")
      .select("*, client:clients(company_name)")
      .order("name", { ascending: true });
    setList(data ?? []);
  };
  const loadLookups = async () => {
    const [cl, co] = await Promise.all([
      supabase.from("clients").select("id, company_name, brands, login, client_type").order("company_name"),
      supabase.from("countries").select("*").order("name"),
    ]);
    setClients(cl.data ?? []);
    setCountries(co.data ?? []);
  };
  useEffect(() => { load(); loadLookups(); }, []);

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (row: any) => {
    setEditing(row);
    setForm({
      name: row.name ?? "",
      description: row.description ?? "",
      plan_start_date: row.plan_start_date ?? "",
      currency: row.currency ?? "",
      client_id: row.client_id ?? "",
      brand: row.brand ?? "",
      country_ids: Array.isArray(row.country_ids) ? row.country_ids : [],
      baseline: row.baseline?.toString() ?? "",
      baseline_currency: row.baseline_currency ?? "",
      cpa: row.cpa?.toString() ?? "",
      cpa_currency: row.cpa_currency ?? "",
      rev_share_pct: row.rev_share_pct?.toString() ?? "",
      cpl: row.cpl?.toString() ?? "",
      cpl_currency: row.cpl_currency ?? "",
      wager: row.wager?.toString() ?? "",
      wager_currency: row.wager_currency ?? "",
      conversion_type: row.conversion_type ?? "",
      cap: row.cap?.toString() ?? "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error("El nombre es requerido"); return; }
    const num = (v: string) => (v === "" || v == null ? null : Number(v));
    const payload: any = {
      name: form.name.trim(),
      description: form.description || null,
      plan_start_date: form.plan_start_date || null,
      currency: form.currency || null,
      client_id: form.client_id || null,
      brand: form.brand || null,
      country_ids: form.country_ids ?? [],
      baseline: num(form.baseline),
      baseline_currency: form.baseline_currency || null,
      cpa: num(form.cpa),
      cpa_currency: form.cpa_currency || null,
      rev_share_pct: num(form.rev_share_pct),
      cpl: num(form.cpl),
      cpl_currency: form.cpl_currency || null,
      wager: num(form.wager),
      wager_currency: form.wager_currency || null,
      conversion_type: form.conversion_type || null,
      cap: form.cap === "" ? null : Math.trunc(Number(form.cap)),
    };
    setSaving(true);
    const res = editing
      ? await supabase.from("commission_plan_templates").update(payload).eq("id", editing.id)
      : await supabase.from("commission_plan_templates").insert(payload);
    setSaving(false);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success("Guardado");
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar plan?")) return;
    const { error } = await supabase.from("commission_plan_templates").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Eliminado");
    load();
  };

  const filtered = [...list]
    .sort((a, b) => (a.client?.company_name || "").localeCompare(b.client?.company_name || "", "es"))
    .filter((r) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        r.name?.toLowerCase().includes(q) ||
        r.client?.company_name?.toLowerCase().includes(q) ||
        r.brand?.toLowerCase().includes(q)
      );
    });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold">Planes Comisión Afiliado</h1>
          <p className="text-muted-foreground text-sm">Catálogo reutilizable de planes para asignar a afiliados.</p>
        </div>
        {isAdmin && (
          <Dialog
            open={open}
            onOpenChange={(v) => {
              if (!v && open && !confirm("¿Cerrar el formulario? Se perderán los cambios no guardados.")) return;
              setOpen(v);
            }}
          >
            <DialogTrigger asChild><Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Nuevo plan</Button></DialogTrigger>
            <DialogContent
              className="max-w-2xl max-h-[90vh] overflow-y-auto"
              onPointerDownOutside={(e) => e.preventDefault()}
              onInteractOutside={(e) => e.preventDefault()}
            >
              <DialogHeader>
                <DialogTitle>{editing ? "Editar plan" : "Nuevo plan"}</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1">
                  <Label>Nombre del plan *</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Descripción</Label>
                  <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Fecha de inicio del plan</Label>
                  <Input type="date" value={form.plan_start_date} onChange={(e) => setForm({ ...form, plan_start_date: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Moneda</Label>
                  <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
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
                          {(form.country_ids ?? []).length === 0
                            ? "Selecciona uno o más"
                            : countries.filter((c) => form.country_ids.includes(c.id)).map((c) => c.name).join(", ")}
                        </span>
                        <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[280px] p-2 max-h-72 overflow-y-auto overscroll-contain"
                      align="start"
                      onWheel={(e) => e.stopPropagation()}
                      onTouchMove={(e) => e.stopPropagation()}
                    >
                      <div className="space-y-1">
                        {[...countries].sort((a, b) => a.name.localeCompare(b.name, "es")).map((c) => {
                          const checked = form.country_ids.includes(c.id);
                          return (
                            <label key={c.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer">
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(v) => setForm({
                                  ...form,
                                  country_ids: v ? [...form.country_ids, c.id] : form.country_ids.filter((id) => id !== c.id),
                                })}
                              />
                              <span className="text-sm">{c.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Operador</Label>
                  <Select
                    value={form.client_id || "__none__"}
                    onValueChange={(v) => setForm({ ...form, client_id: v === "__none__" ? "" : v, brand: "" })}
                  >
                    <SelectTrigger><SelectValue placeholder="Selecciona cliente" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Sin cliente —</SelectItem>
                      {clients.map((c) => {
                        const desc = Array.isArray(c.brands) && c.brands.length > 0 ? c.brands.join(", ") : null;
                        return (
                          <SelectItem key={c.id} value={c.id}>
                            <span className="font-medium">{c.company_name}</span>
                            {desc && <span className="ml-2 text-xs text-muted-foreground">— {desc}</span>}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Marca</Label>
                  {(() => {
                    const cli = clients.find((c) => c.id === form.client_id);
                    const brandList: string[] = Array.isArray(cli?.brands) ? cli!.brands : [];
                    if (form.client_id && brandList.length > 0) {
                      return (
                        <Select value={form.brand || "__none__"} onValueChange={(v) => setForm({ ...form, brand: v === "__none__" ? "" : v })}>
                          <SelectTrigger><SelectValue placeholder="Selecciona marca" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">— Sin marca —</SelectItem>
                            {brandList.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      );
                    }
                    return (
                      <Input value={form.brand} placeholder={form.client_id ? "Operador sin marcas" : "Nombre de la marca"}
                        onChange={(e) => setForm({ ...form, brand: e.target.value })} />
                    );
                  })()}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Línea base</Label>
                  <div className="flex gap-1">
                    <Input type="number" step="0.01" value={form.baseline} onChange={(e) => setForm({ ...form, baseline: e.target.value })} />
                    <Select value={form.baseline_currency || "__none__"} onValueChange={(v) => setForm({ ...form, baseline_currency: v === "__none__" ? "" : v })}>
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
                    <Input type="number" step="0.01" value={form.cpa} onChange={(e) => setForm({ ...form, cpa: e.target.value })} />
                    <Select value={form.cpa_currency || "__none__"} onValueChange={(v) => setForm({ ...form, cpa_currency: v === "__none__" ? "" : v })}>
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
                  <Input type="number" step="0.01" value={form.rev_share_pct} onChange={(e) => setForm({ ...form, rev_share_pct: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">CPL</Label>
                  <div className="flex gap-1">
                    <Input type="number" step="0.01" value={form.cpl} onChange={(e) => setForm({ ...form, cpl: e.target.value })} />
                    <Select value={form.cpl_currency || "__none__"} onValueChange={(v) => setForm({ ...form, cpl_currency: v === "__none__" ? "" : v })}>
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
                    <Input type="number" step="0.01" value={form.wager} onChange={(e) => setForm({ ...form, wager: e.target.value })} />
                    <Select value={form.wager_currency || "__none__"} onValueChange={(v) => setForm({ ...form, wager_currency: v === "__none__" ? "" : v })}>
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
                  <Select value={form.conversion_type} onValueChange={(v) => setForm({ ...form, conversion_type: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                    <SelectContent>
                      {CONVERSION_TYPES.map((w) => <SelectItem key={w} value={w}>{w}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">CAP (conversiones autorizadas)</Label>
                  <Input type="number" step="1" value={form.cap} onChange={(e) => setForm({ ...form, cap: e.target.value })} />
                </div>
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
          <div className="p-3 border-b">
            <Input placeholder="Buscar por nombre, operador o marca…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Operador</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Marca</TableHead>
                <TableHead className="text-right">CPA</TableHead>
                <TableHead className="text-right">BL</TableHead>
                <TableHead className="text-right">W</TableHead>
                <TableHead className="text-right">Rev Share</TableHead>
                {isAdmin && <TableHead className="w-24"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.client?.company_name || "—"}</TableCell>
                  <TableCell>
                    <button type="button" className="text-left hover:underline text-primary" onClick={() => openEdit(r)}>
                      {r.name}
                    </button>
                  </TableCell>
                  <TableCell>{r.brand || "—"}</TableCell>
                  <TableCell className="text-right">{r.cpa != null ? `${r.cpa}${r.cpa_currency ? ` ${r.cpa_currency}` : ""}` : "—"}</TableCell>
                  <TableCell className={`text-right font-medium ${compareToCpa(r.baseline, r.cpa)}`}>{r.baseline ?? "—"}</TableCell>
                  <TableCell className={`text-right font-medium ${compareToCpa(r.wager, r.cpa)}`}>{r.wager ?? "—"}</TableCell>
                  <TableCell className="text-right">{r.rev_share_pct != null ? `${r.rev_share_pct}%` : "—"}</TableCell>
                  {isAdmin && (
                    <TableCell className="space-x-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                      {isSuperAdmin && <Button size="icon" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></Button>}
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Sin planes registrados</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
