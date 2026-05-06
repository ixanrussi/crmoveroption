import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Plus, Trash2, Loader2, Target } from "lucide-react";
import { toast } from "sonner";

type Props = { affiliateId: string };

type Goal = {
  id: string;
  affiliate_id: string;
  scope: "general" | "monthly";
  period: string | null;
  client_id: string | null;
  brand: string | null;
  ftd_target: number;
  notes: string | null;
};
type Client = { id: string; company_name: string; brands: string[] | null };
type Item = {
  closure_id: string;
  brand: string | null;
  qualified_players: number;
};
type Closure = { id: string; client_id: string; period: string };

export default function AffiliateGoals({ affiliateId }: Props) {
  const { isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [closures, setClosures] = useState<Closure[]>([]);

  const empty: Omit<Goal, "id" | "affiliate_id"> = {
    scope: "general", period: "", client_id: null, brand: null, ftd_target: 0, notes: "",
  };
  const [draft, setDraft] = useState<typeof empty>(empty);

  const load = async () => {
    setLoading(true);
    const [{ data: g }, { data: c }, { data: it }, { data: cs }] = await Promise.all([
      supabase.from("affiliate_goals").select("*").eq("affiliate_id", affiliateId).order("created_at", { ascending: false }),
      supabase.from("clients").select("id, company_name, brands").order("company_name"),
      supabase.from("commission_closure_items").select("closure_id, brand, qualified_players").eq("affiliate_id", affiliateId),
      supabase.from("commission_closures").select("id, client_id, period"),
    ]);
    setGoals((g ?? []) as Goal[]);
    setClients((c ?? []) as Client[]);
    setItems((it ?? []) as Item[]);
    setClosures((cs ?? []) as Closure[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, [affiliateId]);

  const closureMap = useMemo(() => new Map(closures.map((c) => [c.id, c])), [closures]);
  const clientMap = useMemo(() => new Map(clients.map((c) => [c.id, c.company_name])), [clients]);

  const computeProgress = (g: Goal): number => {
    let total = 0;
    for (const it of items) {
      const cls = closureMap.get(it.closure_id);
      if (!cls) continue;
      if (g.scope === "monthly" && g.period && cls.period !== g.period) continue;
      if (g.client_id && cls.client_id !== g.client_id) continue;
      if (g.brand) {
        const a = (it.brand || "").toLowerCase();
        const b = g.brand.toLowerCase();
        if (!(a.includes(b) || b.includes(a))) continue;
      }
      total += it.qualified_players || 0;
    }
    return total;
  };

  const addGoal = async () => {
    if (!draft.ftd_target || draft.ftd_target <= 0) {
      return toast.error("Define un objetivo FTD mayor a 0");
    }
    if (draft.scope === "monthly" && !draft.period) {
      return toast.error("Indica el mes (YYYY-MM)");
    }
    setSaving(true);
    const payload: any = {
      affiliate_id: affiliateId,
      scope: draft.scope,
      period: draft.scope === "monthly" ? draft.period : null,
      client_id: draft.client_id || null,
      brand: draft.brand?.trim() || null,
      ftd_target: Math.trunc(Number(draft.ftd_target)),
      notes: draft.notes?.trim() || null,
    };
    const { error } = await supabase.from("affiliate_goals").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    setDraft(empty);
    toast.success("Objetivo agregado");
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar este objetivo?")) return;
    const { error } = await supabase.from("affiliate_goals").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setGoals((p) => p.filter((g) => g.id !== id));
  };

  if (loading) return (
    <div className="flex items-center gap-2 p-6 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Cargando…</div>
  );

  return (
    <div className="space-y-4">
      {isAdmin && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 font-medium text-sm">
              <Plus className="h-4 w-4" /> Nuevo objetivo
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">Tipo</Label>
                <Select value={draft.scope} onValueChange={(v: any) => setDraft({ ...draft, scope: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="monthly">Mensual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {draft.scope === "monthly" && (
                <div>
                  <Label className="text-xs">Mes</Label>
                  <Input type="month" value={draft.period ?? ""} onChange={(e) => setDraft({ ...draft, period: e.target.value })} />
                </div>
              )}
              <div>
                <Label className="text-xs">Cliente (opcional)</Label>
                <Select value={draft.client_id ?? "__all__"} onValueChange={(v) => setDraft({ ...draft, client_id: v === "__all__" ? null : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todos</SelectItem>
                    {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Marca (opcional)</Label>
                <Input value={draft.brand ?? ""} maxLength={80} onChange={(e) => setDraft({ ...draft, brand: e.target.value })} placeholder="ej. Betway.es" />
              </div>
              <div>
                <Label className="text-xs">Objetivo FTD</Label>
                <Input type="number" min={1} max={1000000} value={draft.ftd_target || ""} onChange={(e) => setDraft({ ...draft, ftd_target: Number(e.target.value) })} />
              </div>
              <div className="col-span-2 md:col-span-3">
                <Label className="text-xs">Notas</Label>
                <Input value={draft.notes ?? ""} maxLength={300} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
              </div>
            </div>
            <Button size="sm" onClick={addGoal} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
              Agregar objetivo
            </Button>
          </CardContent>
        </Card>
      )}

      {goals.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          Sin objetivos definidos.
        </CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Alcance</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Marca</TableHead>
                  <TableHead className="text-right">Objetivo</TableHead>
                  <TableHead className="text-right">Actual</TableHead>
                  <TableHead>Progreso</TableHead>
                  {isAdmin && <TableHead className="w-12"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {goals.map((g) => {
                  const current = computeProgress(g);
                  const pct = g.ftd_target > 0 ? Math.min(100, Math.round((current / g.ftd_target) * 100)) : 0;
                  return (
                    <TableRow key={g.id}>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          <Target className="h-3 w-3 mr-1" />
                          {g.scope === "monthly" ? `Mes ${g.period}` : "General"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{g.client_id ? clientMap.get(g.client_id) ?? "—" : <span className="text-muted-foreground">Todos</span>}</TableCell>
                      <TableCell className="text-xs">{g.brand ?? <span className="text-muted-foreground">Todas</span>}</TableCell>
                      <TableCell className="text-right font-medium">{g.ftd_target}</TableCell>
                      <TableCell className="text-right">{current}</TableCell>
                      <TableCell className="min-w-[160px]">
                        <div className="flex items-center gap-2">
                          <Progress value={pct} className="h-2 flex-1" />
                          <span className={`text-xs font-medium ${pct >= 100 ? "text-success" : ""}`}>{pct}%</span>
                        </div>
                      </TableCell>
                      {isAdmin && (
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => remove(g.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
