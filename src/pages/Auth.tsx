import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, ShieldCheck, Eye, EyeOff } from "lucide-react";
import logo from "@/assets/overoption-logo.png";

const emailSchema = z.string().trim().email("Email inválido").max(255);
const passwordSchema = z.string().min(8, "Mínimo 8 caracteres").max(128);

type Mode = "login" | "signup" | "forgot" | "reset" | "mfa";

const Auth = () => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<Mode>("login");
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [otp, setOtp] = useState("");
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaChallengeId, setMfaChallengeId] = useState<string | null>(null);

  // Detect recovery hash
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) setMode("reset");
  }, []);

  useEffect(() => {
    if (session && mode !== "reset" && mode !== "mfa") navigate("/", { replace: true });
  }, [session, mode, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      emailSchema.parse(email);
      if (!password) throw new Error("Ingresa tu contraseña");
    } catch (err: any) {
      toast.error(err.errors?.[0]?.message ?? err.message);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { toast.error(error.message); setLoading(false); return; }

    // Check if MFA required
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.nextLevel === "aal2" && aal.nextLevel !== aal.currentLevel) {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totp = factors?.totp?.[0];
      if (totp) {
        const { data: ch } = await supabase.auth.mfa.challenge({ factorId: totp.id });
        setMfaFactorId(totp.id);
        setMfaChallengeId(ch?.id ?? null);
        setMode("mfa");
        setLoading(false);
        return;
      }
    }
    toast.success("Sesión iniciada");
    setLoading(false);
  };

  const handleVerifyMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaFactorId || !mfaChallengeId) return;
    setLoading(true);
    const { error } = await supabase.auth.mfa.verify({
      factorId: mfaFactorId, challengeId: mfaChallengeId, code: otp,
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Verificado");
    navigate("/", { replace: true });
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      emailSchema.parse(email);
      passwordSchema.parse(password);
      if (!fullName.trim()) throw new Error("Ingresa tu nombre");
    } catch (err: any) {
      toast.error(err.errors?.[0]?.message ?? err.message);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { full_name: fullName },
      },
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Cuenta creada. Ya puedes iniciar sesión.");
    setMode("login");
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    try { emailSchema.parse(email); } catch (err: any) { toast.error(err.errors[0].message); return; }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth`,
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Revisa tu email para el enlace de recuperación");
    setMode("login");
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    try { passwordSchema.parse(password); } catch (err: any) { toast.error(err.errors[0].message); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Contraseña actualizada");
    window.location.hash = "";
    setMode("login");
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
         style={{ background: "var(--gradient-brand)" }}>
      <Card className="w-full max-w-md shadow-elegant" style={{ boxShadow: "var(--shadow-elegant)" }}>
        <CardHeader className="space-y-4 items-center text-center">
          <div className="bg-white rounded-lg px-6 py-4 w-full flex justify-center">
            <img src={logo} alt="Overoption" className="h-10 w-auto" />
          </div>
          <div>
            <CardTitle className="text-xl">CRM Overoption</CardTitle>
            <CardDescription>
              {mode === "mfa" && "Ingresa tu código de verificación"}
              {mode === "reset" && "Define tu nueva contraseña"}
              {mode === "forgot" && "Recupera tu acceso"}
              {(mode === "login" || mode === "signup") && "Accede a tu panel"}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          {mode === "mfa" && (
            <form onSubmit={handleVerifyMfa} className="space-y-4">
              <div className="flex justify-center text-primary"><ShieldCheck className="h-10 w-10" /></div>
              <div className="space-y-2">
                <Label>Código 2FA</Label>
                <Input value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="123456" maxLength={6} required />
              </div>
              <Button className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Verificar
              </Button>
            </form>
          )}

          {mode === "reset" && (
            <form onSubmit={handleReset} className="space-y-4">
              <div className="space-y-2">
                <Label>Nueva contraseña</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <Button className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Actualizar
              </Button>
            </form>
          )}

          {mode === "forgot" && (
            <form onSubmit={handleForgot} className="space-y-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <Button className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Enviar enlace
              </Button>
              <Button type="button" variant="link" className="w-full" onClick={() => setMode("login")}>
                Volver
              </Button>
            </form>
          )}

          {(mode === "login" || mode === "signup") && (
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Crear cuenta</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Contraseña</Label>
                    <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                  </div>
                  <Button className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Iniciar sesión
                  </Button>
                  <Button type="button" variant="link" className="w-full" onClick={() => setMode("forgot")}>
                    ¿Olvidaste tu contraseña?
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Nombre completo</Label>
                    <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Contraseña</Label>
                    <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                    <p className="text-xs text-muted-foreground">Mínimo 8 caracteres</p>
                  </div>
                  <Button className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Crear cuenta
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
