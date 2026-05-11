import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, Users, UserPlus, Shield, List, LogOut, UserCircle, FileSpreadsheet, BarChart3, BookOpen, ScrollText, Calculator, Activity, Wallet, KeyRound } from "lucide-react";
import { useMenuPermissions, type MenuKey } from "@/hooks/useMenuPermissions";
import logo from "@/assets/overoption-logo.png";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "./ui/button";

const allMainItems: { title: string; url: string; icon: any; key: MenuKey }[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, key: "dashboard" },
  { title: "Operadores", url: "/clientes", icon: Users, key: "clientes" },
  { title: "Afiliados", url: "/afiliados", icon: UserPlus, key: "afiliados" },
  { title: "Planes Comisión Afiliado", url: "/planes-comision", icon: Wallet, key: "planes-comision" },
  { title: "Cierre de Comisiones", url: "/cierres", icon: FileSpreadsheet, key: "cierres" },
  { title: "Dashboard Comisiones", url: "/comisiones-dashboard", icon: BarChart3, key: "comisiones-dashboard" },
  { title: "Calculadora de Fijos", url: "/calculadora-fijos", icon: Calculator, key: "calculadora-fijos" },
  { title: "Tracker Report", url: "/tracker-report", icon: Activity, key: "tracker-report" },
];
const listItems: { title: string; url: string; key: MenuKey }[] = [
  { title: "GEO´s", url: "/listas/paises", key: "listas-paises" },
  { title: "Software", url: "/listas/software", key: "listas-software" },
  { title: "Canales", url: "/listas/canales", key: "listas-canales" },
  { title: "Monedas", url: "/listas/monedas", key: "listas-monedas" },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const { isAdmin, isSuperAdmin, isComercial, signOut, user } = useAuth();
  const isActive = (p: string) => pathname === p;
  const mainItems = isComercial && !isAdmin
    ? allMainItems.filter((i) => i.url === "/calculadora-fijos")
    : allMainItems;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="bg-sidebar-primary rounded-md p-1.5 flex items-center justify-center">
            <img src={logo} alt="Overoption" className="h-5 w-auto" />
          </div>
          {!collapsed && (
            <span className="text-lg font-semibold text-sidebar-foreground">CRM</span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Listas maestras</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {listItems.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)}>
                      <NavLink to={item.url}>
                        <List className="h-4 w-4" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {isSuperAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Administración</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/usuarios")}>
                    <NavLink to="/usuarios">
                      <Shield className="h-4 w-4" />
                      <span>Usuarios y Roles</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/conocimiento")}>
                    <NavLink to="/conocimiento">
                      <BookOpen className="h-4 w-4" />
                      <span>Base de Conocimiento</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/logs")}>
                    <NavLink to="/logs">
                      <ScrollText className="h-4 w-4" />
                      <span>Log de actividad</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={isActive("/mi-cuenta")}>
              <NavLink to="/mi-cuenta">
                <UserCircle className="h-4 w-4" />
                <span>Mi cuenta</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        {!collapsed && (
          <div className="px-2 py-1.5 text-xs text-sidebar-foreground/70 truncate">
            {user?.email}
          </div>
        )}
        <Button variant="ghost" size="sm" onClick={signOut}
          className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="ml-2">Cerrar sesión</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
