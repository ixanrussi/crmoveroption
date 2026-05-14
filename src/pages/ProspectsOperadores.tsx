import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, Loader2, Pencil, X } from "lucide-react";
import { toast } from "sonner";

interface Country { id: string; name: string }
interface ProspectOperator {
  id: string;
  company_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  country_ids: string[];
  brands: string[];
  notes: string | null;
  created_by: string | null;
  status: string;
}

const empty = {
  company_name: "",
  contact_name: "",
  email: "",
  phone: "",
  country_ids: [] as string[],
  brands: [] as string[],
  notes: "",
};

export default function ProspectsOperadores() {
  const { user, isAdmin, isSuperAdmin } = useAuth();
  const canSeeAll = isAdmin || isSuperAdmin;
  const [rows, setRows] = useState<ProspectOperator[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<ProspectOperator | null>(null);
  const [form, setForm] = useState({ ...empty });
  const [brandInput, setBrandInput] = useState("");

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("clients")
      .select("id, company_name, contact_name, email, phone, country_ids, brands, notes, created_by, status")
      .eq("status", "prospect")
      .order("company_name");
    if (!canSeeAll && user?.id) q = q.eq("created_by", user.id);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    setRows((data as any) ?? []);
    setLoading(false);
  };

  const loadCountries = async () => {
    const { data } = await supabase.from("countries").select("id,name").order("name");
    setCountries(data ?? []);
  };

  useEffect(() => { load(); loadCountries(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ ...empty });
    setBrandInput("");
    setOpen(true);
  };

  const openEdit = (row: ProspectOperator) => {
    setEditing(row);
    setForm({
      company_name: row.company_name ?? "",
      contact_name: row.contact_name ?? "",
      email: row.email ?? "",
      phone: row.phone ?? "",
      country_ids: row.country_ids ?? [],
      brands: row.brands ?? [],
      notes: row.notes ?? "",
    });
    setBrandInput("");
    setOpen(true);
  };

  const addBrand = () => {
    const v = brandInput.trim();
    if (!v) return;
    if (form.brands.includes(v)) { setBrandInput(""); return; }
    setForm({ ...form, brands: [...form.brands, v] });
    setBrandInput("");
  };

  const save = async () => {
    if (!form.company_name.trim()) { toast.error("Nombre de la empresa requerido"); return; }
    setSaving(true);
    const payload: any = {
      company_name: form.company_name.trim(),
      contact_name: form.contact_name || null,
      email: form.email || null,
      phone: form.phone || null,
      country_ids: form.country_ids,
      brands: form.brands,
      notes: form.notes || null,
      status: "prospect",
    };
    let error;
    if (editing) {
      ({ error } = await supabase.from("clients").update(payload).eq("id", editing.id));
    } else {
      payload.created_by = user?.id;
      ({ error } = await supabase.from("clients").insert(payload));
    }
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Prospect actualizado" : "Prospect creado");
    setOpen(false);
    load();
  };

  const countryNames = (ids: string[]) =>
    countries.filter((c) => ids?.includes(c.id)).map((c) => c.name).join(", ");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Operadores prospect</h1>
          <p className="text-sm text-muted-foreground">
            Registro rápido de operadores potenciales con datos básicos.
          </p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Nuevo prospect</Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Listado</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Aún no hay prospects registrados.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>GEOs</TableHead>
                  <TableHead>Marcas</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.company_name}</TableCell>
                    <TableCell>{r.contact_name || "—"}</TableCell>
                    <TableCell>{r.email || "—"}</TableCell>
                    <TableCell>{r.phone || "—"}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{countryNames(r.country_ids) || "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(r.brands ?? []).slice(0, 3).map((b) => (
                          <Badge key={b} variant="secondary">{b}</Badge>
                        ))}
                        {(r.brands?.length ?? 0) > 3 && (
                          <Badge variant="outline">+{r.brands.length - 3}</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar prospect" : "Nuevo operador prospect"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Nombre de la empresa *</Label>
              <Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Persona de contacto</Label>
                <Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Teléfono</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>GEOs / Países</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-start font-normal">
                    {form.country_ids.length === 0
                      ? "Seleccionar países"
                      : countries.filter((c) => form.country_ids.includes(c.id)).map((c) => c.name).join(", ")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 max-h-72 overflow-auto">
                  <div className="space-y-2">
                    {countries.map((c) => {
                      const checked = form.country_ids.includes(c.id);
                      return (
                        <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => {
                              const cur = form.country_ids;
                              setForm({ ...form, country_ids: v ? [...cur, c.id] : cur.filter((x) => x !== c.id) });
                            }}
                          />
                          {c.name}
                        </label>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid gap-2">
              <Label>Marcas</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Ej. BetX"
                  value={brandInput}
                  onChange={(e) => setBrandInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addBrand(); } }}
                />
                <Button type="button" variant="secondary" onClick={addBrand}>Añadir</Button>
              </div>
              <div className="flex flex-wrap gap-1 mt-1">
                {form.brands.map((b) => (
                  <Badge key={b} variant="secondary" className="gap-1">
                    {b}
                    <button type="button" onClick={() => setForm({ ...form, brands: form.brands.filter((x) => x !== b) })}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Notas</Label>
              <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editing ? "Guardar" : "Crear prospect"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
