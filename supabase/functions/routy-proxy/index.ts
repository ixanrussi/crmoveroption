const ROUTY_TOKEN = Deno.env.get("ROUTY_TOKEN") ?? "";
const ROUTY_BASE_URL = "https://public-api.routy.app";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    let body: any = {};
    try { body = await req.json(); } catch { body = {}; }
    const { from, to, offset = 0, limit = 2000, accountId } = body || {};

    const now = new Date();
    const defaultTo = new Date(now);
    defaultTo.setUTCHours(23, 59, 59, 999);
    const defaultFrom = new Date(defaultTo);
    defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 99);

    const fromValue = from || defaultFrom.toISOString().slice(0, 19);
    const toValue = to || defaultTo.toISOString().slice(0, 19);

    const params = new URLSearchParams({
      from: fromValue,
      to: toValue,
      offset: String(offset),
      limit: String(limit),
    });
    if (accountId) params.append("accountId", String(accountId));

    const url = `${ROUTY_BASE_URL}/accounts/stats/trackers/pivot?${params}`;

    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${ROUTY_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    const text = await res.text();
    if (!res.ok) {
      return new Response(JSON.stringify({
        success: false,
        error: "Failed to fetch trackers-pivot from Routy API",
        details: `Status ${res.status}: ${res.statusText}${text ? ` - ${text}` : ""}`,
      }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(text || "{}", {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({
      success: false,
      error: "Routy request failed",
      details: e?.message || String(e),
    }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
