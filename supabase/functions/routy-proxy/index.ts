const ROUTY_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjIwOTM4NTM3MTMsImlhdCI6MTc3ODIzNDUxMywibmFtZWlkIjoiQUstNjFkMDA3MWQ0MDk0NDUzNiIsInVuaXF1ZV9uYW1lIjoiQ1JNIFRlc3QiLCJBZmZpbGlhdGVJZCI6IjEwNDkwIiwic2NvcGUiOlsiYWRtaW4iLCJzZXJ2aWNlIl0sIm5iZiI6MTc3ODIzNDUxMywiaXNzIjoiaHR0cHM6Ly9sb2NhbGhvc3Q6NDQzMjQvIiwiYXVkIjoiaHR0cHM6Ly9sb2NhbGhvc3Q6NDQzMjQvIn0._usq_2EH1TQbIvQT11FZPWQUpMJNeJ7vgEYUjGhCuLU";
const ROUTY_URL = "https://public-api.routy.app/accounts/stats/trackers/pivot";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.text();
    const res = await fetch(ROUTY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ROUTY_TOKEN}`,
      },
      body: body || "{}",
    });
    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
