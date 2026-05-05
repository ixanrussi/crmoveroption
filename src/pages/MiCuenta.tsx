import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ShieldCheck, ShieldAlert } from "lucide-react";

export default function MiCuenta() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({ full_name: "", phone: "", job_title: "" });
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data, error } = await supabase.from("profiles").select("full_name, phone, job_title").eq("id", user.id).maybeSingle();
      if (error) toast.error(error.message);
      if (data) setProfile({
        full_name: data.full_name ?? "",
        phone: data.phone ?? "",
        job_title: data.job_title ?? "",
      });
      setLoading(false);
    })();
  }, [user]);

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update(profile).eq("id", user.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Perfil actualizado");
  };

  const changePassword = async () => {
    if (newPassword.length < 6) { toast.error("La contraseña debe tener al menos 6 caracteres"); return; }
    if (newPassword !== confirmPassword) { toast.error("Las contraseñas no coinciden"); return; }
    setChangingPwd(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPwd(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Contraseña actualizada");
      setNewPassword(""); setConfirmPassword("");
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Mi cuenta</h1>
        <p className="text-muted-foreground text-sm">Gestiona tu información personal y seguridad.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Información de perfil</CardTitle>
          <CardDescription>Tu email es <span className="font-medium">{user?.email}</span></CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nombre completo</Label>
            <Input value={profile.full_name} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} disabled={loading} />
          </div>
          <div className="space-y-2">
            <Label>Teléfono</Label>
            <Input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} disabled={loading} />
          </div>
          <div className="space-y-2">
            <Label>Cargo</Label>
            <Input value={profile.job_title} onChange={(e) => setProfile({ ...profile, job_title: e.target.value })} disabled={loading} />
          </div>
          <Button onClick={saveProfile} disabled={saving || loading}>
            {saving ? "Guardando..." : "Guardar cambios"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cambiar contraseña</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nueva contraseña</Label>
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Confirmar contraseña</Label>
            <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>
          <Button onClick={changePassword} disabled={changingPwd}>
            {changingPwd ? "Actualizando..." : "Actualizar contraseña"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
