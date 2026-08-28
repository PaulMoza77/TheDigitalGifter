#!/usr/bin/env node
/**
 * Read-only V3 analytics audit. Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 * Does not modify production data.
 */
import { createClient } from "@supabase/supabase-js";

const url = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

function maskSession(id) {
  return id ? `${String(id).slice(0, 8)}…` : "—";
}

async function main() {
  const since = new Date(Date.now() - 30 * 86400000).toISOString();

  const { data: landingRows, error: landingErr } = await supabase
    .from("pet_v3_funnel_events")
    .select("funnel_session_id, created_at, is_test, traffic_class, utm_source, utm_medium, campaign_id, ad_id, has_meta_click, fbc, fbp, referrer_host, amount_cents, displayed_price_cents")
    .eq("event_name", "v3_landing_view")
    .gte("created_at", since)
    .order("created_at", { ascending: true });
  if (landingErr) throw landingErr;

  const { data: checkoutRows, error: checkoutErr } = await supabase
    .from("pet_v3_funnel_events")
    .select("*")
    .eq("event_name", "v3_begin_checkout")
    .gte("created_at", since)
    .order("created_at", { ascending: true });
  if (checkoutErr) throw checkoutErr;

  const prodLandings = (landingRows || []).filter((r) => !r.is_test);
  const testLandings = (landingRows || []).filter((r) => r.is_test);

  const byClass = {};
  for (const row of prodLandings) {
    const c = row.traffic_class || "unknown";
    byClass[c] = (byClass[c] || 0) + 1;
  }

  console.log("\n=== V3 landing sessions (30d) ===");
  console.log(`Total landing events: ${(landingRows || []).length}`);
  console.log(`Production (is_test=false): ${prodLandings.length}`);
  console.log(`Internal test (is_test=true): ${testLandings.length}`);
  console.log("Production by traffic_class:", byClass);

  console.log("\n=== v3_begin_checkout sessions ===");
  for (const row of checkoutRows || []) {
    const sessionId = row.funnel_session_id;
    const short = maskSession(sessionId);

    const { data: sessionEvents } = await supabase
      .from("pet_v3_funnel_events")
      .select("event_name, created_at")
      .eq("funnel_session_id", sessionId)
      .order("created_at", { ascending: true });

    const { data: orders } = await supabase
      .from("pet_orders")
      .select("id, funnel_variant, status, amount_cents, charged_amount_cents, stripe_checkout_session_id, stripe_payment_status, paid_at, created_at")
      .eq("funnel_variant", "v3")
      .filter("metadata->>funnel_session_id", "eq", sessionId);

    // Fallback: match by checkout session idempotency suffix in events
    let orderMatch = orders?.[0] || null;
    if (!orderMatch && row.idempotency_key?.includes(":")) {
      const maybeOrderId = row.idempotency_key.split(":").pop();
      if (maybeOrderId) {
        const { data: byId } = await supabase
          .from("pet_orders")
          .select("id, funnel_variant, status, amount_cents, charged_amount_cents, stripe_checkout_session_id, stripe_payment_status, paid_at, created_at")
          .eq("id", maybeOrderId)
          .maybeSingle();
        orderMatch = byId;
      }
    }

    let stripeSession = null;
    if (orderMatch?.stripe_checkout_session_id) {
      // Do not call Stripe API from audit script — report stored fields only.
      stripeSession = {
        id: `${String(orderMatch.stripe_checkout_session_id).slice(0, 12)}…`,
        payment_status: orderMatch.stripe_payment_status,
      };
    }

    const { data: checkoutCreated } = await supabase
      .from("pet_v3_funnel_events")
      .select("id, created_at")
      .eq("funnel_session_id", sessionId)
      .eq("event_name", "v3_checkout_session_created")
      .maybeSingle();

    console.log("\n--- Checkout session", short, "---");
    console.log({
      timestamp: row.created_at,
      session_short: short,
      is_test: row.is_test,
      traffic_class: row.traffic_class,
      source_medium: `${row.utm_source || "—"} / ${row.utm_medium || "—"}`,
      campaign_id: row.campaign_id || null,
      ad_id: row.ad_id || null,
      creative_id: row.creative_id || null,
      has_meta_click: row.has_meta_click,
      fbc_present: Boolean(row.fbc),
      fbp_present: Boolean(row.fbp),
      referrer_host: row.referrer_host,
      funnel_version: row.funnel_version,
      displayed_price_cents: row.displayed_price_cents ?? row.amount_cents,
      stripe_checkout_session_created_event: Boolean(checkoutCreated),
      pet_order: orderMatch
        ? {
            id: `${String(orderMatch.id).slice(0, 8)}…`,
            status: orderMatch.status,
            amount_cents: orderMatch.amount_cents,
            stripe_payment_status: orderMatch.stripe_payment_status,
            paid_at: orderMatch.paid_at,
          }
        : null,
      stripe_session_stored: stripeSession,
      funnel_events: (sessionEvents || []).map((e) => e.event_name),
      resembles_internal:
        row.is_test ||
        row.traffic_class === "internal_test" ||
        String(row.utm_source || "").toLowerCase() === "internal" ||
        String(row.utm_campaign || "").toLowerCase().includes("smoke"),
    });
  }

  const { data: settings } = await supabase
    .from("pet_v3_measurement_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  console.log("\n=== V3 measurement settings ===", settings || "table missing / unset");

  const { data: metaCtx } = await supabase.rpc("admin_pet_v3_meta_context", {
    p_from: since,
    p_to: new Date().toISOString(),
    p_campaign_id: "120253518796930170",
  });
  console.log("\n=== Meta context (if RPC exists) ===", metaCtx);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
