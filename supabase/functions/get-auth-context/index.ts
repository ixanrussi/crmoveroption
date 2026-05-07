import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";

const projectUrl = "https://kcbojpgykpipdgrzyars.supabase.co";
const publishableKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjYm9qcGd5a3BpcGRncnp5YXJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1MTY3OTgsImV4cCI6MjA5MzA5Mjc5OH0.zyU151F6-BuwjseG-o07BfVP5jHkrrVBYJV44vnu1UQ";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type AppRole = "super_admin" | "admin" | "user";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();

    if (!token) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? projectUrl;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? publishableKey;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const dbUrl = Deno.env.get("SUPABASE_DB_URL");

    if (!supabaseUrl || !anonKey) {
      throw new Error("Configuración del backend incompleta");
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    const userId = claimsData?.claims?.sub as string | undefined;

    if (claimsError || !userId) {
      console.error("get-auth-context claims error", claimsError);
      return new Response(JSON.stringify({ error: "Sesión inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userData = { user: { id: userId } };

    let roles: AppRole[] = [];
    let isActive = false;

    if (serviceRoleKey) {
      const adminClient = createClient(supabaseUrl, serviceRoleKey);
      const [rolesRes, profileRes] = await Promise.all([
        adminClient.from("user_roles").select("role").eq("user_id", userData.user.id).order("role", { ascending: true }),
        adminClient.from("profiles").select("is_active").eq("id", userData.user.id).maybeSingle(),
      ]);
      if (rolesRes.error) throw rolesRes.error;
      roles = rolesRes.data?.map((row) => row.role as AppRole) ?? [];
      isActive = !!profileRes.data?.is_active;
    } else if (dbUrl) {
      const sql = postgres(dbUrl, { prepare: false, max: 1 });
      const rows = await sql<{ role: AppRole }[]>`
        select role::text as role
        from public.user_roles
        where user_id = ${userData.user.id}
        order by case role::text
          when 'super_admin' then 1
          when 'admin' then 2
          else 3
        end
      `;
      const profileRows = await sql<{ is_active: boolean }[]>`
        select is_active from public.profiles where id = ${userData.user.id} limit 1
      `;
      await sql.end({ timeout: 1 });
      roles = rows.map((row) => row.role);
      isActive = !!profileRows[0]?.is_active;
    } else {
      throw new Error("No hay acceso backend para roles");
    }

    return new Response(JSON.stringify({ roles, isActive }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("get-auth-context error", error);
    return new Response(JSON.stringify({ error: "No se pudieron cargar los permisos" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
