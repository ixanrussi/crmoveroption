import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const projectUrl = "https://kcbojpgykpipdgrzyars.supabase.co";
const publishableKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjYm9qcGd5a3BpcGRncnp5YXJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1MTY3OTgsImV4cCI6MjA5MzA5Mjc5OH0.zyU151F6-BuwjseG-o07BfVP5jHkrrVBYJV44vnu1UQ";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type AppRole = "super_admin" | "admin" | "user" | "comercial";

type Profile = {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  job_title: string | null;
  created_at: string;
  is_active: boolean;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "").trim();
    if (!token) return json({ error: "No autorizado" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? projectUrl;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? publishableKey;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceRoleKey) throw new Error("Backend admin no configurado");

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    const callerId = claimsData?.claims?.sub as string | undefined;
    if (claimsError || !callerId) return json({ error: "Sesión inválida" }, 401);

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: myRoles, error: roleError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId);
    if (roleError) throw roleError;

    const isSuperAdmin = myRoles?.some((item) => item.role === "super_admin");
    if (!isSuperAdmin) return json({ error: "Acceso denegado" }, 403);

    let action = "list";
    let payload: Record<string, unknown> = {};
    if (req.method === "POST") {
      try {
        const body = await req.json();
        action = (body?.action as string) ?? "list";
        payload = body ?? {};
      } catch {
        // ignore
      }
    }

    if (action === "update") {
      const { userId, full_name, job_title, phone, email } = payload as {
        userId?: string; full_name?: string; job_title?: string | null;
        phone?: string | null; email?: string;
      };
      if (!userId) return json({ error: "userId requerido" }, 400);

      const updates: Record<string, unknown> = {};
      if (typeof full_name === "string") updates.full_name = full_name;
      if (job_title !== undefined) updates.job_title = job_title;
      if (phone !== undefined) updates.phone = phone;
      if (typeof email === "string" && email.length > 0) updates.email = email;

      if (Object.keys(updates).length > 0) {
        const { error: upErr } = await adminClient.from("profiles").update(updates).eq("id", userId);
        if (upErr) throw upErr;
      }

      if (typeof email === "string" && email.length > 0) {
        const { error: authErr } = await adminClient.auth.admin.updateUserById(userId, { email });
        if (authErr) throw authErr;
      }
      return json({ ok: true });
    }

    if (action === "delete") {
      const { userId } = payload as { userId?: string };
      if (!userId) return json({ error: "userId requerido" }, 400);
      if (userId === callerId) return json({ error: "No puedes eliminarte a ti mismo" }, 400);

      const { error: delErr } = await adminClient.auth.admin.deleteUser(userId);
      if (delErr) throw delErr;
      // profiles row cascades via auth, but ensure cleanup
      await adminClient.from("user_roles").delete().eq("user_id", userId);
      await adminClient.from("profiles").delete().eq("id", userId);
      return json({ ok: true });
    }

    const [profilesResult, rolesResult] = await Promise.all([
      adminClient.from("profiles").select("id,email,full_name,phone,avatar_url,job_title,created_at,is_active").order("created_at"),
      adminClient.from("user_roles").select("user_id,role"),
    ]);

    if (profilesResult.error) throw profilesResult.error;
    if (rolesResult.error) throw rolesResult.error;

    const users = ((profilesResult.data ?? []) as Profile[]).map((profile) => ({
      ...profile,
      roles: (rolesResult.data ?? [])
        .filter((role) => role.user_id === profile.id)
        .map((role) => role.role as AppRole),
    }));

    return json({ users });
  } catch (error) {
    console.error("admin-users error", error);
    const message = error instanceof Error ? error.message : "Error interno";
    return json({ error: message }, 500);
  }
});
