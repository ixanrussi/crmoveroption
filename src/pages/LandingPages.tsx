import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Edit, ExternalLink, Copy, Globe } from "lucide-react";
import { toast } from "sonner";

type LP = {
  id: string;
  affiliate_id: string;
  country_id: string | null;
  slug: string;
  title: string;
  subtitle: string | null;
  intro: string | null;
  hero_image_url: string | null;
  operator_ids: string[];
  seo_title: string | null;
  seo_description: string | null;
  is_published: boolean;
  notes: string | null;
};

const empty = (): Partial<LP> => ({
  affiliate_id: "",
  country_id: null,
  slug: "ranking-bonos",
  title: "Top Operadores 2026",
  subtitle: "Los mejores bonos y casinos elegidos para ti",
  intro: "",
  hero_image_url: "",
  operator_ids: [],
  seo_title: "",
  seo_description: "",
  is_published: false,
  notes: "",
});

export default function LandingPages() {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<LP[]>([]);
  const [affiliates, setAffiliates] = useState<{ id: string; fixed_name: string; slug: string | null }[]>([]);
  const [countries, setCountries] = useState<{ id: string; name: string; code: string | null }[]>([]);
  const [clients, setClients] = useState<{ id: string; company_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<LP> | null>(null);
  const [q, setQ] = useState("");

  const load = async () => {
    setLoading(true);
    const [{ data: lps }, { data: aff }, { data: co }, { data: cl }] = await Promise.all([
      supabase.from("landing_pages").select("*").order("updated_at", { ascending: false }),
      supabase.from("affiliates").select("id, fixed_name, slug").order("fixed_name"),
      supabase.from("countries").select("id, name, code").order("name"),
      supabase.from("clients").select("id, company_name").order("company_name"),
    ]);
    setRows((lps ?? []) as any);
    setAffiliates((aff ?? []) as any);
    setCountries((co ?? []) as any);
    setClients((cl ?? []) as any);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const affMap = useMemo(() => Object.fromEntries(affiliates.map((a) => [a.id, a])), [affiliates]);
  const coMap = useMemo(() => Object.fromEntries(countries.map((c) => [c.id, c])), [countries]);
  const clMap = useMemo(() => Object.fromEntries(clients.map((c) => [c.id, c])), [clients]);

  const filtered = rows.filter((r) => {
    const aff = affMap[r.affiliate_id];
    const co = r.country_id ? coMap[r.country_id] : null;
    const text = `${r.title} ${r.slug} ${aff?.fixed_name ?? ""} ${co?.name ?? ""}`.toLowerCase();
    return text.includes(q.toLowerCase());
  });

  const publicUrl = (r: LP) => {
    const aff = affMap[r.affiliate_id];
    const co = r.country_id ? coMap[r.country_id] : null;
    if (!aff?.slug || !co?.code) return null;
    return `${window.location.origin}/lp/${aff.slug}/${co.code.toLowerCase()}`;
  };

  const save = async () => {
    if (!editing) return;
    if (!editing.affiliate_id || !editing.title || !editing.slug) {
      return toast.error("Afiliado, título y slug son obligatorios");
    }
    const payload = {
      affiliate_id: editing.affiliate_id,
      country_id: editing.country_id || null,
      slug: editing.slug,
      title: editing.title,
      subtitle: editing.subtitle || null,
      intro: editing.intro || null,
      hero_image_url: editing.hero_image_url || null,
      operator_ids: editing.operator_ids ?? [],
      seo_title: editing.seo_title || null,
      seo_description: editing.seo_description || null,
      is_published: !!editing.is_published,
      notes: editing.notes || null,
    };
    const { error } = editing.id
      ? await supabase.from("landing_pages").update(payload).eq("id", editing.id)
      : await supabase.from("landing_pages").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Landing page guardada");
    setOpen(false);
    setEditing(null);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar landing page?")) return;
    const { error } = await supabase.from("landing_pages").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Eliminada");
    load();
  };

  const toggleOperator = (id: string) => {
    setEditing((p) => {
      const list = p?.operator_ids ?? [];
      return { ...p, operator_ids: list.includes(id) ? list.filter((x) => x !== id) : [...list, id] };
    });
  };

  const moveOperator = (id: string, dir: -1 | 1) => {
    setEditing((p) => {
      const list = [...(p?.operator_ids ?? [])];
      const idx = list.indexOf(id);
      if (idx < 0) return p;
      const ni = idx + dir;
      if (ni < 0 || ni >= list.length) return p;
      [list[idx], list[ni]] = [list[ni], list[idx]];
      return { ...p, operator_ids: list };
    });
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Globe className="h-6 w-6" /> Landing Pages
          </h1>
          <p className="text-sm text-muted-foreground">Páginas de ranking públicas por afiliado y país, con links trackeados.</p>
        </div>
        {isAdmin && (
          <Button onClick={() => { setEditing(empty()); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Nueva landing page
          </Button>
        )}
      </div>

      <Input placeholder="Buscar por título, afiliado o país..." value={q} onChange={(e) => setQ(e.target.value)} className="max-w-md" />

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Cargando…</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Afiliado</TableHead>
                  <TableHead>País</TableHead>
                  <TableHead>Operadores</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>URL pública</TableHead>
                  <TableHead className="w-32"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => {
                  const url = publicUrl(r);
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.title}</TableCell>
                      <TableCell>{affMap[r.affiliate_id]?.fixed_name ?? "—"}</TableCell>
                      <TableCell>{r.country_id ? coMap[r.country_id]?.name : "—"}</TableCell>
                      <TableCell>{r.operator_ids?.length ?? 0}</TableCell>
                      <TableCell>
                        {r.is_published ? <Badge>Publicada</Badge> : <Badge variant="secondary">Borrador</Badge>}
                      </TableCell>
                      <TableCell className="max-w-xs">
                        {url ? (
                          <div className="flex items-center gap-1">
                            <a href={url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline truncate">
                              {url.replace(window.location.origin, "")}
                            </a>
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { navigator.clipboard.writeText(url); toast.success("Copiado"); }}>
                              <Copy className="h-3 w-3" />
                            </Button>
                            <a href={url} target="_blank" rel="noreferrer"><ExternalLink className="h-3 w-3 text-muted-foreground" /></a>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Falta slug/país</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {isAdmin && (
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" onClick={() => { setEditing(r); setOpen(true); }}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => remove(r.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Sin landing pages</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar" : "Nueva"} landing page</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Afiliado *</Label>
                  <Select value={editing.affiliate_id || ""} onValueChange={(v) => setEditing({ ...editing, affiliate_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecciona afiliado" /></SelectTrigger>
                    <SelectContent>
                      {affiliates.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.fixed_name} {a.slug && <span className="text-xs text-muted-foreground ml-1">/{a.slug}</span>}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>País</Label>
                  <Select value={editing.country_id || "__none"} onValueChange={(v) => setEditing({ ...editing, country_id: v === "__none" ? null : v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">— Global —</SelectItem>
                      {countries.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name} {c.code && `(${c.code})`}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Slug *</Label>
                  <Input value={editing.slug || ""} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} placeholder="ranking-bonos" />
                </div>
                <div className="flex items-end gap-2">
                  <Switch checked={!!editing.is_published} onCheckedChange={(v) => setEditing({ ...editing, is_published: v })} />
                  <Label>Publicada</Label>
                </div>
              </div>

              <div>
                <Label>Título *</Label>
                <Input value={editing.title || ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
              </div>
              <div>
                <Label>Subtítulo</Label>
                <Input value={editing.subtitle || ""} onChange={(e) => setEditing({ ...editing, subtitle: e.target.value })} />
              </div>
              <div>
                <Label>Intro</Label>
                <Textarea rows={3} value={editing.intro || ""} onChange={(e) => setEditing({ ...editing, intro: e.target.value })} />
              </div>
              <div>
                <Label>Imagen hero (URL)</Label>
                <Input value={editing.hero_image_url || ""} onChange={(e) => setEditing({ ...editing, hero_image_url: e.target.value })} placeholder="https://..." />
              </div>

              <div>
                <Label>Operadores a destacar (orden = orden del ranking)</Label>
                <Card className="mt-1">
                  <CardContent className="p-3 max-h-64 overflow-y-auto space-y-1">
                    {(editing.operator_ids ?? []).map((id, idx) => (
                      <div key={id} className="flex items-center justify-between gap-2 p-1 rounded bg-muted/30">
                        <span className="text-sm"><b>{idx + 1}.</b> {clMap[id]?.company_name ?? id}</span>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => moveOperator(id, -1)}>↑</Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => moveOperator(id, 1)}>↓</Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => toggleOperator(id)}><Trash2 className="h-3 w-3" /></Button>
                        </div>
                      </div>
                    ))}
                    <div className="border-t pt-2 mt-2 space-y-1">
                      <div className="text-xs text-muted-foreground mb-1">Añadir:</div>
                      {clients.filter((c) => !(editing.operator_ids ?? []).includes(c.id)).map((c) => (
                        <div key={c.id} className="flex items-center gap-2">
                          <Checkbox checked={false} onCheckedChange={() => toggleOperator(c.id)} />
                          <span className="text-sm">{c.company_name}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>SEO title</Label>
                  <Input value={editing.seo_title || ""} onChange={(e) => setEditing({ ...editing, seo_title: e.target.value })} />
                </div>
                <div>
                  <Label>SEO description</Label>
                  <Input value={editing.seo_description || ""} onChange={(e) => setEditing({ ...editing, seo_description: e.target.value })} />
                </div>
              </div>

              <div>
                <Label>Notas internas</Label>
                <Textarea rows={2} value={editing.notes || ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
