import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { ShieldCheck, ShieldAlert, Upload, Eye, EyeOff } from "lucide-react";

export default function MiCuenta() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({ first_name: "", last_name: "", phone: "", job_title: "", avatar_url: "" });
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [changingPwd, setChangingPwd] = useState(false);
  const [factors, setFactors] = useState<any[]>([]);
  const [enrolling, setEnrolling] = useState<{ qr: string; secret: string; factorId: string } | null>(null);
  const [otp, setOtp] = useState("");

  const loadFactors = async () => {
    const { data } = await supabase.auth.mfa.listFactors();
    setFactors(data?.totp ?? []);
  };

  useEffect(() => { loadFactors(); }, []);

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
    toast.success(t("myAccount.enabled2fa"));
    setEnrolling(null);
    setOtp("");
    loadFactors();
  };

  const removeFactor = async (id: string) => {
    const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
    if (error) { toast.error(error.message); return; }
    toast.success(t("myAccount.disabled2fa"));
    loadFactors();
  };

  useEffect(() => {
    (async () => {
      if (!user) return;
      setLoading(true);
      const { data, error } = await supabase.from("profiles").select("first_name, last_name, full_name, phone, job_title, avatar_url").eq("id", user.id).maybeSingle();
      if (error) toast.error(error.message);
      if (data) {
        const fn = data.first_name ?? (data.full_name ? data.full_name.split(" ")[0] : "");
        const ln = data.last_name ?? (data.full_name ? data.full_name.split(" ").slice(1).join(" ") : "");
        setProfile({
          first_name: fn ?? "",
          last_name: ln ?? "",
          phone: data.phone ?? "",
          job_title: data.job_title ?? "",
          avatar_url: data.avatar_url ?? "",
        });
      }
      setLoading(false);
    })();
  }, [user]);

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const full_name = `${profile.first_name} ${profile.last_name}`.trim();
    const { error } = await supabase.from("profiles").update({ ...profile, full_name }).eq("id", user.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success(t("myAccount.profileUpdated"));
  };

  const onAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingAvatar(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) { toast.error(upErr.message); setUploadingAvatar(false); return; }
    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    const url = `${pub.publicUrl}?t=${Date.now()}`;
    const { error: updErr } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
    if (updErr) toast.error(updErr.message);
    else { setProfile((p) => ({ ...p, avatar_url: url })); toast.success(t("myAccount.photoUpdated")); }
    setUploadingAvatar(false);
  };

  const changePassword = async () => {
    if (newPassword.length < 6) { toast.error(t("myAccount.pwdMin")); return; }
    if (newPassword !== confirmPassword) { toast.error(t("myAccount.pwdMismatch")); return; }
    setChangingPwd(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPwd(false);
    if (error) toast.error(error.message);
    else {
      toast.success(t("auth.passwordUpdated"));
      setNewPassword(""); setConfirmPassword("");
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">{t("myAccount.title")}</h1>
        <p className="text-muted-foreground text-sm">{t("myAccount.subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("myAccount.profileInfo")}</CardTitle>
          <CardDescription>{t("myAccount.profileDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={profile.avatar_url} alt="Avatar" className="object-cover" />
              <AvatarFallback>{(profile.first_name?.[0] ?? user?.email?.[0] ?? "?").toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onAvatarChange} />
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploadingAvatar}>
                <Upload className="h-4 w-4" /> {uploadingAvatar ? t("common.uploading") : t("myAccount.changePhoto")}
              </Button>
              <p className="text-xs text-muted-foreground mt-1">{t("myAccount.photoHint")}</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t("common.email")}</Label>
            <Input value={user?.email ?? ""} disabled />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("common.name")}</Label>
              <Input value={profile.first_name} onChange={(e) => setProfile({ ...profile, first_name: e.target.value })} disabled={loading} />
            </div>
            <div className="space-y-2">
              <Label>{t("common.lastName")}</Label>
              <Input value={profile.last_name} onChange={(e) => setProfile({ ...profile, last_name: e.target.value })} disabled={loading} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t("common.phone")}</Label>
            <Input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} disabled={loading} />
          </div>
          <div className="space-y-2">
            <Label>{t("common.jobTitle")}</Label>
            <Input value={profile.job_title} onChange={(e) => setProfile({ ...profile, job_title: e.target.value })} disabled={loading} />
          </div>
          <Button onClick={saveProfile} disabled={saving || loading}>
            {saving ? t("common.saving") : t("common.saveChanges")}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("myAccount.changePassword")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t("myAccount.newPassword")}</Label>
            <div className="relative">
              <Input type={showNewPassword ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="pr-10" />
              <button type="button" onClick={() => setShowNewPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t("myAccount.confirmPassword")}</Label>
            <div className="relative">
              <Input type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="pr-10" />
              <button type="button" onClick={() => setShowConfirmPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <Button onClick={changePassword} disabled={changingPwd}>
            {changingPwd ? t("myAccount.updating") : t("myAccount.updatePassword")}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            {factors.length > 0 ? <ShieldCheck className="h-5 w-5 text-success" /> : <ShieldAlert className="h-5 w-5 text-warning" />}
            {t("myAccount.twoFa")}
          </CardTitle>
          <CardDescription>
            {factors.length > 0 ? t("myAccount.twoFaOn") : t("myAccount.twoFaOff")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {factors.length === 0 && !enrolling && (
            <Button onClick={startEnroll}>{t("myAccount.enable2fa")}</Button>
          )}
          {enrolling && (
            <div className="space-y-3">
              <p className="text-sm">{t("myAccount.scanQr")}</p>
              <img src={enrolling.qr} alt="QR 2FA" className="border rounded" />
              <p className="text-xs text-muted-foreground">{t("myAccount.orEnterCode")} <code className="font-mono">{enrolling.secret}</code></p>
              <div className="space-y-2 max-w-xs">
                <Label>{t("myAccount.sixDigitCode")}</Label>
                <Input value={otp} onChange={(e) => setOtp(e.target.value)} maxLength={6} />
              </div>
              <div className="flex gap-2">
                <Button onClick={verifyEnroll}>{t("myAccount.verifyEnable")}</Button>
                <Button variant="outline" onClick={() => setEnrolling(null)}>{t("common.cancel")}</Button>
              </div>
            </div>
          )}
          {factors.map((f) => (
            <div key={f.id} className="flex items-center justify-between p-3 rounded-md bg-muted">
              <div>
                <p className="text-sm font-medium">{f.friendly_name || "Authenticator"}</p>
                <p className="text-xs text-muted-foreground">{t("common.status")}: {f.status}</p>
              </div>
              <Button variant="destructive" size="sm" onClick={() => removeFactor(f.id)}>{t("myAccount.disable2fa")}</Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
