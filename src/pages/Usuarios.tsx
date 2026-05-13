import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Pencil, Trash2 } from "lucide-react";
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
  phone: string | null;
  is_active: boolean;
  roles: Role[];
};

type EditState = {
  user: UserRow;
  full_name: string;
  email: string;
  job_title: string;
  phone: string;
};

export default function Usuarios() {
  const { user: me, isSuperAdmin } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [pending, setPending] = useState<{ user: UserRow; current: Role; next: Role } | null>(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [deleting, setDeleting] = useState<UserRow | null>(null);

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

  const toggleActive = async (u: UserRow) => {
    const next = !u.is_active;
    const { error } = await supabase.from("profiles").update({ is_active: next }).eq("id", u.id);
    if (error) { toast.error(error.message); return; }
    toast.success(next ? "Usuario activado" : "Usuario desactivado");
    load();
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string }>("admin-users", {
      body: {
        action: "update",
        userId: editing.user.id,
        full_name: editing.full_name.trim(),
        email: editing.email.trim(),
        job_title: editing.job_title.trim() || null,
        phone: editing.phone.trim() || null,
      },
    });
    setSaving(false);
    if (error || data?.error) { toast.error(error?.message || data?.error || "Error al guardar"); return; }
    toast.success("Usuario actualizado");
    setEditing(null);
    load();
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setSaving(true);
    const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string }>("admin-users", {
      body: { action: "delete", userId: deleting.id },
    });
    setSaving(false);
    if (error || data?.error) { toast.error(error?.message || data?.error || "Error al eliminar"); return; }
    toast.success("Usuario eliminado");
    setDeleting(null);
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
              <TableHead>Cargo</TableHead><TableHead>Rol actual</TableHead>
              <TableHead className="w-56">Definir rol</TableHead>
              <TableHead className="w-40">Estado</TableHead>
              <TableHead className="w-28 text-right">Acciones</TableHead>
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
                        : <Badge variant="destructive">Sin rol</Badge>}
                    </TableCell>
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
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={u.is_active}
                          onCheckedChange={() => toggleActive(u)}
                          disabled={isSelf}
                        />
                        <Badge variant={u.is_active ? "default" : "outline"}>
                          {u.is_active ? "Activo" : "Inactivo"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setEditing({
                            user: u,
                            full_name: u.full_name || "",
                            email: u.email || "",
                            job_title: u.job_title || "",
                            phone: u.phone || "",
                          })}
                          aria-label="Editar usuario"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setDeleting(u)}
                          disabled={isSelf}
                          aria-label="Eliminar usuario"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
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

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar usuario</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Nombre completo</Label>
                <Input id="edit-name" value={editing.full_name}
                  onChange={(e) => setEditing({ ...editing, full_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input id="edit-email" type="email" value={editing.email}
                  onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-job">Cargo</Label>
                <Input id="edit-job" value={editing.job_title}
                  onChange={(e) => setEditing({ ...editing, job_title: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-phone">Teléfono</Label>
                <Input id="edit-phone" value={editing.phone}
                  onChange={(e) => setEditing({ ...editing, phone: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>Cancelar</Button>
            <Button onClick={saveEdit} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar usuario</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting ? (
                <>Esta acción eliminará permanentemente a <strong>{deleting.full_name || deleting.email}</strong> y todos sus accesos. No se puede deshacer.</>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={saving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {saving ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
