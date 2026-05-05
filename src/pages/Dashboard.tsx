import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users, UserPlus, Globe, Layers, ShieldCheck, ShieldAlert, Map as MapIcon } from "lucide-react";
import { toast } from "sonner";
import WorldActivityMap from "@/components/WorldActivityMap";

const Dashboard = () => {
  const { user, isSuperAdmin, isAdmin } = useAuth();
  const [stats, setStats] = useState({ clients: 0, affiliates: 0, countries: 0, users: 0 });
  const [factors, setFactors] = useState<any[]>([]);
  const [enrolling, setEnrolling] = useState<{ qr: string; secret: string; factorId: string } | null>(null);
  const [otp, setOtp] = useState("");
  const [showMap, setShowMap] = useState(false);

  const loadStats = async () => {
    const [c, a, co, u] = await Promise.all([
      supabase.from("clients").select("id", { count: "exact", head: true }),
      supabase.from("affiliates").select("id", { count: "exact", head: true }),
      supabase.from("countries").select("id", { count: "exact", head: true }),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
    ]);
    setStats({ clients: c.count ?? 0, affiliates: a.count ?? 0, countries: co.count ?? 0, users: u.count ?? 0 });
  };

  const loadFactors = async () => {
    const { data } = await supabase.auth.mfa.listFactors();
    setFactors(data?.totp ?? []);
  };

  useEffect(() => { loadStats(); loadFactors(); }, []);

  const startEnroll = async () => {
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Authenticator" });
    if (error) { toast.error(error.message); return; }
    setEnrolling({ qr: data.totp.qr_code, secret: data.totp.secret, factorId: data.id });
  };

  const verifyEnroll = async () => {
    if (!enrolling) return;
    const { data: ch } = await supabase.auth.mfa.challenge({ factorId: enrolling.factorId });
    if (!ch) return;
    const { error } = await supabase.auth.mfa.verify({ factorId: enrolling.factorId, challengeId: ch.id, code: otp });
    if (error) { toast.error(error.message); return; }
    toast.success("2FA activado");
    setEnrolling(null);
    setOtp("");
    loadFactors();
  };

  const removeFactor = async (id: string) => {
    const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
    if (error) { toast.error(error.message); return; }
    toast.success("2FA desactivado");
    loadFactors();
  };

  const cards = [
    { label: "Clientes", value: stats.clients, icon: Users, color: "text-primary" },
    { label: "Afiliados", value: stats.affiliates, icon: UserPlus, color: "text-success" },
    { label: "Países", value: stats.countries, icon: Globe, color: "text-warning" },
    { label: "Usuarios", value: stats.users, icon: Layers, color: "text-primary-glow" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Bienvenido, {user?.email}</h1>
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
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {factors.length > 0 ? <ShieldCheck className="h-5 w-5 text-success" /> : <ShieldAlert className="h-5 w-5 text-warning" />}
            Autenticación de dos factores (2FA)
          </CardTitle>
          <CardDescription>
            {factors.length > 0 ? "Tu cuenta está protegida con 2FA." : "Agrega una capa extra de seguridad a tu cuenta."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {factors.length === 0 && !enrolling && (
            <Button onClick={startEnroll}>Activar 2FA</Button>
          )}
          {enrolling && (
            <div className="space-y-3">
              <p className="text-sm">Escanea este QR con tu app autenticadora (Google Authenticator, Authy, etc.):</p>
              <img src={enrolling.qr} alt="QR 2FA" className="border rounded" />
              <p className="text-xs text-muted-foreground">O ingresa el código: <code className="font-mono">{enrolling.secret}</code></p>
              <div className="space-y-2 max-w-xs">
                <Label>Código de 6 dígitos</Label>
                <Input value={otp} onChange={(e) => setOtp(e.target.value)} maxLength={6} />
              </div>
              <div className="flex gap-2">
                <Button onClick={verifyEnroll}>Verificar y activar</Button>
                <Button variant="outline" onClick={() => setEnrolling(null)}>Cancelar</Button>
              </div>
            </div>
          )}
          {factors.map((f) => (
            <div key={f.id} className="flex items-center justify-between p-3 rounded-md bg-muted">
              <div>
                <p className="text-sm font-medium">{f.friendly_name || "Authenticator"}</p>
                <p className="text-xs text-muted-foreground">Estado: {f.status}</p>
              </div>
              <Button variant="destructive" size="sm" onClick={() => removeFactor(f.id)}>Desactivar</Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
