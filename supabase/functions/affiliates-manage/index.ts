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
  status?: string;
  commission_pct?: number | string | null;
  payment_method?: string | null;
  bank_details?: string | null;
  tax_id?: string | null;
  notes?: string | null;
};

type ChannelLink = { channel_id: string; link?: string | null };

type CommissionPlan = {
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
      const payload = {
        fixed_name: a.fixed_name.trim(),
        alias: a.alias || null,
        email: a.email || null,
        phone: a.phone || null,
        country_id: a.country_id || null,
        status,
        commission_pct: commissionPct,
        payment_method: a.payment_method || null,
        bank_details: a.bank_details || null,
        tax_id: a.tax_id || null,
        notes: a.notes || null,
        brands: Array.isArray((a as any).brands) ? (a as any).brands.filter((b: any) => typeof b === "string") : [],
      };

      let affiliateId = body.id;
      let uniqueId: string | null = null;

      if (body.action === "insert") {
        const inserted = await tx<{ id: string; unique_id: string }[]>`
          insert into public.affiliates (
            fixed_name, alias, email, phone, country_id, status,
            commission_pct, payment_method, bank_details, tax_id, notes, created_by
          ) values (
            ${payload.fixed_name}, ${payload.alias}, ${payload.email}, ${payload.phone}, ${payload.country_id},
            ${payload.status}::affiliate_status, ${payload.commission_pct}, ${payload.payment_method},
            ${payload.bank_details}, ${payload.tax_id}, ${payload.notes}, ${userData.user.id}
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
              alias = ${payload.alias},
              email = ${payload.email},
              phone = ${payload.phone},
              country_id = ${payload.country_id},
              status = ${payload.status}::affiliate_status,
              commission_pct = ${payload.commission_pct},
              payment_method = ${payload.payment_method},
              bank_details = ${payload.bank_details},
              tax_id = ${payload.tax_id},
              notes = ${payload.notes},
              updated_at = now()
            where id = ${affiliateId}
          `;
        } else {
          await tx`
            update public.affiliates set
              alias = ${payload.alias},
              email = ${payload.email},
              phone = ${payload.phone},
              country_id = ${payload.country_id},
              status = ${payload.status}::affiliate_status,
              commission_pct = ${payload.commission_pct},
              payment_method = ${payload.payment_method},
              bank_details = ${payload.bank_details},
              tax_id = ${payload.tax_id},
              notes = ${payload.notes},
              updated_at = now()
            where id = ${affiliateId}
          `;
        }
      }

      const linksMap = new Map<string, string | null>();
      if (Array.isArray(body.channel_links)) {
        for (const cl of body.channel_links) {
          if (cl && typeof cl.channel_id === "string") {
            linksMap.set(cl.channel_id, cl.link?.toString().trim() || null);
          }
        }
      }

      await tx`delete from public.affiliate_channel_links where affiliate_id = ${affiliateId}`;
      if (channelIds.length) {
        const values = channelIds.map((cid) => ({
          affiliate_id: affiliateId!,
          channel_id: cid,
          link: linksMap.get(cid) ?? null,
        }));
        await tx`insert into public.affiliate_channel_links ${tx(values, "affiliate_id", "channel_id", "link")}`;
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