import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";

const projectUrl = "https://kcbojpgykpipdgrzyars.supabase.co";
const publishableKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjYm9qcGd5a3BpcGRncnp5YXJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1MTY3OTgsImV4cCI6MjA5MzA5Mjc5OH0.zyU151F6-BuwjseG-o07BfVP5jHkrrVBYJV44vnu1UQ";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type AppRole = "super_admin" | "admin" | "user";

type ClientPayload = {
  company_name?: string;
  website?: string | null;
  address?: string | null;
  country_id?: string | null;
  affiliate_id?: string | null;
  status?: string;
  notes?: string | null;
  login?: string | null;
  senha?: string | null;
};

type ContactPayload = {
  name?: string;
  channel?: string;
  contact_id?: string;
};

type RequestBody = {
  action?: "insert" | "update" | "delete";
  id?: string;
  client?: ClientPayload;
  software_ids?: string[];
  contacts?: ContactPayload[];
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let sql: any = null;
  try {
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "").trim();
    if (!token) return json(401, { error: "No autorizado" });

    const body = (await req.json().catch(() => ({}))) as RequestBody;
    if (!body.action || !["insert", "update", "delete"].includes(body.action)) {
      return json(400, { error: "Acción inválida" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? projectUrl;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY") ?? publishableKey;
    const dbUrl = Deno.env.get("SUPABASE_DB_URL");
    if (!dbUrl) throw new Error("Backend no configurado");

    const authClient = createClient(supabaseUrl, anonKey);
    const { data: userData, error: userError } = await authClient.auth.getUser(token);
    if (userError || !userData.user) return json(401, { error: "Sesión inválida" });

    sql = postgres(dbUrl, { prepare: false, max: 1 });
    const roles = await sql<{ role: AppRole }[]>`
      select role::text as role from public.user_roles where user_id = ${userData.user.id}
    `;
    const isAdmin = roles.some((r: { role: AppRole }) => r.role === "admin" || r.role === "super_admin");
    const isSuper = roles.some((r: { role: AppRole }) => r.role === "super_admin");
    if (!isAdmin) return json(403, { error: "Acceso denegado" });

    const softwareIds = Array.isArray(body.software_ids) ? body.software_ids.filter((x) => typeof x === "string") : [];
    const ALLOWED_CHANNELS = ["telegram", "whatsapp", "email", "telefono"];
    const contacts = Array.isArray(body.contacts)
      ? body.contacts
          .map((ct) => ({
            name: (ct?.name ?? "").toString().trim(),
            channel: (ct?.channel ?? "").toString().trim().toLowerCase(),
            contact_id: (ct?.contact_id ?? "").toString().trim(),
          }))
          .filter((ct) => ct.name && ct.contact_id && ALLOWED_CHANNELS.includes(ct.channel))
      : [];

    if (body.action === "delete") {
      if (!isSuper) return json(403, { error: "Solo super admin puede eliminar" });
      if (!body.id) return json(400, { error: "ID requerido" });
      await sql`delete from public.client_software_links where client_id = ${body.id}`;
      await sql`delete from public.client_contacts where client_id = ${body.id}`;
      const deleted = await sql<{ id: string }[]>`delete from public.clients where id = ${body.id} returning id`;
      if (deleted.length === 0) return json(404, { error: "No encontrado" });
      return json(200, { ok: true });
    }

    const c = body.client ?? {};
    if (!c.company_name?.trim()) return json(400, { error: "Empresa requerida" });

    const payload = {
      company_name: c.company_name.trim(),
      website: c.website || null,
      address: c.address || null,
      country_id: c.country_id || null,
      affiliate_id: c.affiliate_id || null,
      status: c.status || "active",
      notes: c.notes || null,
      login: c.login || null,
      senha: c.senha || null,
    };

    let clientId = body.id;

    if (body.action === "insert") {
      const inserted = await sql<{ id: string }[]>`
        insert into public.clients (
          company_name, website, address,
          country_id, affiliate_id, status, notes, login, senha, created_by
        ) values (
          ${payload.company_name},
          ${payload.website}, ${payload.address}, ${payload.country_id}, ${payload.affiliate_id},
          ${payload.status}::client_status, ${payload.notes}, ${payload.login}, ${payload.senha}, ${userData.user.id}
        ) returning id
      `;
      clientId = inserted[0].id;
    } else {
      if (!clientId) return json(400, { error: "ID requerido" });
      await sql`
        update public.clients set
          company_name = ${payload.company_name},
          website = ${payload.website},
          address = ${payload.address},
          country_id = ${payload.country_id},
          affiliate_id = ${payload.affiliate_id},
          status = ${payload.status}::client_status,
          notes = ${payload.notes},
          login = ${payload.login},
          senha = ${payload.senha},
          updated_at = now()
        where id = ${clientId}
      `;
    }

    await sql`delete from public.client_software_links where client_id = ${clientId}`;
    if (softwareIds.length) {
      const values = softwareIds.map((sid) => ({ client_id: clientId!, software_id: sid }));
      await sql`insert into public.client_software_links ${sql(values, "client_id", "software_id")}`;
    }

    await sql`delete from public.client_contacts where client_id = ${clientId}`;
    if (contacts.length) {
      const values = contacts.map((ct) => ({
        client_id: clientId!,
        name: ct.name,
        channel: ct.channel,
        contact_id: ct.contact_id,
      }));
      await sql`insert into public.client_contacts ${sql(values, "client_id", "name", "channel", "contact_id")}`;
    }

    return json(200, { ok: true, id: clientId });
  } catch (error) {
    console.error("clients-manage error", error);
    const code = (error as { code?: string })?.code;
    let message = "No se pudo completar la operación";
    if (code === "23503") message = "Referencia inválida (país, afiliado o software)";
    else if (code === "23505") message = "Registro duplicado";
    else if (error instanceof Error && error.message) message = error.message;
    return json(500, { error: message });
  } finally {
    await sql?.end({ timeout: 1 }).catch(() => undefined);
  }
});
