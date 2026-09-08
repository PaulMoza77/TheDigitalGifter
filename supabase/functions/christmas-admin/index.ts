import { optionsResponse, jsonResponse } from "../_shared/cors.ts";
import { assertAdmin, getAuthUser, getServiceClient, readJson } from "../_shared/supabase.ts";
import { fetchChristmasGa4Realtime, fetchChristmasGa4Report, ga4ConfigStatus } from "../_shared/christmas/ga4.ts";

type Body = Record<string, unknown>;

const HISTORICAL_CACHE_MS = 5 * 60 * 1000;
const REALTIME_CACHE_MS = 30 * 1000;

type CacheEntry<T> = { expiresAt: number; value: T };
const historicalCache = new Map<string, CacheEntry<unknown>>();
const realtimeCache = new Map<string, CacheEntry<unknown>>();

function asString(value: unknown): string {
  return String(value ?? "").trim();
}

function cacheGet<T>(map: Map<string, CacheEntry<unknown>>, key: string): T | null {
  const hit = map.get(key);
  if (!hit || hit.expiresAt < Date.now()) {
    if (hit) map.delete(key);
    return null;
  }
  return hit.value as T;
}

function cacheSet<T>(map: Map<string, CacheEntry<unknown>>, key: string, value: T, ttlMs: number) {
  map.set(key, { value, expiresAt: Date.now() + ttlMs });
}

function isYmd(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function rangeFromBody(body: Body): { from: string; to: string; fromIso: string; toIso: string } {
  const from = isYmd(asString(body.from)) ? asString(body.from) : new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
  const to = isYmd(asString(body.to)) ? asString(body.to) : new Date().toISOString().slice(0, 10);
  const start = from <= to ? from : to;
  const end = from <= to ? to : from;
  return {
    from: start,
    to: end,
    fromIso: `${start}T00:00:00.000Z`,
    toIso: `${end}T23:59:59.999Z`,
  };
}

function csvEscape(value: unknown): string {
  const s = String(value ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function signupCsv(rows: Array<Record<string, unknown>>): string {
  const header = "email,signup_method,joined_at,source,medium,campaign,referrer,user_status,returning";
  const lines = rows.map((row) => {
    const created = Date.parse(String(row.created_at || ""));
    const seen = Date.parse(String(row.last_seen_at || ""));
    const returning = Number.isFinite(created) && Number.isFinite(seen) && seen - created > 12 * 60 * 60 * 1000;
    return [
      row.email,
      row.signup_method,
      row.created_at || "",
      row.source || "",
      row.medium || "",
      row.campaign || "",
      row.referrer || "",
      row.user_id ? "account" : "email-only",
      returning ? "returning" : "new",
    ]
      .map(csvEscape)
      .join(",");
  });
  return [header, ...lines].join("\n");
}

function clipText(value: unknown, fallback: string, max: number): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim().slice(0, max);
  return trimmed || fallback;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const { user } = await getAuthUser(req);
    await assertAdmin(user?.email);
    const body = await readJson<Body>(req);
    const action = asString(body.action) || "dashboard";
    const service = getServiceClient();

    if (action === "dashboard") {
      const range = rangeFromBody(body);
      const year = Number(body.campaign_year) || 2026;
      const ga4Status = ga4ConfigStatus();
      const cacheKey = `${range.from}:${range.to}:${year}`;

      const firstParty = await service.rpc("admin_christmas_countdown_kpis", {
        p_from: range.fromIso,
        p_to: range.toIso,
        p_campaign_year: year,
      });

      let analytics: unknown = cacheGet(historicalCache, cacheKey);
      let analyticsError: string | null = null;
      if (!analytics) {
        if (!ga4Status.configured) {
          analyticsError = `GA4 Data API not configured (${ga4Status.missing.join(", ") || "credentials missing"})`;
        } else {
          try {
            analytics = await fetchChristmasGa4Report({ since: range.from, until: range.to });
            cacheSet(historicalCache, cacheKey, analytics, HISTORICAL_CACHE_MS);
          } catch (err) {
            analyticsError = err instanceof Error ? err.message.slice(0, 180) : "GA4 request failed";
          }
        }
      }

      let realtime: unknown = cacheGet(realtimeCache, "rt");
      let realtimeError: string | null = null;
      if (!realtime) {
        if (!ga4Status.configured) {
          realtimeError = analyticsError;
        } else {
          try {
            realtime = await fetchChristmasGa4Realtime();
            cacheSet(realtimeCache, "rt", realtime, REALTIME_CACHE_MS);
          } catch (err) {
            realtimeError = err instanceof Error ? err.message.slice(0, 180) : "GA4 realtime failed";
          }
        }
      }

      return jsonResponse({
        ok: true,
        range,
        ga4: {
          configured: ga4Status.configured,
          propertyId: ga4Status.propertyId,
          measurementId: ga4Status.measurementId,
          missing: ga4Status.missing,
          report: analytics,
          error: analyticsError,
          realtime,
          realtimeError,
        },
        firstParty: firstParty.error ? null : firstParty.data,
        firstPartyError: firstParty.error ? firstParty.error.message : null,
        instrumentationNote:
          "Custom Christmas join events are first-party from deploy date onward. Historical GA4 page metrics for /christmas are shown where the property already recorded them.",
      });
    }

    if (action === "exportCsv") {
      const range = rangeFromBody(body);
      const year = Number(body.campaign_year) || 2026;
      const method = asString(body.signup_method).toLowerCase();
      const search = asString(body.search).toLowerCase();
      const source = asString(body.source);
      const campaign = asString(body.campaign);

      let query = service
        .from("christmas_countdown_signups")
        .select("email,signup_method,created_at,source,medium,campaign,referrer,user_id,last_seen_at")
        .eq("campaign_year", year)
        .gte("created_at", range.fromIso)
        .lte("created_at", range.toIso)
        .order("created_at", { ascending: false })
        .limit(5000);

      if (method === "email" || method === "google") query = query.eq("signup_method", method);
      if (source) query = query.eq("source", source);
      if (campaign) query = query.eq("campaign", campaign);
      if (search) query = query.ilike("email", `%${search}%`);

      const { data, error } = await query;
      if (error) return jsonResponse({ ok: false, error: error.message }, 500);
      return jsonResponse({
        ok: true,
        csv: signupCsv((data || []) as Array<Record<string, unknown>>),
        filename: `christmas-countdown-signups-${range.from}-to-${range.to}.csv`,
        count: (data || []).length,
      });
    }

    if (action === "updateSettings") {
      const patch = {
        countdown_target_at: asString(body.countdown_target_at) || "2026-12-25T00:00:00.000Z",
        page_active: body.page_active !== false,
        signup_active: body.signup_active !== false,
        headline: clipText(body.headline, "Create Magical Christmas Cards with AI", 180),
        supporting_copy: clipText(
          body.supporting_copy,
          "Transform your holiday memories into stunning, personalized Christmas cards in seconds. No design skills needed — just upload, customize, and let our AI work its magic.",
          600,
        ),
        cta_text: clipText(body.cta_text, "Start Creating", 80),
        success_message: clipText(body.success_message, "You're on the list. We'll be in touch before Christmas.", 240),
        reached_message: clipText(body.reached_message, "Christmas is here. Create something worth sending.", 240),
        updated_by: user?.id ?? null,
      };
      const parsed = Date.parse(patch.countdown_target_at);
      if (!Number.isFinite(parsed)) return jsonResponse({ ok: false, error: "Invalid countdown target date" }, 400);
      patch.countdown_target_at = new Date(parsed).toISOString();

      const { data, error } = await service
        .from("christmas_countdown_settings")
        .update(patch)
        .eq("id", "default")
        .select("*")
        .maybeSingle();
      if (error) return jsonResponse({ ok: false, error: error.message }, 500);
      return jsonResponse({ ok: true, settings: data });
    }

    return jsonResponse({ error: "Unknown action" }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    const status = /admin|forbidden|authentication required/i.test(message) ? 403 : 500;
    return jsonResponse({ error: message }, status);
  }
});
