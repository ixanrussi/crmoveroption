import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Trash2, Plus, ExternalLink, Save, Link2 } from "lucide-react";
import { toast } from "sonner";

type Props = { affiliateId: string };

type LinkRow = {
  id?: string;
  isNew?: boolean;
  client_id: string;
  brand: string | null;
  country_id: string | null;
  tracking_link: string;
  operator_campaign_id: string | null;
  notes: string | null;
  source?: string;
};

export default function AffiliateTrackingLinks({ affiliateId }: Props) {
  const [plans, setPlans] = useState<any[]>([]);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [clients, setClients] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: pl }, { data: tl }, { data: cs }] = await Promise.all([
      supabase
        .from("affiliate_commission_plans")
        .select("id, client_id, brand, country_id")
        .eq("affiliate_id", affiliateId),
      supabase
        .from("affiliate_tracking_links")
        .select("*")
        .eq("affiliate_id", affiliateId)
        .order("created_at", { ascending: true }),
      supabase.from("clients").select("id, company_name"),
    ]);
    setPlans(pl ?? []);
    setLinks((tl ?? []) as any);
    const map: Record<string, string> = {};
    (cs ?? []).forEach((c: any) => (map[c.id] = c.company_name));
    setClients(map);
    setLoading(false);
  };

  useEffect(() => {
    if (affiliateId) load();
  }, [affiliateId]);

  // Build the list of "expected" rows (one per plan client+brand) and mark which are missing a link
  const expected = useMemo(() => {
    const seen = new Set<string>();
    const out: { client_id: string; brand: string; country_id: string | null; key: string }[] = [];
    for (const p of plans) {
      const brand = p.brand || "";
      const key = `${p.client_id}::${brand.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ client_id: p.client_id, brand, country_id: p.country_id ?? null, key });
    }
    return out;
  }, [plans]);

  const linksByKey = useMemo(() => {
    const m: Record<string, LinkRow[]> = {};
    for (const l of links) {
      const k = `${l.client_id}::${(l.brand || "").toLowerCase()}`;
      (m[k] ||= []).push(l);
    }
    return m;
  }, [links]);

  const missing = expected.filter((e) => !(linksByKey[e.key]?.length));

  const updateLink = (idx: number, patch: Partial<LinkRow>) =>
    setLinks((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  const removeLink = async (idx: number) => {
    const l = links[idx];
    if (l.id) {
      const { error } = await supabase.from("affiliate_tracking_links").delete().eq("id", l.id);
      if (error) return toast.error(error.message);
    }
    setLinks((prev) => prev.filter((_, i) => i !== idx));
    toast.success("Link eliminado");
  };

  const addLinkFor = (e: { client_id: string; brand: string; country_id: string | null }) => {
    setLinks((prev) => [
      ...prev,
      {
        isNew: true,
        client_id: e.client_id,
        brand: e.brand || null,
        country_id: e.country_id,
        tracking_link: "",
        operator_campaign_id: null,
        notes: null,
        source: "manual",
      },
    ]);
  };

  const addBlank = () => {
    if (plans.length === 0) return toast.error("Este afiliado no tiene planes de comisión asignados");
    const first = plans[0];
    addLinkFor({ client_id: first.client_id, brand: first.brand || "", country_id: first.country_id ?? null });
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      // Validate
      const invalid = links.find((l) => !l.client_id || !l.tracking_link?.trim());
      if (invalid) {
        toast.error("Cada link necesita operador y URL");
        setSaving(false);
        return;
      }
      const toInsert = links.filter((l) => l.isNew).map((l) => ({
        affiliate_id: affiliateId,
        client_id: l.client_id,
        brand: l.brand || null,
        country_id: l.country_id || null,
        tracking_link: l.tracking_link.trim(),
        operator_campaign_id: l.operator_campaign_id || null,
        notes: l.notes || null,
        source: "manual",
      }));
      const toUpdate = links.filter((l) => !l.isNew && l.id);

      if (toInsert.length) {
        const { error } = await supabase.from("affiliate_tracking_links").insert(toInsert);
        if (error) throw error;
      }
      for (const l of toUpdate) {
        const { error } = await supabase
          .from("affiliate_tracking_links")
          .update({
            client_id: l.client_id,
            brand: l.brand || null,
            country_id: l.country_id || null,
            tracking_link: l.tracking_link.trim(),
            operator_campaign_id: l.operator_campaign_id || null,
            notes: l.notes || null,
          })
          .eq("id", l.id!);
        if (error) throw error;
      }
      toast.success("Tracking links guardados");
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="py-6 text-sm text-muted-foreground">Cargando…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <Link2 className="h-4 w-4" /> Tracking links por operador
          </h3>
          <p className="text-xs text-muted-foreground">
            Registra el link de tracking real con el que opera el afiliado en cada operador/marca.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={addBlank}>
            <Plus className="h-4 w-4 mr-1" /> Añadir
          </Button>
          <Button size="sm" onClick={saveAll} disabled={saving}>
            <Save className="h-4 w-4 mr-1" /> {saving ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </div>

      {missing.length > 0 && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
          <div className="flex items-center gap-2 text-destructive font-semibold text-sm mb-2">
            <AlertTriangle className="h-4 w-4" />
            {missing.length} operador{missing.length > 1 ? "es" : ""} sin tracking link — urgente
          </div>
          <ul className="space-y-1.5">
            {missing.map((m) => (
              <li key={m.key} className="flex items-center justify-between text-sm">
                <span>
                  {clients[m.client_id] || "—"}
                  {m.brand && <Badge variant="outline" className="ml-2 text-[10px]">{m.brand}</Badge>}
                </span>
                <Button size="sm" variant="outline" onClick={() => addLinkFor(m)}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Registrar link
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="border rounded-md overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[24%]">Operador / Marca</TableHead>
              <TableHead>Tracking link</TableHead>
              <TableHead className="w-[18%]">ID campaña</TableHead>
              <TableHead className="w-[14%]">Origen</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {links.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-6 text-sm">
                  Aún no hay tracking links registrados
                </TableCell>
              </TableRow>
            )}
            {links.map((l, idx) => (
              <TableRow key={l.id ?? `new-${idx}`} className="[&>td]:py-2">
                <TableCell>
                  <div className="text-sm font-medium">{clients[l.client_id] || "—"}</div>
                  {l.brand && <Badge variant="outline" className="text-[10px] mt-0.5">{l.brand}</Badge>}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Input
                      value={l.tracking_link}
                      onChange={(e) => updateLink(idx, { tracking_link: e.target.value })}
                      placeholder="https://…"
                      className="h-8 text-xs"
                    />
                    {l.tracking_link && (
                      <a
                        href={l.tracking_link}
                        target="_blank"
                        rel="noreferrer"
                        className="text-muted-foreground hover:text-foreground"
                        title="Abrir"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Input
                    value={l.operator_campaign_id ?? ""}
                    onChange={(e) => updateLink(idx, { operator_campaign_id: e.target.value })}
                    placeholder="—"
                    className="h-8 text-xs"
                  />
                </TableCell>
                <TableCell>
                  <Badge variant={l.source === "request" ? "default" : "secondary"} className="text-[10px]">
                    {l.source === "request" ? "Solicitud" : "Manual"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button size="icon" variant="ghost" onClick={() => removeLink(idx)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
