import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";

const projectUrl = "https://kcbojpgykpipdgrzyars.supabase.co";
const publishableKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjYm9qcGd5a3BpcGRncnp5YXJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1MTY3OTgsImV4cCI6MjA5MzA5Mjc5OH0.zyU151F6-BuwjseG-o07BfVP5jHkrrVBYJV44vnu1UQ";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const allowedTables = ["countries", "softwares", "affiliate_channels"] as const;
type ListTable = (typeof allowedTables)[number];
type AppRole = "super_admin" | "admin" | "user";

type RequestBody = {
  action?: "insert" | "delete";
  table?: ListTable;
  id?: string;
  name?: string;
  code?: string;
};

const isAllowedTable = (table: unknown): table is ListTable =>
  typeof table === "string" && allowedTables.includes(table as ListTable);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let sql: any = null;

  try {
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json().catch(() => ({}))) as RequestBody;
    if (!isAllowedTable(body.table) || (body.action !== "insert" && body.action !== "delete")) {
      return new Response(JSON.stringify({ error: "Solicitud inválida" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? projectUrl;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? publishableKey;
    const dbUrl = Deno.env.get("SUPABASE_DB_URL");
    if (!dbUrl) throw new Error("Backend de listas no configurado");

    const authClient = createClient(supabaseUrl, anonKey);
    const { data: userData, error: userError } = await authClient.auth.getUser(token);
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Sesión inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    sql = postgres(dbUrl, { prepare: false, max: 1 });
    const roles = await sql<{ role: AppRole }[]>`
      select role::text as role
      from public.user_roles
      where user_id = ${userData.user.id}
    `;
    const canWrite = roles.some((item) => item.role === "admin" || item.role === "super_admin");
    if (!canWrite) {
      return new Response(JSON.stringify({ error: "Acceso denegado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.action === "insert") {
      const name = body.name?.trim();
      if (!name) {
        return new Response(JSON.stringify({ error: "El nombre es obligatorio" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (body.table === "countries") {
        await sql`insert into public.countries (name, code) values (${name}, ${body.code?.trim() || null})`;
      } else if (body.table === "softwares") {
        await sql`insert into public.softwares (name) values (${name})`;
      } else {
        await sql`insert into public.affiliate_channels (name) values (${name})`;
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!body.id) {
      return new Response(JSON.stringify({ error: "ID inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let deleted: { id: string }[] = [];
    if (body.table === "countries") {
      deleted = await sql<{ id: string }[]>`delete from public.countries where id = ${body.id} returning id`;
    } else if (body.table === "softwares") {
      deleted = await sql<{ id: string }[]>`delete from public.softwares where id = ${body.id} returning id`;
    } else {
      deleted = await sql<{ id: string }[]>`delete from public.affiliate_channels where id = ${body.id} returning id`;
    }

    if (deleted.length === 0) {
      return new Response(JSON.stringify({ error: "No se encontró el registro" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("simple-list-items error", error);
    const message = (error as { code?: string })?.code === "23503" || (error instanceof Error && error.message.includes("foreign key"))
      ? "No se puede eliminar porque el registro está en uso"
      : "No se pudo completar la operación";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } finally {
    await sql?.end({ timeout: 1 }).catch(() => undefined);
  }
});
