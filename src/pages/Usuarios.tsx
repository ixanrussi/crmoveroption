import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "react-router-dom";

type Role = "super_admin" | "admin" | "user";
const ROLES: Role[] = ["super_admin", "admin", "user"];

type UserRow = {
  id: string;
  email: string;
  full_name: string;
  job_title: string | null;
  roles: Role[];
};

export default function Usuarios() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);

  const load = async () => {
    const { data, error } = await supabase.functions.invoke<{ users: UserRow[] }>("admin-users");
    if (error) {
      toast.error(error.message);
      return;
    }
    setUsers(data?.users ?? []);
  };
  useEffect(() => { load(); }, []);

  const setRole = async (userId: string, newRole: Role) => {
    // Remove all current roles, set the new one
    const { error: delErr } = await supabase.from("user_roles").delete().eq("user_id", userId);
    if (delErr) { toast.error(delErr.message); return; }
    const { error: insErr } = await supabase.from("user_roles").insert({ user_id: userId, role: newRole });
    if (insErr) { toast.error(insErr.message); return; }
    toast.success("Rol actualizado");
    load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Usuarios y Roles</h1>
        <p className="text-muted-foreground text-sm">
          Gestiona los niveles de acceso. Solo el super admin tiene esta vista.
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Nombre</TableHead><TableHead>Email</TableHead>
              <TableHead>Cargo</TableHead><TableHead>Rol actual</TableHead><TableHead className="w-48">Cambiar rol</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {users.map((u) => {
                const current = (u.roles[0] ?? "user") as Role;
                const isSelf = u.id === me?.id;
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>{u.job_title || "—"}</TableCell>
                    <TableCell><Badge>{current}</Badge></TableCell>
                    <TableCell>
                      <Select value={current} onValueChange={(v) => setRole(u.id, v as Role)} disabled={isSelf}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
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
    </div>
  );
}
