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
  country_ids?: string[] | null;
  affiliate_id?: string | null;
  status?: string;
  notes?: string | null;
  login?: string | null;
  senha?: string | null;
  client_type?: string | null;
  brands?: string[] | null;
};

type ContactPayload = {
  name?: string;
  channel?: string;
  contact_id?: string;
  role?: string | null;
};

type CommissionPlanPayload = {
  plan_start_date?: string | null;
  currency?: string | null;
  description?: string | null;
  country_id?: string | null;
  brand?: string | null;
  baseline?: number | string | null;
  cpa?: number | string | null;
  rev_share_pct?: number | string | null;
  cpl?: number | string | null;
  wager?: number | string | null;
  conversion_type?: string | null;
  cap?: number | string | null;
};

type RequestBody = {
  action?: "insert" | "update" | "delete";
  id?: string;
  client?: ClientPayload;
  software_ids?: string[];
  contacts?: ContactPayload[];
  commission_plans?: CommissionPlanPayload[];
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

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    const userId = claimsData?.claims?.sub as string | undefined;
    if (claimsError || !userId) return json(401, { error: "Sesión inválida" });
    const userData = { user: { id: userId } };

    sql = postgres(dbUrl, { prepare: false, max: 1 });
    const roles = await sql<{ role: AppRole }[]>`
      select role::text as role from public.user_roles where user_id = ${userData.user.id}
    `;
    const isAdmin = roles.some((r: { role: AppRole }) => r.role === "admin" || r.role === "super_admin");
    const isSuper = roles.some((r: { role: AppRole }) => r.role === "super_admin");
    if (!isAdmin) return json(403, { error: "Acceso denegado" });

    const softwareIds = Array.isArray(body.software_ids) ? body.software_ids.filter((x) => typeof x === "string") : [];
    const ALLOWED_CHANNELS = ["telegram", "whatsapp", "email", "telefono"];
    const ALLOWED_ROLES = ["team_leader", "account_manager", "financial", "technical"];
    const contacts = Array.isArray(body.contacts)
      ? body.contacts
          .map((ct) => {
            const r = (ct?.role ?? "").toString().trim().toLowerCase();
            return {
              name: (ct?.name ?? "").toString().trim(),
              channel: (ct?.channel ?? "").toString().trim().toLowerCase(),
              contact_id: (ct?.contact_id ?? "").toString().trim(),
              role: ALLOWED_ROLES.includes(r) ? r : null,
            };
          })
          .filter((ct) => ct.name && ct.contact_id && ALLOWED_CHANNELS.includes(ct.channel))
      : [];

    if (body.action === "delete") {
      if (!isSuper) return json(403, { error: "Solo super admin puede eliminar" });
      if (!body.id) return json(400, { error: "ID requerido" });
      await sql`delete from public.client_software_links where client_id = ${body.id}`;
      await sql`delete from public.client_contacts where client_id = ${body.id}`;
      await sql`delete from public.client_commission_plans where client_id = ${body.id}`;
      const deleted = await sql<{ id: string }[]>`delete from public.clients where id = ${body.id} returning id`;
      if (deleted.length === 0) return json(404, { error: "No encontrado" });
      return json(200, { ok: true });
    }

    const c = body.client ?? {};
    if (!c.company_name?.trim()) return json(400, { error: "Empresa requerida" });

    const ALLOWED_TYPES = ["Directo", "Agencia", "Network"];
    const clientType = c.client_type && ALLOWED_TYPES.includes(c.client_type) ? c.client_type : null;
    const brands = Array.isArray(c.brands)
      ? c.brands.map((b) => (b ?? "").toString().trim()).filter((b) => b.length > 0)
      : [];

    const countryIds = Array.isArray(c.country_ids)
      ? c.country_ids.filter((x) => typeof x === "string" && x.length > 0)
      : [];

    const payload = {
      company_name: c.company_name.trim(),
      website: c.website || null,
      address: c.address || null,
      country_id: c.country_id || (countryIds[0] ?? null),
      country_ids: countryIds,
      affiliate_id: c.affiliate_id || null,
      status: c.status || "active",
      notes: c.notes || null,
      login: c.login || null,
      senha: c.senha || null,
      client_type: clientType,
      brands,
    };

    let clientId = body.id;

    // Duplicate validations (case-insensitive). Exclude current row on update.
    const excludeId = body.action === "update" ? body.id : null;

    const dupName = await sql<{ id: string }[]>`
      select id from public.clients
      where lower(company_name) = lower(${payload.company_name})
        and (${excludeId}::uuid is null or id <> ${excludeId})
      limit 1
    `;
    if (dupName.length) return json(409, { error: "Ya existe un cliente con ese nombre" });

    const dupAff = await sql<{ id: string }[]>`
      select id from public.affiliates
      where lower(fixed_name) = lower(${payload.company_name})
      limit 1
    `;
    if (dupAff.length) return json(409, { error: "El nombre coincide con un afiliado existente" });

    if (body.action === "insert") {
      if (payload.website) {
        const dupWeb = await sql<{ id: string }[]>`
          select id from public.clients where lower(website) = lower(${payload.website}) limit 1
        `;
        if (dupWeb.length) return json(409, { error: "Ya existe un cliente con ese sitio web" });
      }
      if (payload.login) {
        const dupLogin = await sql<{ id: string }[]>`
          select id from public.clients where login = ${payload.login} limit 1
        `;
        if (dupLogin.length) return json(409, { error: "Ya existe un cliente con ese login" });
      }
      if (payload.senha) {
        const dupSenha = await sql<{ id: string }[]>`
          select id from public.clients where senha = ${payload.senha} limit 1
        `;
        if (dupSenha.length) return json(409, { error: "Ya existe un cliente con esa contraseña" });
      }
    }

    if (body.action === "insert") {
      const inserted = await sql<{ id: string }[]>`
        insert into public.clients (
          company_name, website, address,
          country_id, country_ids, affiliate_id, status, notes, login, senha, client_type, brands, created_by
        ) values (
          ${payload.company_name},
          ${payload.website}, ${payload.address}, ${payload.country_id}, ${payload.country_ids}::uuid[], ${payload.affiliate_id},
          ${payload.status}::client_status, ${payload.notes}, ${payload.login}, ${payload.senha},
          ${payload.client_type}, ${payload.brands}, ${userData.user.id}
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
          country_ids = ${payload.country_ids}::uuid[],
          affiliate_id = ${payload.affiliate_id},
          status = ${payload.status}::client_status,
          notes = ${payload.notes},
          login = ${payload.login},
          senha = ${payload.senha},
          client_type = ${payload.client_type},
          brands = ${payload.brands},
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

    const ALLOWED_CONV = ["NCO", "NNCO"];
    const num = (v: unknown): number | null => {
      if (v === null || v === undefined || v === "") return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };
    const intOrNull = (v: unknown): number | null => {
      const n = num(v);
      return n === null ? null : Math.trunc(n);
    };
    const plans = Array.isArray(body.commission_plans)
      ? body.commission_plans.map((p) => ({
          plan_start_date: p?.plan_start_date || null,
          currency: (p?.currency ?? "").toString().trim() || null,
          description: (p?.description ?? "").toString().trim() || null,
          country_id: p?.country_id || null,
          brand: (p?.brand ?? "").toString().trim() || null,
          baseline: num(p?.baseline),
          cpa: num(p?.cpa),
          rev_share_pct: num(p?.rev_share_pct),
          cpl: num(p?.cpl),
          wager: num(p?.wager),
          conversion_type: p?.conversion_type && ALLOWED_CONV.includes(p.conversion_type) ? p.conversion_type : null,
          cap: intOrNull(p?.cap),
        }))
      : [];

    await sql`delete from public.client_commission_plans where client_id = ${clientId}`;
    if (plans.length) {
      const values = plans.map((p) => ({ client_id: clientId!, created_by: userData.user.id, ...p }));
      await sql`insert into public.client_commission_plans ${sql(
        values,
        "client_id", "created_by", "plan_start_date", "currency", "description",
        "country_id", "brand", "baseline", "cpa", "rev_share_pct", "cpl", "wager", "conversion_type", "cap"
      )}`;
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
