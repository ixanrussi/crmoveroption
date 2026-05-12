import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, UserPlus, Globe, Layers, Map as MapIcon } from "lucide-react";
import WorldActivityMap from "@/components/WorldActivityMap";
import TopAffiliatesFTD from "@/components/TopAffiliatesFTD";
import TopBrandsCommission from "@/components/TopBrandsCommission";

const Dashboard = () => {
  const { user, isSuperAdmin, isAdmin } = useAuth();
  const [stats, setStats] = useState({ clients: 0, affiliates: 0, countries: 0 });
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

  useEffect(() => { loadStats(); }, []);

  const cards = [
    { label: "Operadores", value: stats.clients, icon: Users, color: "text-primary" },
    { label: "Afiliados", value: stats.affiliates, icon: UserPlus, color: "text-success" },
    { label: "Países", value: stats.countries, icon: Globe, color: "text-warning" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Bienvenido, {displayName || user?.email}</h1>
        <p className="text-muted-foreground text-sm">
          {isSuperAdmin ? "Super Admin" : isAdmin ? "Administrador" : "Usuario"}
        </p>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
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
              <p className="text-sm text-muted-foreground">Mapa de actividad</p>
              <Button variant="link" className="h-auto p-0 text-base font-semibold" onClick={() => setShowMap((v) => !v)}>
                {showMap ? "Ocultar" : "Ver mapa"}
              </Button>
            </div>
            <MapIcon className="h-8 w-8 text-primary shrink-0" />
          </CardContent>
        </Card>
      </div>

      {showMap && <WorldActivityMap />}

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <TopAffiliatesFTD />
        <TopBrandsCommission />
      </div>
    </div>
  );
};

export default Dashboard;
