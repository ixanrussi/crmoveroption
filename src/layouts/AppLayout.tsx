import { Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { NotificationsBell } from "@/components/NotificationsBell";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export default function AppLayout() {
  const { t } = useTranslation();
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center border-b bg-card px-4 sticky top-0 z-30">
            <SidebarTrigger />
            <h1 className="ml-3 text-sm font-medium text-muted-foreground">{t("nav.appTitle")}</h1>
            <div className="ml-auto flex items-center gap-2">
              <LanguageSwitcher />
              <NotificationsBell />
            </div>
          </header>
          <main className="flex-1 p-6 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
