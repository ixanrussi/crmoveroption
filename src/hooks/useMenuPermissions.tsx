import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/hooks/useAuth";

export type MenuKey =
  | "dashboard"
  | "clientes"
  | "afiliados"
  | "planes-comision"
  | "calculadora-fijos"
  | "tracker-report"
  | "listas-paises"
  | "listas-software"
  | "listas-canales"
  | "listas-monedas"
  | "usuarios"
  | "logs";

export const MENU_GROUPS: { group: string; items: { key: MenuKey; label: string }[] }[] = [
  {
    group: "Principal",
    items: [
      { key: "dashboard", label: "Dashboard" },
      { key: "clientes", label: "Operadores" },
      { key: "afiliados", label: "Afiliados" },
      { key: "planes-comision", label: "Planes Comisión Afiliado" },
      { key: "calculadora-fijos", label: "Calculadora de Fijos" },
      { key: "tracker-report", label: "API Report" },
    ],
  },
  {
    group: "Listas maestras",
    items: [
      { key: "listas-paises", label: "GEO's" },
      { key: "listas-software", label: "Software" },
      { key: "listas-canales", label: "Canales" },
      { key: "listas-monedas", label: "Monedas" },
    ],
  },
  {
    group: "Administración",
    items: [
      { key: "usuarios", label: "Usuarios y Roles" },
      { key: "logs", label: "Log de actividad" },
    ],
  },
];

export const CONFIGURABLE_ROLES: AppRole[] = ["admin", "user", "comercial"];

interface Ctx {
  permissions: Record<string, Set<MenuKey>>;
  loading: boolean;
  can: (key: MenuKey) => boolean;
  refresh: () => Promise<void>;
}

const MenuPermissionsContext = createContext<Ctx | undefined>(undefined);

export const MenuPermissionsProvider = ({ children }: { children: ReactNode }) => {
  const { roles, isSuperAdmin } = useAuth();
  const [permissions, setPermissions] = useState<Record<string, Set<MenuKey>>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("role_menu_permissions").select("role, menu_key");
    const map: Record<string, Set<MenuKey>> = {};
    (data ?? []).forEach((row: any) => {
      if (!map[row.role]) map[row.role] = new Set();
      map[row.role].add(row.menu_key as MenuKey);
    });
    setPermissions(map);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const can = useCallback(
    (key: MenuKey) => {
      if (isSuperAdmin) return true;
      return roles.some((r) => permissions[r]?.has(key));
    },
    [permissions, roles, isSuperAdmin],
  );

  return (
    <MenuPermissionsContext.Provider value={{ permissions, loading, can, refresh: load }}>
      {children}
    </MenuPermissionsContext.Provider>
  );
};

export const useMenuPermissions = () => {
  const ctx = useContext(MenuPermissionsContext);
  if (!ctx) throw new Error("useMenuPermissions must be used within MenuPermissionsProvider");
  return ctx;
};
