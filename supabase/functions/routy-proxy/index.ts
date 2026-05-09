const ROUTY_TOKEN = Deno.env.get("ROUTY_TOKEN") ?? "";
const ROUTY_BASE_URL = "https://public-api.routy.app";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Map Routy eventType -> horizontal column key
const EVENT_TYPE_MAP: Record<string, string> = {
  Visits: "visits",
  Signups: "signups",
  FirstTimeDeposits: "firstTimeDeposits",
  DepositAmount: "depositAmount",
  NetRevenue: "netRevenue",
  Earning: "earning",
  CPACommission: "cpaCommission",
  RevShareCommission: "revShareCommission",
  CpaCount: "cpaCount",
};

const METRIC_KEYS = Object.values(EVENT_TYPE_MAP);

type VerticalRow = {
  tracker?: string;
  trackerId?: string | number;
  accountTrackerId?: string | number;
  brand?: string;
  brandId?: string | number;
  country?: string;
  countryCode?: string;
  accountId?: string | number;
  date?: string;
  eventTypeId?: number;
  eventType?: string;
  value?: number;
  currencyCode?: string;
  updatedAt?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    let body: any = {};
    try { body = await req.json(); } catch { body = {}; }
    const { from, to, offset = 0, limit = 5000, accountId, updatedAt } = body || {};

    const now = new Date();
    const defaultTo = new Date(now);
    defaultTo.setUTCHours(23, 59, 59, 999);
    const defaultFrom = new Date(defaultTo);
    defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 7);

    const fromValue = from || defaultFrom.toISOString().slice(0, 19);
    const toValue = to || defaultTo.toISOString().slice(0, 19);

    const params = new URLSearchParams({
      from: fromValue,
      to: toValue,
      offset: String(offset),
      limit: String(limit),
    });
    if (accountId) params.append("accountId", String(accountId));
    if (updatedAt) params.append("updatedAt", String(updatedAt));

    const url = `${ROUTY_BASE_URL}/accounts/stats/trackers?${params}`;

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
        error: "Failed to fetch trackers from Routy API",
        details: `Status ${res.status}: ${res.statusText}${text ? ` - ${text}` : ""}`,
      }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let json: any = {};
    try { json = text ? JSON.parse(text) : {}; } catch { json = {}; }

    const verticalData: VerticalRow[] = Array.isArray(json?.data) ? json.data : [];

    // Pivot vertical -> horizontal
    // Group by date | accountId | accountTrackerId | tracker | brandId
    const groups = new Map<string, any>();
    for (const r of verticalData) {
      const key = [
        r.date ?? "",
        r.accountId ?? "",
        r.accountTrackerId ?? "",
        r.tracker ?? "",
        r.brandId ?? "",
      ].join("|");

      let row = groups.get(key);
      if (!row) {
        row = {
          date: r.date ?? "",
          accountId: r.accountId != null ? String(r.accountId) : "",
          accountTrackerId: r.accountTrackerId != null ? String(r.accountTrackerId) : "",
          tracker: r.tracker ?? "",
          trackerValue: r.tracker ?? "",
          trackerId: r.trackerId != null ? String(r.trackerId) : "",
          brand: r.brand ?? "",
          brandId: r.brandId != null ? String(r.brandId) : "",
          country: r.country ?? "",
          countryCode: r.countryCode ?? "",
          region: "",
          currencyCode: r.currencyCode ?? "",
          updatedAt: r.updatedAt ?? "",
        };
        for (const k of METRIC_KEYS) row[k] = 0;
        // legacy fields kept for UI compatibility
        row.downloads = 0;
        row.withdrawalAmount = 0;
        row.calculatedCommission = 0;
        groups.set(key, row);
      }

      const col = EVENT_TYPE_MAP[r.eventType ?? ""];
      if (col) {
        row[col] = (Number(row[col]) || 0) + (Number(r.value) || 0);
      }
      // Keep most recent updatedAt
      if (r.updatedAt && (!row.updatedAt || r.updatedAt > row.updatedAt)) {
        row.updatedAt = r.updatedAt;
      }
    }

    const data = Array.from(groups.values());

    return new Response(JSON.stringify({
      success: true,
      total: json?.total ?? data.length,
      pageSize: json?.pageSize ?? data.length,
      data,
    }), {
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
