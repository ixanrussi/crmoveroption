import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";

const projectUrl = "https://kcbojpgykpipdgrzyars.supabase.co";
const publishableKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjYm9qcGd5a3BpcGRncnp5YXJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1MTY3OTgsImV4cCI6MjA5MzA5Mjc5OH0.zyU151F6-BuwjseG-o07BfVP5jHkrrVBYJV44vnu1UQ";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type AppRole = "super_admin" | "admin" | "user";

type AffiliatePayload = {
  fixed_name?: string;
  alias?: string | null;
  email?: string | null;
  phone?: string | null;
  country_id?: string | null;
  country_ids?: string[];
  status?: string;
  commission_pct?: number | string | null;
  payment_method?: string | null;
  bank_details?: string | null;
  tax_id?: string | null;
  notes?: string | null;
  avatar_url?: string | null;
};

type ChannelLink = { channel_id: string; link?: string | null };

type CommissionPlan = {
  plan_start_date?: string | null;
  currency?: string | null;
  description?: string | null;
  country_id?: string | null;
  country_ids?: string[];
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
  affiliate?: AffiliatePayload & { brands?: string[] };
  channel_ids?: string[];
  channel_links?: ChannelLink[];
  commission_plans?: CommissionPlan[];
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

    const channelIds = Array.from(new Set(
      Array.isArray(body.channel_ids) ? body.channel_ids.filter((x) => typeof x === "string") : [],
    ));

    const result = await sql.begin(async (tx: any) => {
      await tx`select set_config('request.jwt.claim.sub', ${userData.user.id}, true)`;

      if (body.action === "delete") {
        if (!isSuper) return { response: json(403, { error: "Solo super admin puede eliminar" }) };
        if (!body.id) return { response: json(400, { error: "ID requerido" }) };
        await tx`delete from public.affiliate_channel_links where affiliate_id = ${body.id}`;
        await tx`delete from public.affiliate_commission_plans where affiliate_id = ${body.id}`;
        const deleted = await tx<{ id: string }[]>`delete from public.affiliates where id = ${body.id} returning id`;
        if (deleted.length === 0) return { response: json(404, { error: "No encontrado" }) };
        return { response: json(200, { ok: true }) };
      }

      const a = body.affiliate ?? {};
      if (!a.fixed_name?.trim()) return { response: json(400, { error: "Nombre fijo es requerido" }) };

      const ALLOWED_STATUSES = ["active", "inactive", "pending"];
      const status = a.status && ALLOWED_STATUSES.includes(a.status) ? a.status : "active";
      const commissionPct = Number(a.commission_pct) || 0;
      const affCountryIds = Array.isArray((a as any).country_ids)
        ? (a as any).country_ids.filter((x: any) => typeof x === "string")
        : [];
      const payload = {
        fixed_name: a.fixed_name.trim(),
        alias: a.alias || null,
        email: a.email || null,
        phone: a.phone || null,
        country_id: a.country_id || (affCountryIds[0] ?? null),
        country_ids: affCountryIds,
        status,
        commission_pct: commissionPct,
        payment_method: a.payment_method || null,
        bank_details: a.bank_details || null,
        tax_id: a.tax_id || null,
        notes: a.notes || null,
        avatar_url: (a as any).avatar_url || null,
        fixed_remuneration: (a as any).fixed_remuneration === null || (a as any).fixed_remuneration === undefined || (a as any).fixed_remuneration === "" ? null : Number((a as any).fixed_remuneration),
        fixed_remuneration_currency: (a as any).fixed_remuneration_currency || null,
        fixed_remuneration_min_ftd: (a as any).fixed_remuneration_min_ftd === null || (a as any).fixed_remuneration_min_ftd === undefined || (a as any).fixed_remuneration_min_ftd === "" ? null : Math.trunc(Number((a as any).fixed_remuneration_min_ftd)),
        fixed_remuneration_fallback_cpa: (a as any).fixed_remuneration_fallback_cpa === null || (a as any).fixed_remuneration_fallback_cpa === undefined || (a as any).fixed_remuneration_fallback_cpa === "" ? null : Number((a as any).fixed_remuneration_fallback_cpa),
        fixed_remuneration_fallback_cpa_currency: (a as any).fixed_remuneration_fallback_cpa_currency || null,
        fixed_remuneration_installments: Array.isArray((a as any).fixed_remuneration_installments)
          ? (a as any).fixed_remuneration_installments
              .map((x: any) => ({
                pct: x?.pct === "" || x?.pct == null ? null : Number(x.pct),
                date: x?.date || null,
                description: x?.description || null,
              }))
              .filter((x: any) => x.pct != null || x.date || x.description)
          : [],
        brands: Array.isArray((a as any).brands) ? (a as any).brands.filter((b: any) => typeof b === "string") : [],
        aliases: Array.isArray((a as any).aliases)
          ? (a as any).aliases.map((x: any) => (x ?? "").toString().trim()).filter((x: string) => x.length > 0)
          : [],
      };

      let affiliateId = body.id;
      let uniqueId: string | null = null;

      const excludeId = body.action === "update" ? body.id : null;

      // 1) fixed_name duplicates another affiliate's fixed_name
      const dupAffName = await tx<{ id: string; fixed_name: string }[]>`
        select id, fixed_name from public.affiliates
        where lower(fixed_name) = lower(${payload.fixed_name})
          and (${excludeId}::uuid is null or id <> ${excludeId})
        limit 1
      `;
      if (dupAffName.length) return { response: json(409, {
        error: "Nombre de afiliado duplicado",
        conflict: { kind: "name_equals_name", affiliate_id: dupAffName[0].id, affiliate_name: dupAffName[0].fixed_name },
      }) };

      // 2) fixed_name matches an alias of another affiliate
      const dupNameInAlias = await tx<{ id: string; fixed_name: string }[]>`
        select id, fixed_name from public.affiliates
        where (${excludeId}::uuid is null or id <> ${excludeId})
          and exists (select 1 from unnest(aliases) a where lower(a) = lower(${payload.fixed_name}))
        limit 1
      `;
      if (dupNameInAlias.length) return { response: json(409, {
        error: `Nombre de afiliado existente como alias para ${dupNameInAlias[0].fixed_name}`,
        conflict: { kind: "name_in_aliases", affiliate_id: dupNameInAlias[0].id, affiliate_name: dupNameInAlias[0].fixed_name },
      }) };

      // 3) Any of the proposed aliases matches another affiliate's fixed_name OR another alias
      if (payload.aliases.length > 0) {
        const dupAliasAsName = await tx<{ id: string; fixed_name: string; matched: string }[]>`
          select a.id, a.fixed_name, a.fixed_name as matched
          from public.affiliates a
          where (${excludeId}::uuid is null or a.id <> ${excludeId})
            and lower(a.fixed_name) = any(${payload.aliases.map((x: string) => x.toLowerCase())}::text[])
          limit 1
        `;
        if (dupAliasAsName.length) return { response: json(409, {
          error: `Alias existente como nombre del afiliado ${dupAliasAsName[0].fixed_name}`,
          conflict: { kind: "alias_equals_name", affiliate_id: dupAliasAsName[0].id, affiliate_name: dupAliasAsName[0].fixed_name, alias: dupAliasAsName[0].matched },
        }) };

        const dupAliasInAlias = await tx<{ id: string; fixed_name: string; matched: string }[]>`
          select a.id, a.fixed_name, m.alias as matched
          from public.affiliates a,
               lateral (
                 select x as alias from unnest(a.aliases) x
                 where lower(x) = any(${payload.aliases.map((x: string) => x.toLowerCase())}::text[])
                 limit 1
               ) m
          where (${excludeId}::uuid is null or a.id <> ${excludeId})
          limit 1
        `;
        if (dupAliasInAlias.length) return { response: json(409, {
          error: `Alias existente en afiliado ${dupAliasInAlias[0].fixed_name}`,
          conflict: { kind: "alias_in_aliases", affiliate_id: dupAliasInAlias[0].id, affiliate_name: dupAliasInAlias[0].fixed_name, alias: dupAliasInAlias[0].matched },
        }) };
      }

      const dupCliName = await tx<{ id: string }[]>`
        select id from public.clients where lower(company_name) = lower(${payload.fixed_name}) limit 1
      `;
      if (dupCliName.length) return { response: json(409, { error: "El nombre coincide con un cliente existente" }) };

      const aliasPrimary = payload.aliases[0] ?? payload.alias ?? null;
      if (body.action === "insert") {
        const inserted = await tx<{ id: string; unique_id: string }[]>`
          insert into public.affiliates (
            fixed_name, alias, aliases, email, phone, country_id, country_ids, status,
            commission_pct, payment_method, bank_details, tax_id, notes, brands,
            fixed_remuneration, fixed_remuneration_currency,
            fixed_remuneration_min_ftd, fixed_remuneration_fallback_cpa, fixed_remuneration_fallback_cpa_currency,
            fixed_remuneration_installments, avatar_url, created_by
          ) values (
            ${payload.fixed_name}, ${aliasPrimary}, ${payload.aliases}::text[], ${payload.email}, ${payload.phone}, ${payload.country_id},
            ${payload.country_ids}::uuid[],
            ${payload.status}::affiliate_status, ${payload.commission_pct}, ${payload.payment_method},
            ${payload.bank_details}, ${payload.tax_id}, ${payload.notes}, ${payload.brands},
            ${payload.fixed_remuneration}, ${payload.fixed_remuneration_currency},
            ${payload.fixed_remuneration_min_ftd}, ${payload.fixed_remuneration_fallback_cpa}, ${payload.fixed_remuneration_fallback_cpa_currency},
            ${JSON.stringify(payload.fixed_remuneration_installments)}::jsonb, ${payload.avatar_url}, ${userData.user.id}
          ) returning id, unique_id
        `;
        affiliateId = inserted[0].id;
        uniqueId = inserted[0].unique_id;
      } else {
        if (!affiliateId) return { response: json(400, { error: "ID requerido" }) };
        if (isSuper) {
          await tx`
            update public.affiliates set
              fixed_name = ${payload.fixed_name},
              alias = ${aliasPrimary},
              aliases = ${payload.aliases}::text[],
              email = ${payload.email},
              phone = ${payload.phone},
              country_id = ${payload.country_id},
              country_ids = ${payload.country_ids}::uuid[],
              status = ${payload.status}::affiliate_status,
              commission_pct = ${payload.commission_pct},
              payment_method = ${payload.payment_method},
              bank_details = ${payload.bank_details},
              tax_id = ${payload.tax_id},
              notes = ${payload.notes},
              brands = ${payload.brands},
              fixed_remuneration = ${payload.fixed_remuneration},
              fixed_remuneration_currency = ${payload.fixed_remuneration_currency},
              fixed_remuneration_min_ftd = ${payload.fixed_remuneration_min_ftd},
              fixed_remuneration_fallback_cpa = ${payload.fixed_remuneration_fallback_cpa},
              fixed_remuneration_fallback_cpa_currency = ${payload.fixed_remuneration_fallback_cpa_currency},
              fixed_remuneration_installments = ${JSON.stringify(payload.fixed_remuneration_installments)}::jsonb,
              avatar_url = ${payload.avatar_url},
              updated_at = now()
            where id = ${affiliateId}
          `;
        } else {
          await tx`
            update public.affiliates set
              alias = ${aliasPrimary},
              aliases = ${payload.aliases}::text[],
              email = ${payload.email},
              phone = ${payload.phone},
              country_id = ${payload.country_id},
              country_ids = ${payload.country_ids}::uuid[],
              status = ${payload.status}::affiliate_status,
              commission_pct = ${payload.commission_pct},
              payment_method = ${payload.payment_method},
              bank_details = ${payload.bank_details},
              tax_id = ${payload.tax_id},
              notes = ${payload.notes},
              brands = ${payload.brands},
              fixed_remuneration = ${payload.fixed_remuneration},
              fixed_remuneration_currency = ${payload.fixed_remuneration_currency},
              fixed_remuneration_min_ftd = ${payload.fixed_remuneration_min_ftd},
              fixed_remuneration_fallback_cpa = ${payload.fixed_remuneration_fallback_cpa},
              fixed_remuneration_fallback_cpa_currency = ${payload.fixed_remuneration_fallback_cpa_currency},
              avatar_url = ${payload.avatar_url},
              updated_at = now()
            where id = ${affiliateId}
          `;
        }
      }

      // Build (channel_id, link) rows allowing multiple links per channel.
      const linkRows: { affiliate_id: string; channel_id: string; link: string | null }[] = [];
      const seen = new Set<string>();
      const pushRow = (channel_id: string, link: string | null) => {
        const key = `${channel_id}::${link ?? ""}`;
        if (seen.has(key)) return;
        seen.add(key);
        linkRows.push({ affiliate_id: affiliateId!, channel_id, link });
      };
      if (Array.isArray(body.channel_links)) {
        for (const cl of body.channel_links) {
          if (cl && typeof cl.channel_id === "string") {
            const link = cl.link?.toString().trim() || null;
            pushRow(cl.channel_id, link);
          }
        }
      }
      // Ensure channels selected without any link still create a row.
      for (const cid of channelIds) {
        if (![...seen].some((k) => k.startsWith(`${cid}::`))) {
          pushRow(cid, null);
        }
      }

      await tx`delete from public.affiliate_channel_links where affiliate_id = ${affiliateId}`;
      if (linkRows.length) {
        await tx`insert into public.affiliate_channel_links ${tx(linkRows, "affiliate_id", "channel_id", "link")}`;
      }

      // Replace commission plans
      await tx`delete from public.affiliate_commission_plans where affiliate_id = ${affiliateId}`;
      const plans = Array.isArray(body.commission_plans) ? body.commission_plans : [];
      if (plans.length) {
        const num = (v: any) => (v === null || v === undefined || v === "" ? null : Number(v));
        const intOrNull = (v: any) => (v === null || v === undefined || v === "" ? null : Math.trunc(Number(v)));
        const planValues = plans.map((p: any) => {
          const cIds = Array.isArray(p.country_ids)
            ? p.country_ids.filter((x: any) => typeof x === "string")
            : [];
          return {
            affiliate_id: affiliateId!,
            client_id: p.client_id || null,
            plan_start_date: p.plan_start_date || null,
            currency: p.currency || null,
            description: p.description || null,
            country_id: p.country_id || (cIds[0] ?? null),
            country_ids: cIds,
            brand: p.brand || null,
            baseline: num(p.baseline),
            baseline_currency: p.baseline_currency || null,
            cpa: num(p.cpa),
            cpa_currency: p.cpa_currency || null,
            rev_share_pct: num(p.rev_share_pct),
            cpl: num(p.cpl),
            cpl_currency: p.cpl_currency || null,
            wager: num(p.wager),
            wager_currency: p.wager_currency || null,
            conversion_type: p.conversion_type || null,
            cap: intOrNull(p.cap),
            template_id: p.template_id || null,
            created_by: userData.user.id,
          };
        });
        await tx`insert into public.affiliate_commission_plans ${tx(planValues, "affiliate_id", "client_id", "plan_start_date", "currency", "description", "country_id", "country_ids", "brand", "baseline", "baseline_currency", "cpa", "cpa_currency", "rev_share_pct", "cpl", "cpl_currency", "wager", "wager_currency", "conversion_type", "cap", "template_id", "created_by")}`;
      }

      return { response: json(200, { ok: true, id: affiliateId, unique_id: uniqueId }) };
    });

    return result.response;
  } catch (error) {
    console.error("affiliates-manage error", error);
    const code = (error as { code?: string })?.code;
    let message = "No se pudo completar la operación";
    if (code === "23503") message = "Referencia inválida (país o canal)";
    else if (code === "23505") message = "Registro duplicado";
    else if (error instanceof Error && error.message) message = error.message;
    return json(500, { error: message });
  } finally {
    await sql?.end({ timeout: 1 }).catch(() => undefined);
  }
});