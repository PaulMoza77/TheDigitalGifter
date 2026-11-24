#!/usr/bin/env node
/**
 * Isolated mock QA for unlimited paid Santa extensions (no LIVE Stripe charges).
 * Models cumulative minutes + webhook idempotency + failed/abandoned checkout = 0 grant.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "docs", "qa", "santa-call-unlimited-extensions");
fs.mkdirSync(outDir, { recursive: true });

const INITIAL = 180;
const EXT = 300;
const INFRA_CAP = 7200;

function createEntitlement() {
  return {
    remaining: INITIAL,
    max: INITIAL,
    status: "ready",
    extensions: [], // { orderId, seconds }
  };
}

function grantExtension(ent, orderId, paid) {
  if (!paid) return { ok: false, reason: "payment_required", remaining: ent.remaining };
  const existing = ent.extensions.find((x) => x.orderId === orderId);
  if (existing) {
    return {
      ok: true,
      reason: "already_extended",
      remaining: ent.remaining,
      count: ent.extensions.length,
    };
  }
  if (ent.max + EXT > INFRA_CAP) {
    return { ok: false, reason: "infra_cap_reached", remaining: ent.remaining };
  }
  ent.extensions.push({ orderId, seconds: EXT });
  ent.remaining += EXT;
  ent.max += EXT;
  ent.status = "ready";
  return {
    ok: true,
    reason: "activated",
    remaining: ent.remaining,
    count: ent.extensions.length,
  };
}

function exhaust(ent) {
  ent.remaining = 0;
  ent.status = "awaiting_extension";
}

const checks = [];
const record = (name, ok, detail = {}) => {
  const { ok: _ignored, ...rest } = detail || {};
  void _ignored;
  checks.push({ name, ok, ...rest });
  console.log(JSON.stringify({ name, ok, ...rest }));
};

// 1) Initial → ext1 → ext2
{
  const ent = createEntitlement();
  exhaust(ent);
  const a = grantExtension(ent, "o1", true);
  record("ext_1", a.ok && a.remaining === 300 && a.count === 1, a);
  exhaust(ent);
  const b = grantExtension(ent, "o2", true);
  record("ext_2", b.ok && b.remaining === 300 && b.count === 2 && ent.max === 780, b);
}

// 2) Expired → extension → resume budget
{
  const ent = createEntitlement();
  exhaust(ent);
  const a = grantExtension(ent, "o3", true);
  record("expired_then_ext", a.ok && ent.status === "ready" && a.remaining === 300, a);
}

// 3) Successive 1,2,3,5
{
  const ent = createEntitlement();
  const totals = [];
  for (let i = 1; i <= 5; i++) {
    exhaust(ent);
    const r = grantExtension(ent, `s${i}`, true);
    totals.push({ i, remaining: r.remaining, max: ent.max, count: r.count });
  }
  record(
    "five_successive",
    totals.length === 5 &&
      totals[0].max === 480 &&
      totals[1].max === 780 &&
      totals[2].max === 1080 &&
      totals[4].max === 1680 &&
      totals[4].count === 5,
    { totals },
  );
}

// 4) Failed payment → 0
{
  const ent = createEntitlement();
  exhaust(ent);
  const before = ent.remaining;
  const r = grantExtension(ent, "fail1", false);
  record("failed_payment_zero", !r.ok && ent.remaining === before && ent.extensions.length === 0, r);
}

// 5) Abandoned checkout (never paid) → 0
{
  const ent = createEntitlement();
  const beforeMax = ent.max;
  // create checkout only — no grant call
  record("abandoned_checkout_zero", ent.extensions.length === 0 && ent.max === beforeMax, {
    remaining: ent.remaining,
  });
}

// 6) Duplicate webhook → once
{
  const ent = createEntitlement();
  exhaust(ent);
  const a = grantExtension(ent, "dup", true);
  const b = grantExtension(ent, "dup", true);
  record(
    "duplicate_webhook_once",
    a.ok && b.ok && b.reason === "already_extended" && ent.extensions.length === 1 && ent.remaining === 300,
    { a, b },
  );
}

// 7) Double-click / concurrent same order reuse modeled as same orderId
{
  const ent = createEntitlement();
  exhaust(ent);
  const a = grantExtension(ent, "click", true);
  const b = grantExtension(ent, "click", true);
  record("double_click_same_order", a.count === 1 && b.reason === "already_extended", { a, b });
}

// 8) Unused minutes preserved when buying mid-call
{
  const ent = createEntitlement();
  ent.remaining = 40;
  const a = grantExtension(ent, "mid", true);
  record("mid_call_preserves_unused", a.ok && a.remaining === 340, a);
}

// 9) Cumulative table check (initial + 4 extensions)
{
  const rows = [
    { purchase: "initial", price: 59, add: 3, total: 3 },
    { purchase: "ext1", price: 49, add: 5, total: 8 },
    { purchase: "ext2", price: 49, add: 5, total: 13 },
    { purchase: "ext3", price: 49, add: 5, total: 18 },
    { purchase: "ext4", price: 49, add: 5, total: 23 },
  ];
  let minutes = 0;
  const computed = rows.map((r) => {
    minutes += r.add;
    return { ...r, ok: minutes === r.total };
  });
  record(
    "cumulative_minutes_table",
    computed.every((r) => r.ok),
    { computed },
  );
}

const allPass = checks.every((c) => c.ok);
const report = {
  generated_at: new Date().toISOString(),
  all_pass: allPass,
  checks,
  note: "Mock only — no LIVE Stripe charges. Deploy migration + edge function before PRODUCTION GO.",
};
fs.writeFileSync(path.join(outDir, "MOCK_EXTENSION_QA.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ all_pass: allPass, out: "docs/qa/santa-call-unlimited-extensions/MOCK_EXTENSION_QA.json" }));
process.exit(allPass ? 0 : 1);
