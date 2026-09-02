#!/usr/bin/env node
/**
 * Prove V2 checkout telemetry events can write (post name_chk migration).
 * Does not charge. Does not print secrets.
 */
const site = String(process.env.TDG_SITE_ORIGIN || "https://www.thedigitalgifter.com").replace(/\/$/, "");

const events = [
  "v2_checkout_session_requested",
  "v2_checkout_session_created",
  "v2_checkout_failed",
  "v2_checkout_canceled",
  "v2_teaser_viewed",
  "v2_begin_checkout",
];

const results = [];
function rec(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

for (const eventName of events) {
  const sid = crypto.randomUUID();
  const res = await fetch(`${site}/api/pet-v2/funnel-event`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event_name: eventName,
      funnel_session_id: sid,
      idempotency_key: `${sid}:${eventName}:smoke`,
      species: "dog",
      pathname: "/pet/dog-v2",
      device_type: "mobile",
      amount_cents: eventName.includes("checkout") ? 299 : undefined,
    }),
    signal: AbortSignal.timeout(20000),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  rec(
    eventName,
    res.status === 202 && json?.ok === true,
    `http=${res.status} body=${text.slice(0, 80)}`,
  );
}

const failed = results.filter((r) => !r.ok);
console.log(
  `CHECKOUT_EVENT_SMOKE ${failed.length ? "FAILED" : "OK"} ${results.length - failed.length}/${results.length}`,
);
if (failed.length) process.exit(1);
