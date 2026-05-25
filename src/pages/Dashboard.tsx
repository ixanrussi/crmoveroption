import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, UserPlus, Globe, Layers, Map as MapIcon, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import WorldActivityMap from "@/components/WorldActivityMap";
import TopAffiliatesFTD from "@/components/TopAffiliatesFTD";
import TopBrandsCommission from "@/components/TopBrandsCommission";
import MonthlyCpaChart from "@/components/MonthlyCpaChart";
import MarketingFunnel from "@/components/MarketingFunnel";
import BrandGoals from "@/components/BrandGoals";
import GlobalTrendCard from "@/components/GlobalTrendCard";

const Dashboard = () => {
  const { t } = useTranslation();
  const { user, isSuperAdmin, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ clients: 0, affiliates: 0, countries: 0 });
  const [planStats, setPlanStats] = useState({ highMargin: 0, lowMargin: 0, noRs: 0 });
  const [showMap, setShowMap] = useState(false);
  const [displayName, setDisplayName] = useState<string>("");

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("first_name, full_name").eq("id", user.id).maybeSingle()
      .then(({ data }) => setDisplayName(data?.first_name || data?.full_name || user.email?.split("@")[0] || ""));
  }, [user]);

  const loadStats = async () => {
    const [c, a, co] = await Promise.all([
      supabase.from("clients").select("id", { count: "exact", head: true }),
      supabase.from("affiliates").select("id", { count: "exact", head: true }),
      supabase.from("countries").select("id", { count: "exact", head: true }),
    ]);
    setStats({ clients: c.count ?? 0, affiliates: a.count ?? 0, countries: co.count ?? 0 });
  };

  const loadPlanStats = async () => {
    const [tplRes, opRes, clRes] = await Promise.all([
      supabase.from("commission_plan_templates").select("client_id, brand, cpa"),
      supabase.from("client_commission_plans").select("client_id, brand, cpa, rev_share_pct, plan_start_date"),
      supabase.from("clients").select("id"),
    ]);
    const tpls = tplRes.data ?? [];
    const ops = opRes.data ?? [];
    const allClientIds = (clRes.data ?? []).map((c: any) => c.id);

    let high = 0;
    let low = 0;
    tpls.forEach((t: any) => {
      const affCpa = t.cpa != null ? Number(t.cpa) : null;
      if (!t.client_id || affCpa == null || !Number.isFinite(affCpa) || affCpa <= 0) return;
      const bl = (t.brand || "").toLowerCase();
      const cands = ops
        .filter((cp: any) => cp.client_id === t.client_id && cp.cpa != null)
        .filter((cp: any) => !t.brand || !cp.brand || (cp.brand || "").toLowerCase() === bl)
        .sort((a: any, b: any) => (b.plan_start_date || "").localeCompare(a.plan_start_date || ""));
      const opCpa = cands[0]?.cpa != null ? Number(cands[0].cpa) : null;
      if (opCpa == null || !Number.isFinite(opCpa) || opCpa <= 0) return;
      const margin = ((opCpa - affCpa) / opCpa) * 100;
      if (margin >= 30) high++; else low++;
    });

    const clientsWithRs = new Set(
      ops
        .filter((cp: any) => cp.rev_share_pct != null && Number(cp.rev_share_pct) > 0)
        .map((cp: any) => cp.client_id),
    );
    const noRs = allClientIds.filter((id) => !clientsWithRs.has(id)).length;

    setPlanStats({ highMargin: high, lowMargin: low, noRs });
  };

  useEffect(() => { loadStats(); loadPlanStats(); }, []);

  const cards = [
    { label: t("nav.operators"), value: stats.clients, icon: Users, color: "text-primary", to: "/clientes" },
    { label: t("nav.affiliates"), value: stats.affiliates, icon: UserPlus, color: "text-success", to: "/afiliados" },
    { label: t("common.countries"), value: stats.countries, icon: Globe, color: "text-warning" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {t("dashboard.welcome", { name: displayName || user?.email })}
        </h1>
        <p className="text-muted-foreground text-sm">
          {isSuperAdmin ? t("dashboard.superAdmin") : isAdmin ? t("dashboard.administrator") : t("dashboard.user")}
        </p>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card
            key={c.label}
            onClick={c.to ? () => navigate(c.to!) : undefined}
            className={c.to ? "cursor-pointer hover:bg-accent/40 transition-colors" : ""}
          >
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{c.label}</p>
                <p className="text-3xl font-bold mt-1">{c.value}</p>
              </div>
              <c.icon className={`h-8 w-8 ${c.color}`} />
            </CardContent>
          </Card>
        ))}
        <Card>
          <CardContent className="p-6 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">{t("dashboard.activityMap")}</p>
              <Button variant="link" className="h-auto p-0 text-base font-semibold" onClick={() => setShowMap((v) => !v)}>
                {showMap ? t("dashboard.hideMap") : t("dashboard.showMap")}
              </Button>
            </div>
            <MapIcon className="h-8 w-8 text-primary shrink-0" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <Card
          onClick={() => navigate("/planes-comision?margin=high")}
          className="cursor-pointer hover:bg-accent/40 transition-colors"
        >
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Planes con margen ≥ 30% para OO</p>
              <p className="text-3xl font-bold mt-1">{planStats.highMargin}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-success" />
          </CardContent>
        </Card>
        <Card
          onClick={() => navigate("/planes-comision?margin=low")}
          className="cursor-pointer hover:bg-accent/40 transition-colors"
        >
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Planes con margen &lt; 30% para OO</p>
              <p className="text-3xl font-bold mt-1">{planStats.lowMargin}</p>
            </div>
            <TrendingDown className="h-8 w-8 text-destructive" />
          </CardContent>
        </Card>
        <Card
          onClick={() => navigate("/clientes?filter=no-rs")}
          className="cursor-pointer hover:bg-accent/40 transition-colors"
        >
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Operadores sin acuerdo de RS</p>
              <p className="text-3xl font-bold mt-1">{planStats.noRs}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-warning" />
          </CardContent>
        </Card>
      </div>

      {showMap && <WorldActivityMap />}

      <BrandGoals />

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <TopAffiliatesFTD />
        <TopBrandsCommission />
      </div>

      <MarketingFunnel />

      <MonthlyCpaChart />
    </div>
  );
};

export default Dashboard;
