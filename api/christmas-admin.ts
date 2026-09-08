import type { VercelRequest, VercelResponse } from "@vercel/node";
import { christmasSignupCsv, type ChristmasSignupCsvRow } from "../src/features/christmas-countdown/csv";
import { publicConfigFromUnknown } from "../src/features/christmas-countdown/defaults";

function asString(value: unknown): string {
  return String(value ?? "").trim();
}

function isYmd(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function rangeFromBody(body: Record<string, unknown>) {
  const from = isYmd(asString(body.from)) ? asString(body.from) : new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
  const to = isYmd(asString(body.to)) ? asString(body.to) : new Date().toISOString().slice(0, 10);
  const start = from <= to ? from : to;
  const end = from <= to ? to : from;
  return { from: start, to: end, fromIso: `${start}T00:00:00.000Z`, toIso: `${end}T23:59:59.999Z` };
}

function restHeaders(serviceKey: string, extra?: Record<string, string>) {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
    ...(extra || {}),
  };
}

async function loadFirstPartyKpis(
  supabaseUrl: string,
  serviceKey: string,
  range: { fromIso: string; toIso: string },
  year: number,
) {
  const rpc = await fetch(`${supabaseUrl}/rest/v1/rpc/admin_christmas_countdown_kpis`, {
    method: "POST",
    headers: restHeaders(serviceKey),
    body: JSON.stringify({ p_from: range.fromIso, p_to: range.toIso, p_campaign_year: year }),
  });
  if (rpc.ok) {
    const json = (await rpc.json()) as Record<string, unknown>;
    if (json && typeof json === "object" && json.signups_total != null) {
      return { data: json, error: null as string | null };
    }
  }

  const signupsRes = await fetch(
    `${supabaseUrl}/rest/v1/christmas_countdown_signups?select=signup_method,created_at,last_seen_at&campaign_year=eq.${year}&created_at=gte.${range.fromIso}&created_at=lte.${range.toIso}`,
    { headers: restHeaders(serviceKey) },
  );
  if (!signupsRes.ok) {
    const body = await signupsRes.text();
    return {
      data: null as null,
      error: /forbidden/i.test(body) ? "Signup metrics could not be loaded." : `Signup query failed (${signupsRes.status})`,
    };
  }
  const signups = (await signupsRes.json()) as Array<{ signup_method?: string; created_at?: string; last_seen_at?: string }>;
  const eventsRes = await fetch(
    `${supabaseUrl}/rest/v1/christmas_funnel_events?select=event_name,funnel_session_id,pathname&created_at=gte.${range.fromIso}&created_at=lte.${range.toIso}&is_test=eq.false`,
    { headers: restHeaders(serviceKey) },
  );
  const events = eventsRes.ok
    ? ((await eventsRes.json()) as Array<{ event_name?: string; funnel_session_id?: string; pathname?: string }>)
    : [];

  const sessionIds = (eventName: string, christmasOnly = false) => {
    const ids = new Set<string>();
    for (const row of events) {
      if (row.event_name !== eventName) continue;
      if (christmasOnly) {
        const path = String(row.pathname || "");
        if (path !== "/christmas" && path !== "/christmas/") continue;
      }
      if (row.funnel_session_id) ids.add(row.funnel_session_id);
    }
    return ids.size;
  };

  return {
    data: {
      signups_total: signups.length,
      signups_email: signups.filter((row) => row.signup_method === "email").length,
      signups_google: signups.filter((row) => row.signup_method === "google").length,
      signups_returning: signups.filter((row) => {
        const created = Date.parse(String(row.created_at || ""));
        const seen = Date.parse(String(row.last_seen_at || ""));
        return Number.isFinite(created) && Number.isFinite(seen) && seen - created > 12 * 60 * 60 * 1000;
      }).length,
      first_party_page_view_sessions: sessionIds("christmas_page_view", true),
      join_started_sessions: sessionIds("christmas_join_started"),
      join_completed_sessions: sessionIds("christmas_join_completed"),
      google_auth_started_sessions: sessionIds("christmas_google_auth_started"),
      google_auth_completed_sessions: sessionIds("christmas_google_auth_completed"),
      return_visit_sessions: sessionIds("christmas_return_visit"),
    },
    error: null as string | null,
  };
}

async function assertAdminFromRequest(req: VercelRequest, supabaseUrl: string, serviceKey: string, anonKey: string) {
  const auth = asString(req.headers.authorization);
  if (!auth.toLowerCase().startsWith("bearer ")) throw new Error("Admin authentication required");
  const token = auth.slice(7).trim();
  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey || serviceKey, Authorization: `Bearer ${token}` },
  });
  if (!userRes.ok) throw new Error("Admin authentication required");
  const user = (await userRes.json()) as { email?: string; id?: string };
  const email = asString(user.email).toLowerCase();
  if (!email) throw new Error("Admin authentication required");
  const adminRes = await fetch(
    `${supabaseUrl}/rest/v1/admin_users?email=eq.${encodeURIComponent(email)}&select=email`,
    { headers: restHeaders(serviceKey) },
  );
  const rows = (await adminRes.json()) as Array<{ email?: string }>;
  if (!Array.isArray(rows) || !rows[0]?.email) throw new Error("Forbidden: not an admin");
  return { email, id: user.id || null };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    return res.status(204).end();
  }
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const supabaseUrl = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const anonKey = String(process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "").trim();
  if (!supabaseUrl || !serviceKey) return res.status(503).json({ error: "Storage unavailable" });

  try {
    const admin = await assertAdminFromRequest(req, supabaseUrl, serviceKey, anonKey);
    const body = (req.body && typeof req.body === "object" ? req.body : {}) as Record<string, unknown>;
    const action = asString(body.action) || "dashboard";

    if (action === "dashboard") {
      const range = rangeFromBody(body);
      const year = Number(body.campaign_year) || 2026;
      const firstParty = await loadFirstPartyKpis(supabaseUrl, serviceKey, range, year);
      return res.status(200).json({
        ok: true,
        range,
        ga4: {
          configured: false,
          propertyId: null,
          measurementId: "G-YF2GRM2TL4",
          missing: ["GA4 Data API is served by Edge function christmas-admin"],
          report: null,
          error:
            "Analytics temporarily unavailable on this origin. Deploy supabase function christmas-admin with GA4_PROPERTY_ID + service-account secrets.",
          realtime: null,
          realtimeError: "Realtime requires christmas-admin Edge function.",
        },
        firstParty: firstParty.data,
        firstPartyError: firstParty.error,
        instrumentationNote:
          "Custom Christmas join events are first-party from deploy date onward. Historical GA4 page metrics require the christmas-admin Edge function.",
      });
    }

    if (action === "exportCsv") {
      const range = rangeFromBody(body);
      const year = Number(body.campaign_year) || 2026;
      const method = asString(body.signup_method).toLowerCase();
      const search = asString(body.search).toLowerCase();
      const source = asString(body.source);
      const campaign = asString(body.campaign);
      let filter = `${supabaseUrl}/rest/v1/christmas_countdown_signups?select=email,signup_method,created_at,source,medium,campaign,referrer,user_id,last_seen_at&campaign_year=eq.${year}&created_at=gte.${range.fromIso}&created_at=lte.${range.toIso}&order=created_at.desc&limit=5000`;
      if (method === "email" || method === "google") filter += `&signup_method=eq.${method}`;
      if (source) filter += `&source=eq.${encodeURIComponent(source)}`;
      if (campaign) filter += `&campaign=eq.${encodeURIComponent(campaign)}`;
      if (search) filter += `&email=ilike.${encodeURIComponent(`%${search}%`)}`;
      const list = await fetch(filter, { headers: restHeaders(serviceKey) });
      if (!list.ok) return res.status(500).json({ ok: false, error: "Signup export unavailable" });
      const rows = (await list.json()) as ChristmasSignupCsvRow[];
      return res.status(200).json({
        ok: true,
        csv: christmasSignupCsv(rows),
        filename: `christmas-countdown-signups-${range.from}-to-${range.to}.csv`,
        count: rows.length,
      });
    }

    if (action === "updateSettings") {
      const next = publicConfigFromUnknown({
        countdown_target_at: body.countdown_target_at,
        page_active: body.page_active,
        signup_active: body.signup_active,
        headline: body.headline,
        supporting_copy: body.supporting_copy,
        cta_text: body.cta_text,
        success_message: body.success_message,
        reached_message: body.reached_message,
      });
      const patch = {
        countdown_target_at: next.countdownTargetAt,
        page_active: next.pageActive,
        signup_active: next.signupActive,
        headline: next.headline,
        supporting_copy: next.supportingCopy,
        cta_text: next.ctaText,
        success_message: next.successMessage,
        reached_message: next.reachedMessage,
        updated_by: admin.id,
      };
      const update = await fetch(`${supabaseUrl}/rest/v1/christmas_countdown_settings?id=eq.default`, {
        method: "PATCH",
        headers: { ...restHeaders(serviceKey), Prefer: "return=representation" },
        body: JSON.stringify(patch),
      });
      if (!update.ok) return res.status(500).json({ ok: false, error: "Settings table not applied yet" });
      const rows = (await update.json()) as unknown[];
      return res.status(200).json({ ok: true, settings: rows[0] || patch });
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    const status = /admin|forbidden|authentication required/i.test(message) ? 403 : 500;
    return res.status(status).json({ error: message });
  }
}
