import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, Save, Eye, EyeOff, Copy, Wallet } from "lucide-react";
import { toast } from "sonner";

type Props = { affiliateId: string };

type AccountRow = {
  id?: string;
  isNew?: boolean;
  client_id: string;
  brand: string | null;
  username: string;
  password: string;
  balance: string;
  balance_currency: string | null;
  balance_notes: string | null;
  notes: string | null;
};

type Client = { id: string; company_name: string; brands: string[] };

export default function AffiliateCasinoAccounts({ affiliateId }: Props) {
  const [rows, setRows] = useState<AccountRow[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPwd, setShowPwd] = useState<Record<string, boolean>>({});

  const load = async () => {
    setLoading(true);
    const [{ data: accs }, { data: cs }] = await Promise.all([
      supabase
        .from("affiliate_casino_accounts" as any)
        .select("*")
        .eq("affiliate_id", affiliateId)
        .order("created_at", { ascending: true }),
      supabase.from("clients").select("id, company_name, brands"),
    ]);
    setRows(
      ((accs as any[]) ?? []).map((r) => ({
        id: r.id,
        client_id: r.client_id,
        brand: r.brand,
        username: r.username ?? "",
        password: r.password ?? "",
        balance: r.balance == null ? "" : String(r.balance),
        balance_currency: r.balance_currency,
        balance_notes: r.balance_notes,
        notes: r.notes,
      })),
    );
    setClients((cs ?? []) as any);
    setLoading(false);
  };

  useEffect(() => {
    if (affiliateId) load();
  }, [affiliateId]);

  const update = (idx: number, patch: Partial<AccountRow>) =>
    setRows((p) => p.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  const addBlank = () =>
    setRows((p) => [
      ...p,
      {
        isNew: true,
        client_id: clients[0]?.id ?? "",
        brand: null,
        username: "",
        password: "",
        balance: "",
        balance_currency: "PEN",
        balance_notes: "no retirables",
        notes: null,
      },
    ]);

  const remove = async (idx: number) => {
    const r = rows[idx];
    if (r.id) {
      const { error } = await supabase.from("affiliate_casino_accounts" as any).delete().eq("id", r.id);
      if (error) return toast.error(error.message);
    }
    setRows((p) => p.filter((_, i) => i !== idx));
    toast.success("Cuenta eliminada");
  };

  const saveOne = async (idx: number) => {
    const r = rows[idx];
    if (!r.client_id || !r.username.trim() || !r.password.trim()) {
      return toast.error("Operador, usuario y contraseña son obligatorios");
    }
    setSaving(true);
    try {
      const payload = {
        affiliate_id: affiliateId,
        client_id: r.client_id,
        brand: r.brand || null,
        username: r.username.trim(),
        password: r.password,
        balance: r.balance === "" ? null : Number(r.balance),
        balance_currency: r.balance_currency || null,
        balance_notes: r.balance_notes || null,
        notes: r.notes || null,
      };
      if (r.isNew) {
        const { data, error } = await supabase
          .from("affiliate_casino_accounts" as any)
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        setRows((p) => p.map((x, i) => (i === idx ? { ...x, id: (data as any).id, isNew: false } : x)));
      } else if (r.id) {
        const { error } = await supabase.from("affiliate_casino_accounts" as any).update(payload).eq("id", r.id);
        if (error) throw error;
      }
      toast.success("Cuenta guardada");
    } catch (e: any) {
      toast.error(e.message ?? "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copiado`);
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  const togglePwd = (key: string) => setShowPwd((s) => ({ ...s, [key]: !s[key] }));

  const brandsFor = (clientId: string) => clients.find((c) => c.id === clientId)?.brands ?? [];

  if (loading) return <div className="py-8 text-base text-muted-foreground">Cargando…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Wallet className="h-5 w-5" /> Cuentas de casino (banca fake)
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Credenciales de acceso del afiliado a las cuentas de prueba en cada operador.
          </p>
        </div>
        <Button size="default" variant="outline" onClick={addBlank}>
          <Plus className="h-4 w-4 mr-2" /> Añadir cuenta
        </Button>
      </div>

      {rows.length === 0 && (
        <div className="text-center text-muted-foreground py-12 text-base border rounded-lg bg-muted/20">
          Aún no hay cuentas registradas
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {rows.map((r, idx) => {
          const key = r.id ?? `new-${idx}`;
          const visible = !!showPwd[key];
          const clientName = clients.find((c) => c.id === r.client_id)?.company_name ?? "";
          return (
            <Card key={key} className="relative overflow-visible">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-bold">
                      {idx + 1}
                    </span>
                    {clientName || "Nueva cuenta"}
                  </CardTitle>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => saveOne(idx)} disabled={saving} title="Guardar">
                      <Save className="h-4 w-4 mr-1" /> Guardar
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 px-2 text-destructive hover:text-destructive" onClick={() => remove(idx)} title="Eliminar">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5 pt-0">
                {/* Operador & Marca */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Operador</Label>
                    <Select value={r.client_id} onValueChange={(v) => update(idx, { client_id: v, brand: null })}>
                      <SelectTrigger className="h-11 text-sm w-full">
                        <SelectValue placeholder="Seleccionar operador" />
                      </SelectTrigger>
                      <SelectContent>
                        {clients.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Marca</Label>
                    {brandsFor(r.client_id).length > 0 ? (
                      <Select value={r.brand ?? ""} onValueChange={(v) => update(idx, { brand: v || null })}>
                        <SelectTrigger className="h-11 text-sm w-full">
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent>
                          {brandsFor(r.client_id).map((b) => (
                            <SelectItem key={b} value={b}>{b}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        value={r.brand ?? ""}
                        onChange={(e) => update(idx, { brand: e.target.value })}
                        className="h-11 text-sm w-full"
                        placeholder="—"
                      />
                    )}
                  </div>
                </div>

                {/* Usuario */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Usuario</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={r.username}
                      onChange={(e) => update(idx, { username: e.target.value })}
                      className="h-11 text-sm flex-1"
                      placeholder="Ej: Overoptionpe"
                    />
                    {r.username && (
                      <Button size="icon" variant="outline" className="h-11 w-11 shrink-0" onClick={() => copy(r.username, "Usuario")} title="Copiar usuario">
                        <Copy className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Contraseña */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Contraseña</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type={visible ? "text" : "password"}
                      value={r.password}
                      onChange={(e) => update(idx, { password: e.target.value })}
                      className="h-11 text-sm flex-1"
                      placeholder="Ej: Stakeperu2025*"
                    />
                    <Button size="icon" variant="outline" className="h-11 w-11 shrink-0" onClick={() => togglePwd(key)} title={visible ? "Ocultar" : "Ver"}>
                      {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    {r.password && (
                      <Button size="icon" variant="outline" className="h-11 w-11 shrink-0" onClick={() => copy(r.password, "Contraseña")} title="Copiar contraseña">
                        <Copy className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Saldo & Moneda & Notas */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Saldo</Label>
                    <Input
                      type="number"
                      value={r.balance}
                      onChange={(e) => update(idx, { balance: e.target.value })}
                      className="h-11 text-sm w-full"
                      placeholder="5000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Moneda</Label>
                    <Input
                      value={r.balance_currency ?? ""}
                      onChange={(e) => update(idx, { balance_currency: e.target.value.toUpperCase() })}
                      className="h-11 text-sm w-full"
                      placeholder="PEN"
                      maxLength={6}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Notas del saldo</Label>
                    <Input
                      value={r.balance_notes ?? ""}
                      onChange={(e) => update(idx, { balance_notes: e.target.value })}
                      className="h-11 text-sm w-full"
                      placeholder="no retirables"
                    />
                  </div>
                </div>

                {/* Notas generales */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Notas adicionales</Label>
                  <Input
                    value={r.notes ?? ""}
                    onChange={(e) => update(idx, { notes: e.target.value })}
                    className="h-11 text-sm w-full"
                    placeholder="Notas adicionales sobre la cuenta"
                  />
                </div>

                {/* Ejemplo visual */}
                {r.balance && r.username && (
                  <div className="bg-muted/40 rounded-lg p-3 text-sm text-muted-foreground flex items-center gap-2">
                    <Badge variant="outline" className="text-xs shrink-0">Ejemplo</Badge>
                    User: {r.username} · Pass: {r.password} · Saldo: {r.balance_currency || "S/"}{r.balance} {r.balance_notes || ""}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
