import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Send, Bell, Check, X, Trash2, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

interface Affiliate { id: string; fixed_name: string; alias: string | null; brands: string[] }
interface Client { id: string; company_name: string; brands: string[]; country_ids: string[] }
interface Country { id: string; name: string }
interface Request {
  id: string;
  affiliate_id: string;
  client_id: string;
  brand: string | null;
  country_id: string | null;
  status: "pending" | "created" | "rejected";
  tracking_link: string | null;
  notes: string | null;
  admin_notes: string | null;
  requested_by: string;
  created_at: string;
  resolved_at: string | null;
}

const empty = { affiliate_id: "", client_id: "", brand: "", country_id: "", notes: "" };

export default function SolicitarLinks() {
  const { user, isAdmin } = useAuth();
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [plans, setPlans] = useState<{ client_id: string; brand: string | null; country_ids: string[] }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...empty });

  // resolve dialog (admin)
  const [resolving, setResolving] = useState<Request | null>(null);
  const [resolveLink, setResolveLink] = useState("");
  const [resolveNotes, setResolveNotes] = useState("");

  const load = async () => {
    setLoading(true);
    const [a, c, co, r, p] = await Promise.all([
      supabase.from("affiliates").select("id, fixed_name, alias, brands").eq("status", "active").order("fixed_name"),
      supabase.from("clients").select("id, company_name, brands, country_ids").eq("status", "active").order("company_name"),
      supabase.from("countries").select("id,name").order("name"),
      supabase.from("tracking_link_requests").select("*").order("created_at", { ascending: false }),
      supabase.from("client_commission_plans").select("client_id, brand, country_ids"),
    ]);
    setAffiliates((a.data as any) ?? []);
    setClients((c.data as any) ?? []);
    setCountries(co.data ?? []);
    setRequests((r.data as any) ?? []);
    setPlans((p.data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const selectedClient = useMemo(() => clients.find((c) => c.id === form.client_id), [clients, form.client_id]);
  const brandOptions = selectedClient?.brands ?? [];

  // Searchable list of all (client, brand) combinations across active operators
  const brandEntries = useMemo(() => {
    const list: { client_id: string; brand: string; client_name: string; key: string }[] = [];
    clients.forEach((c) => {
      (c.brands ?? []).forEach((b) => {
        if (!b) return;
        list.push({ client_id: c.id, brand: b, client_name: c.company_name, key: `${c.id}::${b}` });
      });
    });
    return list.sort((a, b) => a.brand.localeCompare(b.brand));
  }, [clients]);

  const [brandPickerOpen, setBrandPickerOpen] = useState(false);
  const [brandQuery, setBrandQuery] = useState("");
  const selectedBrandKey = form.client_id && form.brand ? `${form.client_id}::${form.brand}` : "";

  const countryOptions = useMemo(() => {
    if (!selectedClient) return countries;
    // If a brand is selected, restrict by countries of that brand's commission plans
    if (form.brand) {
      const ids = new Set<string>();
      plans
        .filter((pl) => pl.client_id === selectedClient.id && pl.brand === form.brand)
        .forEach((pl) => (pl.country_ids ?? []).forEach((id) => ids.add(id)));
      const filtered = countries.filter((c) => ids.has(c.id));
      if (filtered.length) return filtered;
    }
    const ids = new Set(selectedClient.country_ids);
    const filtered = countries.filter((c) => ids.has(c.id));
    return filtered.length ? filtered : countries;
  }, [countries, selectedClient, form.brand, plans]);

  // Auto-select country when there's only one option; clear if current value not in list
  useEffect(() => {
    if (!form.client_id) return;
    if (countryOptions.length === 1) {
      const only = countryOptions[0].id;
      if (form.country_id !== only) setForm((f) => ({ ...f, country_id: only }));
    } else if (form.country_id && !countryOptions.some((c) => c.id === form.country_id)) {
      setForm((f) => ({ ...f, country_id: "" }));
    }
  }, [countryOptions, form.client_id]);

  const submit = async () => {
    if (!user?.id) return;
    if (!form.affiliate_id || !form.client_id) {
      toast.error("Selecciona afiliado y operador");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("tracking_link_requests").insert({
      affiliate_id: form.affiliate_id,
      client_id: form.client_id,
      brand: form.brand || null,
      country_id: form.country_id || null,
      notes: form.notes.trim() || null,
      requested_by: user.id,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Solicitud enviada al equipo admin");
    setForm({ ...empty });
    load();
  };

  const openResolve = (r: Request) => {
    setResolving(r);
    setResolveLink(r.tracking_link ?? "");
    setResolveNotes(r.admin_notes ?? "");
  };

  const resolve = async (status: "created" | "rejected") => {
    if (!resolving || !user?.id) return;
    if (status === "created" && !resolveLink.trim()) {
      toast.error("Ingresa el link trackeado");
      return;
    }
    const { error } = await supabase
      .from("tracking_link_requests")
      .update({
        status,
        tracking_link: status === "created" ? resolveLink.trim() : null,
        admin_notes: resolveNotes.trim() || null,
        resolved_by: user.id,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", resolving.id);
    if (error) { toast.error(error.message); return; }
    toast.success(status === "created" ? "Link creado" : "Solicitud rechazada");
    setResolving(null);
    load();
  };

  const removeRequest = async (r: Request) => {
    if (!confirm("¿Eliminar esta solicitud?")) return;
    const { error } = await supabase.from("tracking_link_requests").delete().eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Solicitud eliminada");
    setRequests((prev) => prev.filter((x) => x.id !== r.id));
  };

  const affName = (id: string) => {
    const a = affiliates.find((x) => x.id === id);
    return a ? `${a.fixed_name}${a.alias ? ` (${a.alias})` : ""}` : "—";
  };
  const cliName = (id: string) => clients.find((c) => c.id === id)?.company_name ?? "—";
  const couName = (id: string | null) => (id ? countries.find((c) => c.id === id)?.name ?? "—" : "—");

  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const statusBadge = (s: Request["status"]) => {
    if (s === "pending") return <Badge variant="secondary">Pendiente</Badge>;
    if (s === "created") return <Badge className="bg-green-600 hover:bg-green-600">Creado</Badge>;
    return <Badge variant="destructive">Rechazado</Badge>;
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Solicitar links</h1>
          <p className="text-sm text-muted-foreground">Solicita links trackeados al equipo admin</p>
        </div>
        {isAdmin && pendingCount > 0 && (
          <Badge variant="secondary" className="gap-1">
            <Bell className="h-3 w-3" /> {pendingCount} pendiente{pendingCount === 1 ? "" : "s"}
          </Badge>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle>Nueva solicitud</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Afiliado *</Label>
              <Select value={form.affiliate_id} onValueChange={(v) => setForm({ ...form, affiliate_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                <SelectContent>
                  {affiliates.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.fixed_name}{a.alias ? ` (${a.alias})` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Operador/Marca</Label>
              <div className="relative">
                <Input
                  placeholder="Buscar marca u operador..."
                  value={brandPickerOpen ? brandQuery : (form.brand ? `${form.brand}${selectedClient ? ` · ${selectedClient.company_name}` : ""}` : brandQuery)}
                  onFocus={() => setBrandPickerOpen(true)}
                  onBlur={() => setTimeout(() => setBrandPickerOpen(false), 150)}
                  onChange={(e) => { setBrandQuery(e.target.value); setBrandPickerOpen(true); }}
                />
                {brandPickerOpen && (
                  <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-64 overflow-auto">
                    {(() => {
                      const q = brandQuery.trim().toLowerCase();
                      const filtered = q
                        ? brandEntries.filter((e) =>
                            e.brand.toLowerCase().includes(q) || e.client_name.toLowerCase().includes(q),
                          )
                        : brandEntries;
                      if (!filtered.length) {
                        return <div className="px-3 py-2 text-sm text-muted-foreground">Sin resultados</div>;
                      }
                      return filtered.map((e) => (
                        <button
                          key={e.key}
                          type="button"
                          onMouseDown={(ev) => ev.preventDefault()}
                          onClick={() => {
                            setForm((f) => ({ ...f, client_id: e.client_id, brand: e.brand, country_id: "" }));
                            setBrandQuery("");
                            setBrandPickerOpen(false);
                          }}
                          className={cn(
                            "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent",
                            selectedBrandKey === e.key && "bg-accent",
                          )}
                        >
                          <Check className={cn("h-4 w-4", selectedBrandKey === e.key ? "opacity-100" : "opacity-0")} />
                          <span className="font-medium">{e.brand}</span>
                          <span className="ml-auto text-xs text-muted-foreground">{e.client_name}</span>
                        </button>
                      ));
                    })()}
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>País</Label>
              <Select
                value={form.country_id}
                onValueChange={(v) => setForm({ ...form, country_id: v })}
                disabled={countryOptions.length <= 1}
              >
                <SelectTrigger>
                  <SelectValue placeholder={countryOptions.length ? "Selecciona" : "—"} />
                </SelectTrigger>
                <SelectContent>
                  {countryOptions.map((c) => (<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={500} placeholder="Información adicional opcional" />
          </div>
          <div className="flex justify-end">
            <Button onClick={submit} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Solicitar link
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{isAdmin ? "Todas las solicitudes" : "Mis solicitudes"}</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : requests.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sin solicitudes</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Afiliado</TableHead>
                    <TableHead>Operador</TableHead>
                    <TableHead>Marca</TableHead>
                    <TableHead>País</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Link</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs whitespace-nowrap">{new Date(r.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>{affName(r.affiliate_id)}</TableCell>
                      <TableCell>{cliName(r.client_id)}</TableCell>
                      <TableCell>{r.brand ?? "—"}</TableCell>
                      <TableCell>{couName(r.country_id)}</TableCell>
                      <TableCell>{statusBadge(r.status)}</TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {r.tracking_link ? (
                          <a href={r.tracking_link} target="_blank" rel="noreferrer" className="text-primary underline">{r.tracking_link}</a>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="flex gap-2">
                        {isAdmin && r.status === "pending" && (
                          <Button size="sm" variant="outline" onClick={() => openResolve(r)}>Resolver</Button>
                        )}
                        {(isAdmin || r.requested_by === user?.id) && (
                          <Button size="sm" variant="ghost" onClick={() => removeRequest(r)} title="Eliminar">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!resolving} onOpenChange={(o) => !o && setResolving(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Resolver solicitud</DialogTitle></DialogHeader>
          {resolving && (
            <div className="space-y-4">
              <div className="text-sm space-y-1 bg-muted p-3 rounded">
                <div><b>Afiliado:</b> {affName(resolving.affiliate_id)}</div>
                <div><b>Operador:</b> {cliName(resolving.client_id)}</div>
                <div><b>Marca:</b> {resolving.brand ?? "—"} · <b>País:</b> {couName(resolving.country_id)}</div>
                {resolving.notes && <div><b>Notas:</b> {resolving.notes}</div>}
              </div>
              <div className="space-y-2">
                <Label>Link trackeado</Label>
                <Input value={resolveLink} onChange={(e) => setResolveLink(e.target.value)} placeholder="https://..." />
              </div>
              <div className="space-y-2">
                <Label>Notas admin</Label>
                <Textarea value={resolveNotes} onChange={(e) => setResolveNotes(e.target.value)} maxLength={500} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="destructive" onClick={() => resolve("rejected")}><X className="h-4 w-4" />Rechazar</Button>
            <Button onClick={() => resolve("created")}><Check className="h-4 w-4" />Marcar creado</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
