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
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

const STATUSES = ["active", "inactive", "prospect"] as const;

export default function Clientes() {
  const { isAdmin, isSuperAdmin } = useAuth();
  const [list, setList] = useState<any[]>([]);
  const [countries, setCountries] = useState<any[]>([]);
  const [softwares, setSoftwares] = useState<any[]>([]);
  const [affiliates, setAffiliates] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [softwareIds, setSoftwareIds] = useState<string[]>([]);

  const empty = {
    company_name: "", contact_name: "", email: "", phone: "", website: "",
    address: "", country_id: null, affiliate_id: null, status: "active", notes: "",
  };
  const [form, setForm] = useState<any>(empty);

  const load = async () => {
    const { data } = await supabase
      .from("clients")
      .select("*, country:countries(name), affiliate:affiliates(unique_id, fixed_name), client_software_links(software_id, software:softwares(name))")
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
    setSoftwareIds([]);
    setOpen(true);
  };
  const openEdit = (row: any) => {
    setEditing(row);
    setForm({ ...row });
    setSoftwareIds(row.client_software_links?.map((l: any) => l.software_id) ?? []);
    setOpen(true);
  };

  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.company_name?.trim()) { toast.error("Nombre de empresa requerido"); return; }
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("clients-manage", {
      body: {
        action: editing ? "update" : "insert",
        id: editing?.id,
        client: {
          company_name: form.company_name,
          contact_name: form.contact_name,
          email: form.email,
          phone: form.phone,
          website: form.website,
          address: form.address,
          country_id: form.country_id,
          affiliate_id: form.affiliate_id,
          status: form.status,
          notes: form.notes,
        },
        software_ids: softwareIds,
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

  const toggleSw = (id: string) => {
    setSoftwareIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
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
                <div className="space-y-1"><Label>Contacto</Label>
                  <Input value={form.contact_name ?? ""} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} /></div>
                <div className="space-y-1"><Label>Email</Label>
                  <Input type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div className="space-y-1"><Label>Teléfono</Label>
                  <Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                <div className="space-y-1"><Label>Sitio web</Label>
                  <Input value={form.website ?? ""} onChange={(e) => setForm({ ...form, website: e.target.value })} /></div>
                <div className="col-span-2 space-y-1"><Label>Dirección</Label>
                  <Input value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
                <div className="space-y-1">
                  <Label>País</Label>
                  <Select value={form.country_id ?? ""} onValueChange={(v) => setForm({ ...form, country_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                    <SelectContent>{countries.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Afiliado asociado</Label>
                  <Select value={form.affiliate_id ?? ""} onValueChange={(v) => setForm({ ...form, affiliate_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Ninguno" /></SelectTrigger>
                    <SelectContent>{affiliates.map((a) => <SelectItem key={a.id} value={a.id}>{a.unique_id} — {a.fixed_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Estado</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-1">
                  <Label>Software utilizado</Label>
                  <div className="flex flex-wrap gap-2 p-2 border rounded-md max-h-32 overflow-y-auto">
                    {softwares.map((s) => (
                      <Badge key={s.id} variant={softwareIds.includes(s.id) ? "default" : "outline"}
                             className="cursor-pointer" onClick={() => toggleSw(s.id)}>{s.name}</Badge>
                    ))}
                  </div>
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
              <TableHead>Empresa</TableHead><TableHead>Contacto</TableHead><TableHead>País</TableHead>
              <TableHead>Afiliado</TableHead><TableHead>Software</TableHead><TableHead>Estado</TableHead>
              {isAdmin && <TableHead className="w-24"></TableHead>}
            </TableRow></TableHeader>
            <TableBody>
              {list.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.company_name}</TableCell>
                  <TableCell>{r.contact_name}</TableCell>
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
    </div>
  );
}
