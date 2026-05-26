import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LayoutDashboard, Users, UserPlus, Shield, List, LogOut, UserCircle, ScrollText, Calculator, Activity, Wallet, KeyRound, Sparkles, Link2, Globe, Download } from "lucide-react";
import { useMenuPermissions, type MenuKey } from "@/hooks/useMenuPermissions";
import logo from "@/assets/overoption-logo.png";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "./ui/button";

export function AppSidebar() {
  const { t } = useTranslation();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const { isSuperAdmin, isComercial, isAdmin, signOut, user } = useAuth();
  const { can } = useMenuPermissions();
  const isActive = (p: string) => pathname === p;

  const allMainItems: { title: string; url: string; icon: any; key: MenuKey }[] = [
    { title: t("nav.dashboard"), url: "/", icon: LayoutDashboard, key: "dashboard" },
    { title: t("nav.operators"), url: "/clientes", icon: Users, key: "clientes" },
    
    { title: t("nav.affiliates"), url: "/afiliados", icon: UserPlus, key: "afiliados" },
    { title: t("nav.affiliatesProspect"), url: "/prospects/afiliados", icon: Sparkles, key: "prospects-afiliados" },
    { title: t("nav.requestLinks"), url: "/solicitar-links", icon: Link2, key: "solicitar-links" },
    { title: t("nav.commissionPlans"), url: "/planes-comision", icon: Wallet, key: "planes-comision" },
    { title: t("nav.fixedCalculator"), url: "/calculadora-fijos", icon: Calculator, key: "calculadora-fijos" },
    { title: t("nav.apiReport"), url: "/tracker-report", icon: Activity, key: "tracker-report" },
    { title: "Landing Pages", url: "/landing-pages", icon: Globe, key: "landing-pages" },
    { title: "Descarga de datos", url: "/descarga-datos", icon: Download, key: "descarga-datos" },
  ];
  const listItems: { title: string; url: string; key: MenuKey }[] = [
    { title: t("nav.geos"), url: "/listas/paises", key: "listas-paises" },
    { title: t("nav.software"), url: "/listas/software", key: "listas-software" },
    { title: t("nav.channels"), url: "/listas/canales", key: "listas-canales" },
    { title: t("nav.currencies"), url: "/listas/monedas", key: "listas-monedas" },
  ];

  const mainItems = allMainItems.filter((i) => can(i.key));
  const visibleListItems = listItems.filter((i) => can(i.key));

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
          <SidebarGroupLabel>{t("nav.main")}</SidebarGroupLabel>
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

        {visibleListItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>{t("nav.lists")}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleListItems.map((item) => (
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
            <SidebarGroupLabel>{t("nav.admin")}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/usuarios")}>
                    <NavLink to="/usuarios">
                      <Shield className="h-4 w-4" />
                      <span>{t("nav.usersRoles")}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/configuracion-roles")}>
                    <NavLink to="/configuracion-roles">
                      <KeyRound className="h-4 w-4" />
                      <span>{t("nav.rolesConfig")}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/logs")}>
                    <NavLink to="/logs">
                      <ScrollText className="h-4 w-4" />
                      <span>{t("nav.activityLog")}</span>
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
                <span>{t("nav.myAccount")}</span>
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
          {!collapsed && <span className="ml-2">{t("nav.signOut")}</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
