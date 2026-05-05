import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

type ParsedRow = {
  brand: string;
  campaign_name: string;
  campaign_id: string;
  qualified_players?: number;
  locked_players?: number;
  visits?: number;
  new_accounts?: number;
  active_accounts?: number;
  new_purchasing?: number;
  casino_ngr?: number;
  sports_ngr?: number;
  commission_total: number;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "").trim();
    if (!token) return json(401, { error: "No autorizado" });

    const { storage_path, client_id, period } = await req.json().catch(() => ({}));
    if (!storage_path || !client_id || !period) return json(400, { error: "Parámetros faltantes" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: claims } = await userClient.auth.getClaims(token);
    const userId = claims?.claims?.sub as string | undefined;
    if (!userId) return json(401, { error: "Sesión inválida" });

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userId);
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin" || r.role === "super_admin");
    if (!isAdmin) return json(403, { error: "Acceso denegado" });

    const { data: file, error: dlErr } = await admin.storage.from("commission-reports").download(storage_path);
    if (dlErr || !file) return json(400, { error: `No se pudo leer el PDF: ${dlErr?.message}` });

    const arrayBuf = await file.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuf)));

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          {
            role: "system",
            content:
              "Eres un extractor de datos PRECISO de reportes de comisiones de iGaming (Betway y similares). " +
              "Los reportes están agrupados por BRAND (ej: 'Betway', 'Betway MLT', 'Betway.es', 'Betway.es ES', 'Betway.mx', 'Betway.mx MX'). " +
              "Cada brand tiene una fila de SUBTOTAL (sin Campaign ni Campaign ID, solo agregados) que DEBES IGNORAR. " +
              "También hay una fila de TOTAL GENERAL al final que DEBES IGNORAR. " +
              "Solo extrae filas que tengan un Campaign (nombre de afiliado) Y un Campaign ID válidos. " +
              "\n\nDOS tipos de reporte:\n" +
              "1) CPA: columnas exactas en orden = [Campaign, Campaign ID, Locked Players, Qualified Players, Commission]. " +
              "Mapea: locked_players=Locked Players, qualified_players=Qualified Players, commission_total=Commission. " +
              "NO inventes valores para visits/new_accounts/active_accounts/casino_ngr/sports_ngr (déjalos en 0). \n" +
              "2) Revenue Share (RS): columnas exactas en orden = [Campaign, Campaign ID, Visits, New Open Accounts, Locked Players, Active Accounts, New Active Purchasing, Currency, Casino Net Revenue, Sports Net Revenue, Commission]. " +
              "Mapea ESTRICTAMENTE por posición: visits=Visits, new_accounts=New Open Accounts, locked_players=Locked Players, active_accounts=Active Accounts, new_purchasing=New Active Purchasing, casino_ngr=Casino Net Revenue, sports_ngr=Sports Net Revenue, commission_total=Commission. " +
              "\n\nVALIDACIÓN CRÍTICA: en RS, new_accounts NUNCA puede ser mayor que visits para una fila individual de afiliado. Si lo es, casi seguro confundiste columnas — revísalo. " +
              "Asigna el brand correcto a cada fila según la sección donde aparece. NO uses los valores del subtotal del brand como si fueran de un afiliado.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extrae SOLO las filas de afiliados individuales (con Campaign + Campaign ID). Ignora subtotales por brand y total general. Devuelve report_type ('cpa' o 'revshare'), currency y rows mapeando estrictamente por posición de columna.",
              },
              {
                type: "file",
                file: { filename: "report.pdf", file_data: `data:application/pdf;base64,${base64}` },
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "save_commission_rows",
              description: "Guarda las filas de comisiones extraídas",
              parameters: {
                type: "object",
                properties: {
                  report_type: { type: "string", enum: ["cpa", "revshare"], description: "Tipo de reporte detectado" },
                  currency: { type: "string", description: "Moneda detectada (EUR, USD, MXN…)" },
                  rows: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        brand: { type: "string" },
                        campaign_name: { type: "string" },
                        campaign_id: { type: "string" },
                        qualified_players: { type: "number" },
                        locked_players: { type: "number" },
                        visits: { type: "number" },
                        new_accounts: { type: "number" },
                        active_accounts: { type: "number" },
                        new_purchasing: { type: "number" },
                        casino_ngr: { type: "number" },
                        sports_ngr: { type: "number" },
                        commission_total: { type: "number" },
                      },
                      required: ["brand", "campaign_name", "campaign_id", "commission_total"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["report_type", "rows"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "save_commission_rows" } },
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      if (aiRes.status === 429) return json(429, { error: "Límite de uso de IA excedido, reintenta en un momento" });
      if (aiRes.status === 402) return json(402, { error: "Sin créditos de IA, agrega fondos a tu workspace de Lovable" });
      console.error("AI error", aiRes.status, errText);
      return json(500, { error: "Error al procesar PDF con IA" });
    }
    const aiData = await aiRes.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) return json(500, { error: "La IA no devolvió datos estructurados" });
    const args = JSON.parse(toolCall.function.arguments);
    const rows: ParsedRow[] = args.rows ?? [];
    const detectedCurrency: string | null = args.currency ?? null;
    const reportType: string = args.report_type ?? "cpa";
    const isPaid = reportType === "cpa"; // RS no se paga al afiliado

    if (rows.length === 0) return json(400, { error: "No se detectaron filas en el PDF" });

    const { data: opMap } = await admin
      .from("affiliate_operator_ids")
      .select("affiliate_id, operator_campaign_id")
      .eq("client_id", client_id);
    const idToAff = new Map<string, string>();
    (opMap ?? []).forEach((o: any) => idToAff.set(o.operator_campaign_id.toLowerCase(), o.affiliate_id));

    const { data: affiliates } = await admin.from("affiliates").select("id, fixed_name, alias");
    const aliasToAff = new Map<string, string>();
    (affiliates ?? []).forEach((a: any) => {
      if (a.alias) aliasToAff.set(a.alias.toLowerCase().trim(), a.id);
      if (a.fixed_name) aliasToAff.set(a.fixed_name.toLowerCase().trim(), a.id);
    });

    const sourceName = storage_path.split("/").pop() ?? storage_path;
    const totalCommission = rows.reduce((s, r) => s + (Number(r.commission_total) || 0), 0);
    const totalQualified = rows.reduce((s, r) => s + (Number(r.qualified_players) || 0), 0);
    const totalLocked = rows.reduce((s, r) => s + (Number(r.locked_players) || 0), 0);

    const { data: closure, error: cErr } = await admin
      .from("commission_closures")
      .insert({
        client_id,
        period,
        source_file_path: storage_path,
        source_file_name: sourceName,
        status: "draft",
        currency: detectedCurrency,
        total_commission: totalCommission,
        total_qualified: totalQualified,
        total_locked: totalLocked,
        report_type: reportType,
        created_by: userId,
      })
      .select("id")
      .single();
    if (cErr || !closure) return json(500, { error: cErr?.message ?? "No se pudo crear el cierre" });

    const items = rows.map((r) => {
      const idKey = (r.campaign_id || "").toLowerCase().trim();
      const nameKey = (r.campaign_name || "").toLowerCase().trim();
      let affiliate_id: string | null = null;
      let match_status = "unmatched";
      if (idKey && idToAff.has(idKey)) {
        affiliate_id = idToAff.get(idKey)!;
        match_status = "auto_id";
      } else if (nameKey && aliasToAff.has(nameKey)) {
        affiliate_id = aliasToAff.get(nameKey)!;
        match_status = "auto_alias";
      }
      return {
        closure_id: closure.id,
        affiliate_id,
        raw_campaign_name: r.campaign_name,
        raw_campaign_id: r.campaign_id,
        brand: r.brand,
        report_type: reportType,
        is_paid_to_affiliate: isPaid,
        qualified_players: Math.trunc(Number(r.qualified_players) || 0),
        locked_players: Math.trunc(Number(r.locked_players) || 0),
        visits: Math.trunc(Number(r.visits) || 0),
        new_accounts: Math.trunc(Number(r.new_accounts) || 0),
        active_accounts: Math.trunc(Number(r.active_accounts) || 0),
        new_purchasing: Math.trunc(Number(r.new_purchasing) || 0),
        casino_ngr: Number(r.casino_ngr) || 0,
        sports_ngr: Number(r.sports_ngr) || 0,
        commission_total: Number(r.commission_total) || 0,
        currency: detectedCurrency,
        match_status,
      };
    });

    const { error: itemsErr } = await admin.from("commission_closure_items").insert(items);
    if (itemsErr) {
      await admin.from("commission_closures").delete().eq("id", closure.id);
      return json(500, { error: itemsErr.message });
    }

    return json(200, {
      ok: true,
      closure_id: closure.id,
      report_type: reportType,
      rows_count: items.length,
      matched: items.filter((i) => i.affiliate_id).length,
    });
  } catch (e) {
    console.error("parse-commission-pdf error", e);
    return json(500, { error: e instanceof Error ? e.message : "Error desconocido" });
  }
});
