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
import { Plus, Loader2, Pencil, X, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Country { id: string; name: string }
interface Channel { id: string; name: string }
interface Client { id: string; company_name: string }
interface PlanTemplate { id: string; name: string; client_id: string | null; brand: string | null }
interface ProspectAffiliate {
  id: string;
  fixed_name: string;
  alias: string | null;
  email: string | null;
  phone: string | null;
  country_ids: string[];
  brands: string[];
  notes: string | null;
  created_by: string | null;
  status: string;
  affiliate_channel_links?: { channel_id: string; link?: string | null; channel?: { name: string } }[];
}

const empty = {
  fixed_name: "",
  alias: "",
  email: "",
  phone: "",
  country_ids: [] as string[],
  brands: [] as string[],
  channel_ids: [] as string[],
  channel_links: {} as Record<string, string[]>,
  interests: {} as Record<string, string[]>,
  notes: "",
};

const PRESET_CHANNELS = ["Kick", "Pinterest", "Web", "Otros"];

export default function ProspectsAfiliados() {
  const { user, isAdmin, isSuperAdmin } = useAuth();
  const canSeeAll = isAdmin || isSuperAdmin;
  const [rows, setRows] = useState<ProspectAffiliate[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<ProspectAffiliate | null>(null);
  const [form, setForm] = useState({ ...empty });
  const [brandInput, setBrandInput] = useState("");
  const [newChannelName, setNewChannelName] = useState("");
  const [creatingChannel, setCreatingChannel] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("affiliates")
      .select("id, fixed_name, alias, email, phone, country_ids, brands, notes, created_by, status, affiliate_channel_links(channel_id, link, channel:affiliate_channels(name))")
      .eq("status", "prospect")
      .order("fixed_name");
    if (!canSeeAll && user?.id) q = q.eq("created_by", user.id);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    setRows((data as any) ?? []);
    setLoading(false);
  };

  const loadLookups = async () => {
    const [c, ch] = await Promise.all([
      supabase.from("countries").select("id,name").order("name"),
      supabase.from("affiliate_channels").select("id,name").order("name"),
    ]);
    setCountries(c.data ?? []);
    let existing = ch.data ?? [];
    const missing = PRESET_CHANNELS.filter(
      (n) => !existing.some((e) => e.name.toLowerCase() === n.toLowerCase())
    );
    if (missing.length > 0) {
      const { data: inserted } = await supabase
        .from("affiliate_channels")
        .insert(missing.map((name) => ({ name })))
        .select("id,name");
      if (inserted) existing = [...existing, ...inserted];
    }
    setChannels(existing.sort((a, b) => {
      const aIsOtros = a.name.toLowerCase() === "otros";
      const bIsOtros = b.name.toLowerCase() === "otros";
      if (aIsOtros && !bIsOtros) return 1;
      if (!aIsOtros && bIsOtros) return -1;
      return a.name.localeCompare(b.name);
    }));
  };

  useEffect(() => { load(); loadLookups(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ ...empty });
    setBrandInput("");
    setOpen(true);
  };

  const openEdit = (row: ProspectAffiliate) => {
    setEditing(row);
    const links = row.affiliate_channel_links ?? [];
    const grouped: Record<string, string[]> = {};
    for (const l of links) {
      if (!grouped[l.channel_id]) grouped[l.channel_id] = [];
      grouped[l.channel_id].push(l.link ?? "");
    }
    for (const k of Object.keys(grouped)) {
      if (grouped[k].length === 0) grouped[k] = [""];
    }
    setForm({
      fixed_name: row.fixed_name ?? "",
      alias: row.alias ?? "",
      email: row.email ?? "",
      phone: row.phone ?? "",
      country_ids: row.country_ids ?? [],
      brands: row.brands ?? [],
      channel_ids: Object.keys(grouped),
      channel_links: grouped,
      notes: row.notes ?? "",
    });
    setBrandInput("");
    setOpen(true);
  };

  const createChannel = async (nameOverride?: string) => {
    const name = (nameOverride ?? newChannelName).trim();
    if (!name) return null as any;
    if (channels.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      if (!nameOverride) toast.error("Ese canal ya existe");
      return channels.find((c) => c.name.toLowerCase() === name.toLowerCase());
    }
    setCreatingChannel(true);
    const { data, error } = await supabase
      .from("affiliate_channels")
      .insert({ name })
      .select("id,name")
      .single();
    setCreatingChannel(false);
    if (error) { if (!nameOverride) toast.error(error.message); return null as any; }
    const updated = [...channels, data].sort((a, b) => a.name.localeCompare(b.name));
    setChannels(updated);
    if (!nameOverride) { setNewChannelName(""); toast.success("Canal creado"); }
    return data;
  };

  const togglePresetChannel = async (name: string) => {
    const existing = channels.find((c) => c.name.toLowerCase() === name.toLowerCase());
    let channel = existing;
    if (!channel) {
      channel = await createChannel(name);
      if (!channel) return;
    }
    const checked = form.channel_ids.includes(channel.id);
    const next = checked ? form.channel_ids.filter((x) => x !== channel.id) : [...form.channel_ids, channel.id];
    const nextLinks = { ...form.channel_links };
    if (!checked) { if (!(channel.id in nextLinks)) nextLinks[channel.id] = [""]; }
    else { delete nextLinks[channel.id]; }
    setForm({ ...form, channel_ids: next, channel_links: nextLinks });
  };


  const addBrand = () => {
    const v = brandInput.trim();
    if (!v) return;
    if (form.brands.includes(v)) { setBrandInput(""); return; }
    setForm({ ...form, brands: [...form.brands, v] });
    setBrandInput("");
  };

  const save = async () => {
    if (!form.fixed_name.trim()) { toast.error("Nombre fijo requerido"); return; }
    for (const cid of form.channel_ids) {
      const trimmed = (form.channel_links[cid] ?? []).map((l) => l.trim()).filter(Boolean);
      if (new Set(trimmed).size !== trimmed.length) {
        const ch = channels.find((c) => c.id === cid);
        toast.error(`Links duplicados en el canal ${ch?.name ?? ""}`);
        return;
      }
    }
    setSaving(true);
    const payload: any = {
      fixed_name: form.fixed_name.trim(),
      alias: form.alias || null,
      email: form.email || null,
      phone: form.phone || null,
      country_ids: form.country_ids,
      brands: form.brands,
      notes: form.notes || null,
      status: "prospect",
    };
    let affiliateId: string | undefined = editing?.id;
    let error: any;
    if (editing) {
      ({ error } = await supabase.from("affiliates").update(payload).eq("id", editing.id));
    } else {
      payload.created_by = user?.id;
      const { data, error: insErr } = await supabase.from("affiliates").insert(payload).select("id").single();
      error = insErr;
      affiliateId = data?.id;
    }
    if (error) { setSaving(false); toast.error(error.message); return; }

    // Sync channels (allow multiple links per channel, no duplicates per channel)
    if (affiliateId) {
      await supabase.from("affiliate_channel_links").delete().eq("affiliate_id", affiliateId);
      const rowsToInsert: { affiliate_id: string; channel_id: string; link: string | null }[] = [];
      for (const channel_id of form.channel_ids) {
        const links = (form.channel_links[channel_id] ?? [""]).map((l) => l.trim());
        const seen = new Set<string>();
        const cleaned = links.filter((l) => {
          if (!l) return false;
          if (seen.has(l)) return false;
          seen.add(l);
          return true;
        });
        if (cleaned.length === 0) {
          rowsToInsert.push({ affiliate_id: affiliateId!, channel_id, link: null });
        } else {
          for (const link of cleaned) rowsToInsert.push({ affiliate_id: affiliateId!, channel_id, link });
        }
      }
      if (rowsToInsert.length > 0) {
        await supabase.from("affiliate_channel_links").insert(rowsToInsert);
      }
    }

    setSaving(false);
    toast.success(editing ? "Prospect actualizado" : "Prospect creado");
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("affiliates").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Prospect eliminado");
    setConfirmOpen(false);
    setDeletingId(null);
    load();
  };

  const countryNames = (ids: string[]) =>
    countries.filter((c) => ids?.includes(c.id)).map((c) => c.name).join(", ");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Afiliados prospect</h1>
          <p className="text-sm text-muted-foreground">
            Registro rápido de afiliados potenciales con datos básicos.
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
                  <TableHead>Nombre fijo</TableHead>
                  <TableHead>Alias</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>GEOs</TableHead>
                  <TableHead>Canales</TableHead>
                  <TableHead>Marcas</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.fixed_name}</TableCell>
                    <TableCell>{r.alias || "—"}</TableCell>
                    <TableCell>{r.email || "—"}</TableCell>
                    <TableCell>{r.phone || "—"}</TableCell>
                    <TableCell className="max-w-[160px] truncate">{countryNames(r.country_ids) || "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(r.affiliate_channel_links ?? []).slice(0, 3).map((l, i) => (
                          <Badge key={i} variant="outline">{l.channel?.name ?? ""}</Badge>
                        ))}
                      </div>
                    </TableCell>
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
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => { setDeletingId(r.id); setConfirmOpen(true); }}
                      >
                        <Trash2 className="h-4 w-4" />
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
            <DialogTitle>{editing ? "Editar prospect" : "Nuevo afiliado prospect"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Nombre fijo *</Label>
                <Input
                  value={form.fixed_name}
                  onChange={(e) => setForm({ ...form, fixed_name: e.target.value })}
                  disabled={!!editing && !isSuperAdmin}
                />
                {editing && !isSuperAdmin && (
                  <p className="text-xs text-muted-foreground">Solo el super admin puede modificar el nombre fijo.</p>
                )}
              </div>
              <div className="grid gap-2">
                <Label>Alias</Label>
                <Input value={form.alias} onChange={(e) => setForm({ ...form, alias: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Teléfono</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
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
                <PopoverContent className="w-72">
                  <div
                    className="space-y-2 max-h-72 overflow-y-auto pr-1 overscroll-contain"
                    onWheel={(e) => e.stopPropagation()}
                    onTouchMove={(e) => e.stopPropagation()}
                  >
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
              <Label>Canales</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-start font-normal">
                    {form.channel_ids.length === 0
                      ? "Seleccionar canales"
                      : channels.filter((c) => form.channel_ids.includes(c.id)).map((c) => c.name).join(", ")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                  <div
                    className="max-h-60 overflow-y-auto space-y-2 pr-1 overscroll-contain"
                    onWheel={(e) => e.stopPropagation()}
                    onTouchMove={(e) => e.stopPropagation()}
                  >
                    {channels.length === 0 && (
                      <p className="text-xs text-muted-foreground">No hay canales aún. Crea el primero abajo.</p>
                    )}
                    {channels.map((c) => {
                      const checked = form.channel_ids.includes(c.id);
                      return (
                        <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => {
                              const cur = form.channel_ids;
                              const next = v ? [...cur, c.id] : cur.filter((x) => x !== c.id);
                              const nextLinks = { ...form.channel_links };
                              if (v) { if (!(c.id in nextLinks)) nextLinks[c.id] = [""]; }
                              else { delete nextLinks[c.id]; }
                              setForm({ ...form, channel_ids: next, channel_links: nextLinks });
                            }}
                          />
                          {c.name}
                        </label>
                      );
                    })}
                  </div>
                  <div className="border-t pt-2 mt-2 flex gap-2">
                    <Input
                      placeholder="Nuevo canal (ej. Telegram)"
                      value={newChannelName}
                      onChange={(e) => setNewChannelName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); createChannel(); } }}
                      className="h-8"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => createChannel()}
                      disabled={creatingChannel || !newChannelName.trim()}
                    >
                      {creatingChannel ? <Loader2 className="h-3 w-3 animate-spin" /> : "Añadir"}
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
              {form.channel_ids.length > 0 && (
                <div className="grid gap-3 mt-2 rounded-md border p-3 bg-muted/30">
                  <p className="text-xs text-muted-foreground">URLs del canal del afiliado</p>
                  {form.channel_ids.map((cid) => {
                    const ch = channels.find((c) => c.id === cid);
                    const links = form.channel_links[cid] ?? [""];
                    const updateLinks = (next: string[]) =>
                      setForm({ ...form, channel_links: { ...form.channel_links, [cid]: next } });
                    return (
                      <div key={cid} className="grid gap-1">
                        {links.map((val, idx) => {
                          const trimmed = val.trim();
                          const isDup =
                            trimmed.length > 0 &&
                            links.findIndex((l, i) => i !== idx && l.trim() === trimmed) !== -1;
                          const isLast = idx === links.length - 1;
                          return (
                            <div key={idx} className="grid grid-cols-[120px_1fr_auto_auto] items-center gap-2">
                              <Label className="text-xs font-normal truncate">
                                {idx === 0 ? ch?.name ?? "—" : ""}
                              </Label>
                              <Input
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
                  })}
                </div>
              )}
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

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>¿Eliminar prospect?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Esta acción no se puede deshacer. ¿Seguro que quieres eliminar este afiliado prospect?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setConfirmOpen(false); setDeletingId(null); }}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletingId && remove(deletingId)}
              disabled={!deletingId}
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
