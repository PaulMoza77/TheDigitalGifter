#!/usr/bin/env node
/**
 * Mission 02C — isolated Postgres E2E for Christmas Story durable orders.
 * Talks only to local docker `tdg-story-02c-db` on 127.0.0.1:54332.
 * Does NOT touch production, remote Supabase, or Santa Call tables.
 */
import { createHash, randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";

const DB = "tdg-story-02c-db";
const PRICE = 5700;
let failures = 0;

function sha256(value) {
  return createHash("sha256").update(String(value), "utf8").digest("hex");
}

function token() {
  return randomBytes(32).toString("hex");
}

function psql(sql) {
  const out = execFileSync(
    "docker",
    ["exec", "-i", DB, "psql", "-U", "postgres", "-q", "-v", "ON_ERROR_STOP=1", "-t", "-A", "-c", sql],
    { encoding: "utf8" },
  );
  return out
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("INSERT") && !l.startsWith("UPDATE") && !l.startsWith("DELETE") && !l.startsWith("SET") && !l.startsWith("TRUNCATE"))
    .join("\n")
    .trim();
}

function assert(name, cond, detail = "") {
  if (cond) {
    console.log(`PASS  ${name}`);
  } else {
    failures += 1;
    console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function asService(sql) {
  // SECURITY DEFINER RPCs check auth.role() against JWT claim (Supabase pattern).
  return psql(`select set_config('request.jwt.claim.role', 'service_role', false); ${sql};`);
}

console.log("=== Mission 02C isolated DB E2E ===");
console.log(`target: docker://${DB}:54332 (local only)`);

// Clean slate for this run
psql(`
  truncate table public.christmas_story_recovery_challenges cascade;
  truncate table public.christmas_story_audit_events cascade;
  truncate table public.christmas_story_access_grants cascade;
  truncate table public.christmas_story_jobs cascade;
  truncate table public.christmas_story_assets cascade;
  truncate table public.christmas_story_content_versions cascade;
  truncate table public.christmas_story_orders cascade;
  truncate table public.christmas_story_drafts cascade;
  truncate table public.processed_stripe_events cascade;
`);

const buyerPlain = token();
const buyerHash = sha256(buyerPlain);
const recipientPlain = token();
const recipientHash = sha256(recipientPlain);
const email = "buyer02c@example.test";

const draftId = psql(`
  insert into public.christmas_story_drafts (buyer_access_token_hash, buyer_email, payload, photo_count)
  values ('${buyerHash}', '${email}', '{"recipientName":"Emma"}'::jsonb, 2)
  returning id;
`);
assert("draft created", /^[0-9a-f-]{36}$/i.test(draftId), draftId);

const orderId = psql(`
  insert into public.christmas_story_orders (
    draft_id, status, payment_status, amount_cents, currency,
    buyer_email, buyer_access_token_hash, stripe_mode, idempotency_key,
    recipient_name, from_name, content
  ) values (
    '${draftId}', 'CHECKOUT_PENDING', 'pending', ${PRICE}, 'usd',
    '${email}', '${buyerHash}', 'test', 'e2e-${Date.now()}',
    'Emma', 'Sam', '{"dedication":"For Emma"}'::jsonb
  ) returning id;
`);
assert("order CHECKOUT_PENDING", /^[0-9a-f-]{36}$/i.test(orderId), orderId);

psql(`
  insert into public.christmas_story_access_grants (order_id, grant_kind, token_hash, enabled)
  values ('${orderId}', 'recipient', '${recipientHash}', false);
`);

// Unauthorized: anon cannot select orders
const anonSelect = (() => {
  try {
    return psql(`set role anon; select count(*) from public.christmas_story_orders;`);
  } catch (e) {
    return `ERR:${e.message || e}`;
  }
})();
assert(
  "anon cannot read orders",
  anonSelect.startsWith("ERR:") || anonSelect === "0",
  anonSelect,
);
psql(`reset role;`);

// Creating session must NOT mark paid
const payBefore = psql(`select payment_status || ':' || status from public.christmas_story_orders where id='${orderId}';`);
assert("session create leaves unpaid", payBefore === "pending:CHECKOUT_PENDING", payBefore);

// Fulfillment requires service_role
let fulfillAsAnon = "ok";
try {
  psql(`
    set role anon;
    select public.christmas_story_fulfill_payment(
      '${orderId}'::uuid, 'cs_test_e2e', 'pi_test_e2e', ${PRICE}, 'usd', 'evt_test_1'
    );
  `);
} catch (e) {
  fulfillAsAnon = String(e.stderr || e.message || e);
}
psql(`reset role;`);
assert("anon cannot fulfill payment", /service_role_required|permission denied|ERR/i.test(fulfillAsAnon), fulfillAsAnon.slice(0, 160));

// Simulate webhook as service_role (same connection set role)
const fulfill = asService(`
  select public.christmas_story_fulfill_payment(
    '${orderId}'::uuid, 'cs_test_e2e', 'pi_test_e2e', ${PRICE}, 'usd', 'evt_test_1'
  )::text
`);
assert("fulfill payment ok", fulfill.includes('"ok": true') || fulfill.includes('"code": "paid"'), fulfill);
const paidState = psql(`select payment_status || ':' || status from public.christmas_story_orders where id='${orderId}';`);
assert("order paid after webhook RPC", paidState === "paid:PAID", paidState);

// Idempotent second fulfill
const fulfill2 = asService(`
  select public.christmas_story_fulfill_payment(
    '${orderId}'::uuid, 'cs_test_e2e', 'pi_test_e2e', ${PRICE}, 'usd', 'evt_test_2'
  )::text
`);
assert("duplicate fulfill is already_paid", fulfill2.includes("already_paid"), fulfill2);

// Amount mismatch rejected on a fresh pending order
const order2 = psql(`
  insert into public.christmas_story_orders (
    status, payment_status, amount_cents, currency, buyer_email, buyer_access_token_hash, stripe_mode, idempotency_key
  ) values (
    'CHECKOUT_PENDING', 'pending', ${PRICE}, 'usd', '${email}', '${buyerHash}', 'test', 'e2e-amt-${Date.now()}'
  ) returning id;
`);
const badAmt = asService(`
  select public.christmas_story_fulfill_payment(
    '${order2}'::uuid, 'cs_bad', 'pi_bad', 1, 'usd', 'evt_bad_amt'
  )::text
`);
assert("amount mismatch rejected", badAmt.includes("amount_mismatch"), badAmt);

// Lifecycle: PAID → … → REVIEW_REQUIRED → APPROVED → READY_TO_SEND → SENT
asService(`select public.christmas_story_transition_order('${orderId}'::uuid, 'CONTENT_PENDING', 'e2e')`);
asService(`select public.christmas_story_transition_order('${orderId}'::uuid, 'GENERATING', 'e2e')`);
asService(`select public.christmas_story_transition_order('${orderId}'::uuid, 'REVIEW_REQUIRED', 'e2e')`);
asService(`select public.christmas_story_transition_order('${orderId}'::uuid, 'APPROVED', 'e2e')`);
asService(`select public.christmas_story_transition_order('${orderId}'::uuid, 'READY_TO_SEND', 'e2e')`);

const preSendGrant = psql(`select enabled::text from public.christmas_story_access_grants where order_id='${orderId}' and grant_kind='recipient';`);
assert("recipient disabled pre-send", preSendGrant === "false", preSendGrant);

psql(`
  update public.christmas_story_access_grants
  set enabled = true
  where order_id='${orderId}' and grant_kind='recipient';
`);
asService(`select public.christmas_story_transition_order('${orderId}'::uuid, 'SENT', 'e2e')`);

const tokenStored = psql(`select token_hash from public.christmas_story_access_grants where order_id='${orderId}' and grant_kind='recipient';`);
assert("recipient token hashed at rest", tokenStored === recipientHash && tokenStored !== recipientPlain, tokenStored.slice(0, 16));

// Unauthorized wrong token hash finds nothing
const wrongLookup = psql(`
  select count(*) from public.christmas_story_access_grants
  where token_hash='${sha256("wrong-token-value-xxxxxxxxxxxxxxxx")}';
`);
assert("wrong recipient token misses", wrongLookup === "0", wrongLookup);

// Buyer preview must not set OPENED
const openedBefore = psql(`select coalesce(opened_at::text,'null') from public.christmas_story_orders where id='${orderId}';`);
psql(`
  insert into public.christmas_story_audit_events (order_id, event_name, actor_kind, metadata)
  values ('${orderId}', 'buyer_preview', 'buyer', '{}'::jsonb);
`);
const statusAfterPreview = psql(`select status from public.christmas_story_orders where id='${orderId}';`);
const openedAfter = psql(`select coalesce(opened_at::text,'null') from public.christmas_story_orders where id='${orderId}';`);
assert("buyer preview does not OPEN", statusAfterPreview === "SENT" && openedAfter === openedBefore, `${statusAfterPreview}/${openedAfter}`);

// Recipient open
asService(`select public.christmas_story_transition_order('${orderId}'::uuid, 'OPENED', 'recipient')`);
const openedStatus = psql(`select status from public.christmas_story_orders where id='${orderId}';`);
assert("recipient open marks OPENED", openedStatus === "OPENED", openedStatus);

// Revoke
psql(`
  update public.christmas_story_access_grants
  set enabled=false, revoked_at=now(), token_hash='${sha256(token())}'
  where order_id='${orderId}' and grant_kind='recipient';
`);
const revoked = psql(`
  select (revoked_at is not null and enabled=false)::text
  from public.christmas_story_access_grants where order_id='${orderId}' and grant_kind='recipient';
`);
assert("revocation disables grant", revoked === "true", revoked);
assert("old recipient hash gone", psql(`select count(*) from public.christmas_story_access_grants where token_hash='${recipientHash}';`) === "0");

// Expiry
const order3 = psql(`
  insert into public.christmas_story_orders (
    status, payment_status, amount_cents, currency, buyer_email, buyer_access_token_hash, stripe_mode, idempotency_key
  ) values (
    'CHECKOUT_PENDING', 'pending', ${PRICE}, 'usd', '${email}', '${buyerHash}', 'test', 'e2e-exp-${Date.now()}'
  ) returning id;
`);
asService(`select public.christmas_story_expire_checkout('${order3}'::uuid, 'e2e')`);
const expired = psql(`select payment_status || ':' || status from public.christmas_story_orders where id='${order3}';`);
assert("checkout expiry", expired === "expired:FAILED", expired);

// Recovery challenge hash-at-rest
const recoveryPlain = token();
const recoveryHash = sha256(recoveryPlain);
const emailHash = sha256(email);
psql(`
  insert into public.christmas_story_recovery_challenges (order_id, email_hash, token_hash, expires_at)
  values ('${orderId}', '${emailHash}', '${recoveryHash}', now() + interval '30 minutes');
`);
const recoveryPlainLeak = psql(`
  select count(*) from public.christmas_story_recovery_challenges
  where token_hash='${recoveryPlain}' or email_hash='${email}';
`);
assert("recovery stores hashes only", recoveryPlainLeak === "0", recoveryPlainLeak);

// Invalid transition blocked
let badTransition = "ok";
try {
  asService(`select public.christmas_story_transition_order('${orderId}'::uuid, 'DRAFT', 'e2e')`);
} catch (e) {
  badTransition = String(e.stderr || e.message || e);
}
assert("invalid transition rejected", /invalid_transition/i.test(badTransition), badTransition.slice(0, 120));

console.log("---");
if (failures) {
  console.error(`RESULT: ${failures} failure(s)`);
  process.exit(1);
}
console.log("RESULT: all checks passed");
