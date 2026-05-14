import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
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
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import logo from "@/assets/overoption-logo.png";

type Mode = "login" | "signup" | "forgot" | "reset" | "mfa";

const Auth = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { session } = useAuth();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<Mode>("login");
  const [loading, setLoading] = useState(false);

  const emailSchema = z.string().trim().email(t("auth.invalidEmail")).max(255);
  const passwordSchema = z.string().min(8, t("auth.minPwd")).max(128);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [otp, setOtp] = useState("");
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaChallengeId, setMfaChallengeId] = useState<string | null>(null);

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
      if (!password) throw new Error(t("auth.enterPassword"));
    } catch (err: any) {
      toast.error(err.errors?.[0]?.message ?? err.message);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { toast.error(error.message); setLoading(false); return; }

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
    toast.success(t("auth.signedIn"));
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
    toast.success(t("auth.verified"));
    navigate("/", { replace: true });
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      emailSchema.parse(email);
      passwordSchema.parse(password);
      if (!fullName.trim()) throw new Error(t("auth.enterName"));
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
    toast.success(t("auth.accountCreated"));
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
    toast.success(t("auth.resetSent"));
    setMode("login");
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    try { passwordSchema.parse(password); } catch (err: any) { toast.error(err.errors[0].message); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success(t("auth.passwordUpdated"));
    window.location.hash = "";
    setMode("login");
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative"
         style={{ background: "var(--gradient-brand)" }}>
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <Card className="w-full max-w-md shadow-elegant" style={{ boxShadow: "var(--shadow-elegant)" }}>
        <CardHeader className="space-y-4 items-center text-center">
          <div className="bg-white rounded-lg px-6 py-4 w-full flex justify-center">
            <img src={logo} alt="Overoption" className="h-10 w-auto" />
          </div>
          <div>
            <CardTitle className="text-xl">{t("auth.title")}</CardTitle>
            <CardDescription>
              {mode === "mfa" && t("auth.enterCode")}
              {mode === "reset" && t("auth.setNewPassword")}
              {mode === "forgot" && t("auth.recoverAccess")}
              {(mode === "login" || mode === "signup") && t("auth.accessPanel")}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          {mode === "mfa" && (
            <form onSubmit={handleVerifyMfa} className="space-y-4">
              <div className="flex justify-center text-primary"><ShieldCheck className="h-10 w-10" /></div>
              <div className="space-y-2">
                <Label>{t("auth.code2fa")}</Label>
                <Input value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="123456" maxLength={6} required />
              </div>
              <Button className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {t("auth.verify")}
              </Button>
            </form>
          )}

          {mode === "reset" && (
            <form onSubmit={handleReset} className="space-y-4">
              <div className="space-y-2">
                <Label>{t("auth.newPassword")}</Label>
                <div className="relative">
                  <Input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required className="pr-10" />
                  <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {t("auth.update")}
              </Button>
            </form>
          )}

          {mode === "forgot" && (
            <form onSubmit={handleForgot} className="space-y-4">
              <div className="space-y-2">
                <Label>{t("auth.emailLabel")}</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <Button className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {t("auth.sendLink")}
              </Button>
              <Button type="button" variant="link" className="w-full" onClick={() => setMode("login")}>
                {t("auth.back")}
              </Button>
            </form>
          )}

          {(mode === "login" || mode === "signup") && (
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">{t("auth.loginTab")}</TabsTrigger>
                <TabsTrigger value="signup">{t("auth.signupTab")}</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>{t("auth.emailLabel")}</Label>
                    <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("auth.passwordLabel")}</Label>
                    <div className="relative">
                      <Input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required className="pr-10" />
                      <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <Button className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {t("auth.signIn")}
                  </Button>
                  <Button type="button" variant="link" className="w-full" onClick={() => setMode("forgot")}>
                    {t("auth.forgot")}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>{t("auth.fullName")}</Label>
                    <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("auth.emailLabel")}</Label>
                    <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("auth.passwordLabel")}</Label>
                    <div className="relative">
                      <Input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required className="pr-10" />
                      <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">{t("auth.minChars")}</p>
                  </div>
                  <Button className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {t("auth.createAccount")}
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
