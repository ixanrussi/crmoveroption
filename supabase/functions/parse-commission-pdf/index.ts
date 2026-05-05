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
  qualified_players: number;
  locked_players: number;
  commission_total: number;
  currency?: string | null;
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

    // Verify user
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: claims } = await userClient.auth.getClaims(token);
    const userId = claims?.claims?.sub as string | undefined;
    if (!userId) return json(401, { error: "Sesión inválida" });

    const admin = createClient(supabaseUrl, serviceKey);

    // Check admin role
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userId);
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin" || r.role === "super_admin");
    if (!isAdmin) return json(403, { error: "Acceso denegado" });

    // Download PDF
    const { data: file, error: dlErr } = await admin.storage.from("commission-reports").download(storage_path);
    if (dlErr || !file) return json(400, { error: `No se pudo leer el PDF: ${dlErr?.message}` });

    const arrayBuf = await file.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuf)));

    // Send PDF to Lovable AI with tool calling for structured extraction
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "Eres un extractor de datos de reportes de comisiones de operadores de iGaming. Extrae cada fila como objeto separado, manteniendo la marca (Brand) a la que pertenece. Ignora filas de totales o subtotales.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extrae todas las filas de comisiones del reporte adjunto. Para cada fila identifica: brand (ej Betway MLT, Betway.es ES, Betway.mx MX), campaign (nombre del afiliado), campaign_id, qualified_players, locked_players y commission. Devuelve también la moneda si la detectas.",
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
                        commission_total: { type: "number" },
                      },
                      required: ["brand", "campaign_name", "campaign_id", "qualified_players", "locked_players", "commission_total"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["rows"],
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

    if (rows.length === 0) return json(400, { error: "No se detectaron filas en el PDF" });

    // Match affiliates: by operator_campaign_id (priority) then alias/fixed_name
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

    // Create closure
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
        created_by: userId,
      })
      .select("id")
      .single();
    if (cErr || !closure) return json(500, { error: cErr?.message ?? "No se pudo crear el cierre" });

    // Auto-create operator_id mappings for new IDs we matched by alias
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
        qualified_players: Math.trunc(Number(r.qualified_players) || 0),
        locked_players: Math.trunc(Number(r.locked_players) || 0),
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
      rows_count: items.length,
      matched: items.filter((i) => i.affiliate_id).length,
    });
  } catch (e) {
    console.error("parse-commission-pdf error", e);
    return json(500, { error: e instanceof Error ? e.message : "Error desconocido" });
  }
});
