import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { CONFIGURABLE_ROLES, MENU_GROUPS, useMenuPermissions, type MenuKey } from "@/hooks/useMenuPermissions";
import type { AppRole } from "@/hooks/useAuth";
import { Loader2, Save } from "lucide-react";

const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  user: "User",
  comercial: "Comercial",
};

export default function RoleMenuPermissions() {
  const { permissions, refresh, loading } = useMenuPermissions();
  const [draft, setDraft] = useState<Record<string, Set<MenuKey>>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const next: Record<string, Set<MenuKey>> = {};
    CONFIGURABLE_ROLES.forEach((r) => {
      next[r] = new Set(permissions[r] ?? []);
    });
    setDraft(next);
  }, [permissions]);

  const toggle = (role: AppRole, key: MenuKey) => {
    setDraft((prev) => {
      const set = new Set(prev[role] ?? []);
      if (set.has(key)) set.delete(key);
      else set.add(key);
      return { ...prev, [role]: set };
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const rows: { role: AppRole; menu_key: MenuKey }[] = [];
      CONFIGURABLE_ROLES.forEach((role) => {
        (draft[role] ? Array.from(draft[role]) : []).forEach((menu_key) => {
          rows.push({ role, menu_key });
        });
      });

      const { error: delErr } = await supabase
        .from("role_menu_permissions")
        .delete()
        .in("role", CONFIGURABLE_ROLES);
      if (delErr) throw delErr;

      if (rows.length > 0) {
        const { error: insErr } = await supabase.from("role_menu_permissions").insert(rows);
        if (insErr) throw insErr;
      }

      toast({ title: "Permisos guardados" });
      await refresh();
    } catch (e: any) {
      toast({ title: "Error al guardar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-10">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Configuración de Roles</h1>
          <p className="text-sm text-muted-foreground">
            Define qué áreas del menú puede ver cada rol. Super Admin siempre tiene acceso a todo.
          </p>
        </div>
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Guardar cambios
        </Button>
      </div>

      {MENU_GROUPS.map((group) => (
        <Card key={group.group}>
          <CardHeader>
            <CardTitle className="text-lg">{group.group}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Área</TableHead>
                  {CONFIGURABLE_ROLES.map((r) => (
                    <TableHead key={r} className="text-center">{ROLE_LABELS[r]}</TableHead>
                  ))}
                  <TableHead className="text-center">
                    <Badge variant="secondary">Super Admin</Badge>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.items.map((item) => (
                  <TableRow key={item.key}>
                    <TableCell className="font-medium">{item.label}</TableCell>
                    {CONFIGURABLE_ROLES.map((r) => (
                      <TableCell key={r} className="text-center">
                        <div className="flex justify-center">
                          <Checkbox
                            checked={draft[r]?.has(item.key) ?? false}
                            onCheckedChange={() => toggle(r, item.key)}
                          />
                        </div>
                      </TableCell>
                    ))}
                    <TableCell className="text-center text-muted-foreground">✓</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
