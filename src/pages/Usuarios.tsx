import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "react-router-dom";

type Role = "super_admin" | "admin" | "user" | "comercial";
const ROLES: Role[] = ["super_admin", "admin", "user", "comercial"];
const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super Admin",
  admin: "Administrador",
  user: "Usuario",
  comercial: "Comercial",
};
const ROLE_VARIANT: Record<Role, "default" | "secondary" | "outline"> = {
  super_admin: "default",
  admin: "secondary",
  user: "outline",
  comercial: "outline",
};

type UserRow = {
  id: string;
  email: string;
  full_name: string;
  job_title: string | null;
  roles: Role[];
};

export default function Usuarios() {
  const { user: me, isSuperAdmin } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [pending, setPending] = useState<{ user: UserRow; current: Role; next: Role } | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data, error } = await supabase.functions.invoke<{ users: UserRow[] }>("admin-users");
    if (error) { toast.error(error.message); return; }
    setUsers(data?.users ?? []);
  };
  useEffect(() => { load(); }, []);

  const applyRoleChange = async () => {
    if (!pending) return;
    setSaving(true);
    const { error: delErr } = await supabase.from("user_roles").delete().eq("user_id", pending.user.id);
    if (delErr) { toast.error(delErr.message); setSaving(false); return; }
    const { error: insErr } = await supabase.from("user_roles").insert({ user_id: pending.user.id, role: pending.next });
    setSaving(false);
    if (insErr) { toast.error(insErr.message); return; }
    toast.success(`Rol actualizado a ${ROLE_LABELS[pending.next]}`);
    setPending(null);
    load();
  };

  if (!isSuperAdmin) {
    return <p className="text-muted-foreground">Acceso restringido a Super Admins.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Usuarios y Roles</h1>
        <p className="text-muted-foreground text-sm">
          Valida y define los niveles de acceso de cada usuario. Solo el Super Admin puede modificarlos.
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Nombre</TableHead><TableHead>Email</TableHead>
              <TableHead>Cargo</TableHead><TableHead>Rol actual</TableHead><TableHead className="w-56">Definir rol</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {users.map((u) => {
                const hasRole = u.roles.length > 0;
                const current = (u.roles[0] ?? "user") as Role;
                const isSelf = u.id === me?.id;
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      {isSelf ? (
                        <Link to="/mi-cuenta" className="text-primary hover:underline">{u.full_name || "—"}</Link>
                      ) : (u.full_name || "—")}
                    </TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>{u.job_title || "—"}</TableCell>
                    <TableCell>
                      {hasRole
                        ? <Badge variant={ROLE_VARIANT[current]}>{ROLE_LABELS[current]}</Badge>
                        : <Badge variant="destructive">Pendiente de validación</Badge>}
                    </TableCell>
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      {isSelf ? (
                        <Link to="/mi-cuenta" className="text-primary hover:underline">{u.full_name || "—"}</Link>
                      ) : (u.full_name || "—")}
                    </TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>{u.job_title || "—"}</TableCell>
                    <TableCell><Badge variant={ROLE_VARIANT[current]}>{ROLE_LABELS[current]}</Badge></TableCell>
                    <TableCell>
                      <Select
                        value={current}
                        onValueChange={(v) => {
                          const next = v as Role;
                          if (next !== current) setPending({ user: u, current, next });
                        }}
                        disabled={isSelf}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {isSelf && <p className="text-xs text-muted-foreground mt-1">No puedes cambiar tu propio rol</p>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar cambio de rol</AlertDialogTitle>
            <AlertDialogDescription asChild>
              {pending ? (
                <div>
                  Vas a cambiar el rol de <strong>{pending.user.full_name || pending.user.email}</strong> de{" "}
                  <Badge variant={ROLE_VARIANT[pending.current]}>{ROLE_LABELS[pending.current]}</Badge> a{" "}
                  <Badge variant={ROLE_VARIANT[pending.next]}>{ROLE_LABELS[pending.next]}</Badge>.
                </div>
              ) : <div />}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={applyRoleChange} disabled={saving}>
              {saving ? "Aplicando..." : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
