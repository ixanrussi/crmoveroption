import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";

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

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const publishableKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const dbUrl = Deno.env.get("SUPABASE_DB_URL");

    if (!supabaseUrl || !publishableKey || !dbUrl) {
      throw new Error("Configuración del backend incompleta");
    }

    const authClient = createClient(supabaseUrl, publishableKey);
    const { data: userData, error: userError } = await authClient.auth.getUser(token);

    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Sesión inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
    await sql.end({ timeout: 1 });

    const roles = rows.length > 0 ? rows.map((row) => row.role) : ["user"];

    return new Response(JSON.stringify({ roles }), {
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
