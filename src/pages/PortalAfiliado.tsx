import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AffiliateEarnings from "@/components/AffiliateEarnings";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, LogOut, BarChart3 } from "lucide-react";
import { Link } from "react-router-dom";

export default function PortalAfiliado() {
  const { user, signOut } = useAuth();
  const [affiliateId, setAffiliateId] = useState<string | null>(null);
  const [affiliateName, setAffiliateName] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.email) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("affiliates")
        .select("id, fixed_name, alias")
        .ilike("email", user.email!)
        .maybeSingle();
      setAffiliateId(data?.id ?? null);
      setAffiliateName(data?.alias || data?.fixed_name || "");
      setLoading(false);
    })();
  }, [user?.email]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Portal del Afiliado</h1>
          {affiliateName && (
            <p className="text-sm text-muted-foreground">Bienvenido, {affiliateName}</p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => signOut()}>
          <LogOut className="h-4 w-4 mr-2" /> Cerrar sesión
        </Button>
      </div>

      <Alert className="border-warning/40 bg-warning/10">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Ambiente BETA</AlertTitle>
        <AlertDescription className="text-sm">
          Este portal se encuentra en versión BETA y está sujeto a posibles cambios,
          ajustes de cálculo o interrupciones temporales por actualizaciones del sistema.
          Los importes mostrados son indicativos y se confirman con los cierres oficiales.
        </AlertDescription>
      </Alert>

      {loading ? (
        <div className="flex items-center gap-2 p-6 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
        </div>
      ) : !affiliateId ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No encontramos un registro de afiliado vinculado a tu email{" "}
            <span className="font-medium">{user?.email}</span>.
            Contacta con tu account manager para que verifique tu alta.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="bg-gradient-to-br from-primary/10 to-transparent border-primary/30">
            <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="font-semibold flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" /> Dashboard de performance</p>
                <p className="text-xs text-muted-foreground">CPAs cualificados, calidad de tráfico, pagos y desgloses por operador.</p>
              </div>
              <Button asChild size="sm"><Link to={`/afiliados/${affiliateId}/performance`}>Ver performance</Link></Button>
            </CardContent>
          </Card>
          <AffiliateEarnings affiliateId={affiliateId} />
        </>
      )}
    </div>
  );
}
