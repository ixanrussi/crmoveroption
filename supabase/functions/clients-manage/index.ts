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
  brand_aliases?: Record<string, string[]> | null;
  net_min_cpa?: number | string | null;
  logo_url?: string | null;
  routy_account_id?: string | null;
  ext_id_oo?: string | null;
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
  country_ids?: string[] | null;
  brand?: string | null;
  baseline?: number | string | null;
  baseline_currency?: string | null;
  cpa?: number | string | null;
  cpa_currency?: string | null;
  rev_share_pct?: number | string | null;
  cpl?: number | string | null;
  cpl_currency?: string | null;
  wager?: number | string | null;
  wager_currency?: string | null;
  conversion_type?: string | null;
  cap?: number | string | null;
  overoption_retention?: number | string | null;
  fallback_cpa?: number | string | null;
  cpa_at_80?: number | string | null;
  cpa_at_90?: number | string | null;
  proportional_enabled?: boolean | null;
  proportional_min_pct?: number | string | null;
  fixed_margin_pct?: number | string | null;
  recommended_margin_pct?: number | string | null;
  fixed_remuneration?: number | string | null;
  fixed_remuneration_currency?: string | null;
  fixed_remuneration_min_ftd?: number | string | null;
  fixed_remuneration_fallback_cpa?: number | string | null;
  fixed_remuneration_fallback_cpa_currency?: string | null;
  fixed_remuneration_installments?: Array<{ pct?: number | string; date?: string; description?: string }> | null;
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
    const brandAliases: Record<string, string[]> = {};
    if (c.brand_aliases && typeof c.brand_aliases === "object") {
      for (const [k, v] of Object.entries(c.brand_aliases)) {
        const key = (k ?? "").toString().trim();
        if (!key) continue;
        const arr = Array.isArray(v)
          ? Array.from(new Set(v.map((x) => (x ?? "").toString().trim()).filter((x) => x.length > 0)))
          : [];
        brandAliases[key] = arr;
      }
    }

    const countryIds = Array.isArray(c.country_ids)
      ? c.country_ids.filter((x) => typeof x === "string" && x.length > 0)
      : [];

    const numTop = (v: unknown): number | null => {
      if (v === null || v === undefined || v === "") return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };
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
      brand_aliases: brandAliases,
      net_min_cpa: numTop(c.net_min_cpa),
      logo_url: c.logo_url || null,
      routy_account_id: (c.routy_account_id ?? "").toString().trim() || null,
      ext_id_oo: (c.ext_id_oo ?? "").toString().trim() || null,
    };

    let clientId = body.id;

    {
      const excludeId = body.action === "update" ? body.id ?? null : null;
      const dupName = await sql<{ id: string }[]>`
        select id from public.clients
        where lower(company_name) = lower(${payload.company_name})
          and (${excludeId}::uuid is null or id <> ${excludeId})
        limit 1
      `;
      if (dupName.length) return json(409, { error: "Ya existe un operador con ese nombre" });

      const dupAff = await sql<{ id: string }[]>`
        select id from public.affiliates where lower(fixed_name) = lower(${payload.company_name}) limit 1
      `;
      if (dupAff.length) return json(409, { error: "El nombre coincide con un afiliado existente" });
    }

    if (body.action === "insert") {
      const inserted = await sql<{ id: string }[]>`
        insert into public.clients (
          company_name, website, address,
          country_id, country_ids, affiliate_id, status, notes, login, senha, client_type, brands, brand_aliases, net_min_cpa, logo_url, routy_account_id, ext_id_oo, created_by
        ) values (
          ${payload.company_name},
          ${payload.website}, ${payload.address}, ${payload.country_id}, ${payload.country_ids}::uuid[], ${payload.affiliate_id},
          ${payload.status}::client_status, ${payload.notes}, ${payload.login}, ${payload.senha},
          ${payload.client_type}, ${payload.brands}, ${JSON.stringify(payload.brand_aliases)}::jsonb, ${payload.net_min_cpa}, ${payload.logo_url}, ${payload.routy_account_id}, ${payload.ext_id_oo}, ${userData.user.id}
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
          net_min_cpa = ${payload.net_min_cpa},
          logo_url = ${payload.logo_url},
          routy_account_id = ${payload.routy_account_id},
          ext_id_oo = ${payload.ext_id_oo},
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
        role: ct.role,
      }));
      await sql`insert into public.client_contacts ${sql(values, "client_id", "name", "channel", "contact_id", "role")}`;
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
      ? body.commission_plans.map((p) => {
          const cids = Array.isArray(p?.country_ids)
            ? p!.country_ids!.filter((x): x is string => typeof x === "string" && x.length > 0)
            : [];
          const installments = Array.isArray(p?.fixed_remuneration_installments)
            ? p!.fixed_remuneration_installments!
                .map((it) => ({
                  pct: num(it?.pct) ?? 0,
                  date: (it?.date ?? "").toString().trim() || null,
                  description: (it?.description ?? "").toString().trim() || null,
                }))
                .filter((it) => it.pct > 0 || it.date || it.description)
            : [];
          return {
            plan_start_date: p?.plan_start_date || null,
            currency: (p?.currency ?? "").toString().trim() || null,
            description: (p?.description ?? "").toString().trim() || null,
            country_id: (cids[0] ?? p?.country_id) || null,
            country_ids: cids,
            brand: (p?.brand ?? "").toString().trim() || null,
            baseline: num(p?.baseline),
            baseline_currency: (p?.baseline_currency ?? "").toString().trim() || null,
            cpa: num(p?.cpa),
            cpa_currency: (p?.cpa_currency ?? "").toString().trim() || null,
            rev_share_pct: num(p?.rev_share_pct),
            cpl: num(p?.cpl),
            cpl_currency: (p?.cpl_currency ?? "").toString().trim() || null,
            wager: num(p?.wager),
            wager_currency: (p?.wager_currency ?? "").toString().trim() || null,
            conversion_type: p?.conversion_type && ALLOWED_CONV.includes(p.conversion_type) ? p.conversion_type : null,
            cap: intOrNull(p?.cap),
            overoption_retention: num(p?.overoption_retention),
            fallback_cpa: num(p?.fallback_cpa),
            cpa_at_80: num(p?.cpa_at_80),
            cpa_at_90: num(p?.cpa_at_90),
            proportional_enabled: !!p?.proportional_enabled,
            proportional_min_pct: num(p?.proportional_min_pct),
            fixed_margin_pct: num(p?.fixed_margin_pct),
            recommended_margin_pct: num(p?.recommended_margin_pct),
            fixed_remuneration: num(p?.fixed_remuneration),
            fixed_remuneration_currency: (p?.fixed_remuneration_currency ?? "").toString().trim() || null,
            fixed_remuneration_min_ftd: intOrNull(p?.fixed_remuneration_min_ftd),
            fixed_remuneration_fallback_cpa: num(p?.fixed_remuneration_fallback_cpa),
            fixed_remuneration_fallback_cpa_currency: (p?.fixed_remuneration_fallback_cpa_currency ?? "").toString().trim() || null,
            fixed_remuneration_installments: installments,
          };
        })
      : [];

    await sql`delete from public.client_commission_plans where client_id = ${clientId}`;
    if (plans.length) {
      for (const p of plans) {
        await sql`
          insert into public.client_commission_plans (
            client_id, created_by, plan_start_date, currency, description,
            country_id, country_ids, brand, baseline, baseline_currency, cpa, cpa_currency,
            rev_share_pct, cpl, cpl_currency, wager, wager_currency, conversion_type, cap,
            overoption_retention, fallback_cpa, cpa_at_80, cpa_at_90,
            proportional_enabled, proportional_min_pct, fixed_margin_pct, recommended_margin_pct,
            fixed_remuneration, fixed_remuneration_currency, fixed_remuneration_min_ftd,
            fixed_remuneration_fallback_cpa, fixed_remuneration_fallback_cpa_currency,
            fixed_remuneration_installments
          ) values (
            ${clientId}, ${userData.user.id}, ${p.plan_start_date}, ${p.currency}, ${p.description},
            ${p.country_id}, ${p.country_ids}::uuid[], ${p.brand}, ${p.baseline}, ${p.baseline_currency}, ${p.cpa}, ${p.cpa_currency},
            ${p.rev_share_pct}, ${p.cpl}, ${p.cpl_currency}, ${p.wager}, ${p.wager_currency}, ${p.conversion_type}, ${p.cap},
            ${p.overoption_retention}, ${p.fallback_cpa}, ${p.cpa_at_80}, ${p.cpa_at_90},
            ${p.proportional_enabled}, ${p.proportional_min_pct}, ${p.fixed_margin_pct}, ${p.recommended_margin_pct},
            ${p.fixed_remuneration}, ${p.fixed_remuneration_currency}, ${p.fixed_remuneration_min_ftd},
            ${p.fixed_remuneration_fallback_cpa}, ${p.fixed_remuneration_fallback_cpa_currency},
            ${sql.json(p.fixed_remuneration_installments)}
          )
        `;
      }
    }

    // Automation: on operator creation, auto-generate affiliate commission plan
    // templates with CPA = 70% of the operator's CPA. Only runs on insert and
    // only for plans that actually have a CPA defined.
    if (body.action === "insert" && plans.length) {
      const tplRows = plans
        .filter((p) => p.cpa !== null && p.cpa !== undefined)
        .map((p) => {
          const affCpa = Math.round(((Number(p.cpa) || 0) * 0.7) * 100) / 100;
          const namePieces = [payload.company_name, p.brand].filter(Boolean).join(" · ");
          return {
            client_id: clientId!,
            created_by: userData.user.id,
            name: `${namePieces} — Afiliado 70% CPA`,
            description: "Generado automáticamente al crear el operador (CPA afiliado = 70% del CPA total).",
            plan_start_date: p.plan_start_date,
            currency: p.currency,
            country_ids: p.country_ids,
            brand: p.brand,
            baseline: p.baseline,
            baseline_currency: p.baseline_currency || p.currency,
            cpa: affCpa,
            cpa_currency: p.cpa_currency || p.currency,
          };
        });
      if (tplRows.length) {
        await sql`insert into public.commission_plan_templates ${sql(
          tplRows,
          "client_id", "created_by", "name", "description", "plan_start_date", "currency",
          "country_ids", "brand", "baseline", "baseline_currency", "cpa", "cpa_currency"
        )}`;
      }
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
