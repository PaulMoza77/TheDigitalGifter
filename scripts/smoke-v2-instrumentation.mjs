#!/usr/bin/env node
/**
 * Production-safe Pet V2 telemetry smoke (is_test=true).
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 * Does not charge Stripe. Does not emit Meta Purchase.
 */
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const url = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
if (!url || !key) {
  console.error("BLOCKED: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required");
  process.exit(2);
}

const sb = createClient(url, key, { auth: { persistSession: false } });
const sessionId = randomUUID();
const results = [];

function rec(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function writeEvent(eventName, extra = {}) {
  const idem = `${sessionId}:${eventName}:${extra.suffix || "a"}`;
  const { data, error } = await sb.rpc("record_pet_v2_funnel_event", {
    p_event_name: eventName,
    p_funnel_session_id: sessionId,
    p_idempotency_key: idem,
    p_species: "dog",
    p_pathname: "/pet/dog-v2",
    p_device_type: "mobile",
    p_amount_cents: eventName.includes("checkout") || eventName.includes("payment") ? 299 : null,
    p_has_meta_click: false,
    p_is_test: true,
    p_environment: "production",
    p_utm_source: "tdg_instrumentation_smoke",
    p_utm_campaign: "TDG-PET-V2-PRODUCTION-INSTRUMENTATION-006",
    ...extra.rpc,
  });
  return { data, error, idem };
}

const events = [
  "v2_landing_view",
  "v2_upload_completed",
  "v2_teaser_viewed",
  "v2_offer_viewed",
  "v2_checkout_session_requested",
  "v2_checkout_session_created",
  "v2_payment_ui_visible",
  "v2_payment_attempt_started",
  "v2_payment_failed",
  "v2_payment_requires_action",
  "v2_checkout_abandoned",
];

for (const name of events) {
  const first = await writeEvent(name);
  if (first.error) {
    rec(name, false, first.error.message);
    continue;
  }
  rec(name, Boolean(first.data), `id=${first.data || "null(dup?)"}`);

  // Idempotency: same key must not create another row
  const dup = await writeEvent(name);
  if (dup.error) {
    rec(`${name}_idempotent`, false, dup.error.message);
  } else {
    rec(`${name}_idempotent`, dup.data == null, `second_id=${dup.data}`);
  }
}

// Columns (present after forensic migration)
const { data: sample, error: colErr } = await sb
  .from("pet_v2_funnel_events")
  .select("id, error_code, browser_family, in_app_browser")
  .eq("funnel_session_id", sessionId)
  .limit(1);
if (colErr) {
  rec("diag_columns", false, colErr.message);
} else {
  const row = sample?.[0] || {};
  rec("column_error_code", "error_code" in row, "present");
  rec("column_browser_family", "browser_family" in row, "present");
  rec("column_in_app_browser", "in_app_browser" in row, "present");
}

// Diagnostics RPC (may fail if caller is not admin — service role usually bypasses RLS but function checks is_admin)
const since = new Date(Date.now() - 3600_000).toISOString();
const until = new Date(Date.now() + 60_000).toISOString();
const { data: diag, error: diagErr } = await sb.rpc("admin_pet_v2_checkout_diagnostics", {
  p_from: since,
  p_to: until,
});
if (diagErr) {
  rec("admin_pet_v2_checkout_diagnostics", /not authorized|42501/i.test(diagErr.message), `expected_admin_gate=${diagErr.message}`);
} else {
  rec("admin_pet_v2_checkout_diagnostics", Boolean(diag?.definitions), "ok");
}

// Cleanup test rows
const { error: delErr } = await sb.from("pet_v2_funnel_events").delete().eq("funnel_session_id", sessionId).eq("is_test", true);
rec("cleanup_test_rows", !delErr, delErr?.message || `session=${sessionId.slice(0, 8)}`);

const failed = results.filter((r) => !r.ok);
console.log(`\nSUMMARY ${failed.length ? "FAIL" : "PASS"} total=${results.length} failed=${failed.length}`);
process.exit(failed.length ? 1 : 0);
