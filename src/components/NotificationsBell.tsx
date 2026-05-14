import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

type RequestRow = {
  id: string;
  brand: string | null;
  status: string;
  created_at: string;
  tracking_link: string | null;
  affiliate: { fixed_name: string } | null;
  client: { company_name: string } | null;
  country: { name: string } | null;
};

export function NotificationsBell() {
  const { t } = useTranslation();
  const { user, isAdmin, isComercial } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<RequestRow[]>([]);

  const visible = isAdmin || isComercial;

  const load = async () => {
    if (!visible) return;
    let query = supabase
      .from("tracking_link_requests")
      .select(
        "id, brand, status, created_at, tracking_link, affiliate:affiliates(fixed_name), client:clients(company_name), country:countries(name)",
      )
      .order("created_at", { ascending: false })
      .limit(20);

    if (isAdmin) {
      query = query.eq("status", "pending");
    } else {
      query = query.eq("requested_by", user!.id);
    }

    const { data } = await query;
    setItems((data as any) ?? []);
  };

  useEffect(() => {
    if (!visible || !user) return;
    load();
    const channel = supabase
      .channel("tracking_link_requests_notify")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tracking_link_requests" },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, user?.id]);

  if (!visible) return null;

  const count = isAdmin
    ? items.length
    : items.filter((i) => i.status !== "pending").length;

  const statusLabel = (s: string) =>
    s === "pending" ? t("common.pending") : s === "created" ? t("common.created") : t("common.rejected");
  const statusVariant = (s: string): "default" | "secondary" | "destructive" =>
    s === "created" ? "default" : s === "rejected" ? "destructive" : "secondary";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={t("notifications.aria")}>
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold flex items-center justify-center">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <p className="text-sm font-semibold">
            {isAdmin ? t("notifications.pendingLinks") : t("notifications.myRequests")}
          </p>
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 text-xs"
            onClick={() => {
              setOpen(false);
              navigate("/solicitar-links");
            }}
          >
            {t("notifications.seeAll")}
          </Button>
        </div>
        <ScrollArea className="max-h-96">
          {items.length === 0 ? (
            <p className="text-xs text-muted-foreground p-4 text-center">
              {t("notifications.empty")}
            </p>
          ) : (
            <ul className="divide-y">
              {items.map((it) => (
                <li
                  key={it.id}
                  className="px-4 py-3 hover:bg-muted/50 cursor-pointer"
                  onClick={() => {
                    setOpen(false);
                    navigate("/solicitar-links");
                  }}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-sm font-medium truncate">
                      {it.affiliate?.fixed_name ?? "—"}
                    </p>
                    <Badge variant={statusVariant(it.status)} className="shrink-0 text-[10px]">
                      {statusLabel(it.status)}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {it.client?.company_name ?? "—"}
                    {it.brand ? ` · ${it.brand}` : ""}
                    {it.country?.name ? ` · ${it.country.name}` : ""}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {new Date(it.created_at).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
