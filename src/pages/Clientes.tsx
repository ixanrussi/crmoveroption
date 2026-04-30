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
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";

const STATUSES = ["active", "inactive", "prospect"] as const;
const CLIENT_TYPES = ["Directo", "Agencia", "Network"] as const;
const CHANNELS = [
  { value: "telegram", label: "Telegram" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
  { value: "telefono", label: "Teléfono" },
] as const;

type Contact = { name: string; channel: string; contact_id: string };
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
  wager_type: string;
  cap: string;
};
const emptyPlan: CommissionPlan = {
  plan_start_date: "", currency: "", description: "", country_id: null, brand: "",
  baseline: "", cpa: "", rev_share_pct: "", cpl: "", wager_type: "", cap: "",
};
const WAGER_TYPES = ["NCO", "NNCO"] as const;

export default function Clientes() {
  const { isAdmin, isSuperAdmin } = useAuth();
  const [list, setList] = useState<any[]>([]);
  const [countries, setCountries] = useState<any[]>([]);
  const [softwares, setSoftwares] = useState<any[]>([]);
  const [affiliates, setAffiliates] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [softwareId, setSoftwareId] = useState<string | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [viewing, setViewing] = useState<any | null>(null);

  const empty = {
    company_name: "", website: "",
    address: "", country_id: null, status: "active", notes: "", login: "", senha: "",
    client_type: "", brands: [] as string[],
  };
  const [form, setForm] = useState<any>(empty);
  const [brandInput, setBrandInput] = useState("");

  const load = async () => {
    const { data } = await supabase
      .from("clients")
      .select("*, country:countries(name), affiliate:affiliates(unique_id, fixed_name), client_software_links(software_id, software:softwares(name)), client_contacts(id, name, channel, contact_id)")
      .order("created_at", { ascending: false });
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

  const openNew = () => {
    setEditing(null);
    setForm(empty);
    setSoftwareId(null);
    setContacts([]);
    setBrandInput("");
    setOpen(true);
  };
  const openEdit = (row: any) => {
    setEditing(row);
    setForm({
      ...row,
      client_type: row.client_type ?? "",
      brands: Array.isArray(row.brands) ? row.brands : [],
    });
    setSoftwareId(row.client_software_links?.[0]?.software_id ?? null);
    setContacts(
      (row.client_contacts ?? []).map((c: any) => ({
        name: c.name ?? "",
        channel: c.channel ?? "email",
        contact_id: c.contact_id ?? "",
      })),
    );
    setBrandInput("");
    setOpen(true);
  };

  const [saving, setSaving] = useState(false);

  const addContact = () => setContacts((p) => [...p, { name: "", channel: "email", contact_id: "" }]);
  const updateContact = (i: number, patch: Partial<Contact>) =>
    setContacts((p) => p.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const removeContact = (i: number) => setContacts((p) => p.filter((_, idx) => idx !== i));

  const save = async () => {
    if (!form.company_name?.trim()) { toast.error("Nombre de empresa requerido"); return; }
    const cleanContacts = contacts
      .map((c) => ({ name: c.name.trim(), channel: c.channel, contact_id: c.contact_id.trim() }))
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
          country_id: form.country_id,
          status: form.status,
          notes: form.notes,
          login: form.login,
          senha: form.senha,
          client_type: form.client_type || null,
          brands: Array.isArray(form.brands) ? form.brands : [],
        },
        software_ids: softwareId ? [softwareId] : [],
        contacts: cleanContacts,
      },
    });
    setSaving(false);
    const errMsg = (data as any)?.error || (error as any)?.context?.body?.error || error?.message;
    if (errMsg) { toast.error(errMsg); return; }
    toast.success("Guardado");
    setOpen(false);
    load();
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
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="text-muted-foreground text-sm">Gestión de clientes de Overoption</p>
        </div>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Nuevo cliente</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>{editing ? "Editar cliente" : "Nuevo cliente"}</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1">
                  <Label>Empresa *</Label>
                  <Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
                </div>
                <div className="space-y-1"><Label>Sitio web</Label>
                  <Input value={form.website ?? ""} onChange={(e) => setForm({ ...form, website: e.target.value })} /></div>
                <div className="space-y-1"><Label>Login</Label>
                  <Input value={form.login ?? ""} onChange={(e) => setForm({ ...form, login: e.target.value })} /></div>
                <div className="space-y-1"><Label>Seña</Label>
                  <Input type="text" value={form.senha ?? ""} onChange={(e) => setForm({ ...form, senha: e.target.value })} /></div>
                <div className="space-y-1">
                  <Label>País</Label>
                  <Select value={form.country_id ?? ""} onValueChange={(v) => setForm({ ...form, country_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                    <SelectContent>{countries.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
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
                      <div className="col-span-4 space-y-1">
                        <Label className="text-xs">Nombre</Label>
                        <Input value={ct.name} onChange={(e) => updateContact(i, { name: e.target.value })} />
                      </div>
                      <div className="col-span-3 space-y-1">
                        <Label className="text-xs">Canal</Label>
                        <Select value={ct.channel} onValueChange={(v) => updateContact(i, { channel: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {CHANNELS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-4 space-y-1">
                        <Label className="text-xs">ID de contacto</Label>
                        <Input value={ct.contact_id} onChange={(e) => updateContact(i, { contact_id: e.target.value })} />
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

                <div className="col-span-2 space-y-1">
                  <Label>Software utilizado</Label>
                  <Select value={softwareId ?? ""} onValueChange={(v) => setSoftwareId(v || null)}>
                    <SelectTrigger><SelectValue placeholder="Selecciona un software" /></SelectTrigger>
                    <SelectContent>
                      {softwares.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
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
              <TableHead>Empresa</TableHead><TableHead>Contactos</TableHead><TableHead>País</TableHead>
              <TableHead>Afiliado</TableHead><TableHead>Software</TableHead><TableHead>Estado</TableHead>
              {isAdmin && <TableHead className="w-24"></TableHead>}
            </TableRow></TableHeader>
            <TableBody>
              {list.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    <button
                      type="button"
                      className="text-left hover:underline text-primary"
                      onClick={() => setViewing(r)}
                    >
                      {r.company_name}
                    </button>
                  </TableCell>
                  <TableCell className="text-xs">
                    {(r.client_contacts ?? []).map((c: any, idx: number) => (
                      <div key={idx}>{c.name} · {c.channel}: {c.contact_id}</div>
                    ))}
                  </TableCell>
                  <TableCell>{r.country?.name}</TableCell>
                  <TableCell className="text-xs">{r.affiliate ? `${r.affiliate.unique_id}` : "—"}</TableCell>
                  <TableCell className="text-xs">{r.client_software_links?.map((l: any) => l.software?.name).join(", ")}</TableCell>
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
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Sin clientes registrados</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
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
                <div><span className="text-muted-foreground">País: </span>{viewing.country?.name || "—"}</div>
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
