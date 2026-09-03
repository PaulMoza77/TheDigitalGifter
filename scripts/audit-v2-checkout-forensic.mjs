#!/usr/bin/env node
/**
 * Read-only Pet V2 checkout forensic audit (schema-aligned).
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY. Redacts PII.
 */
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";

const url = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });
const days = Number(process.env.AUDIT_DAYS || 30);
const since = new Date(Date.now() - days * 86400000).toISOString();

function mask(id, n = 8) {
  if (!id) return "—";
  const s = String(id);
  return s.length <= n ? s : `${s.slice(0, n)}…`;
}

async function fetchPaged(table, select, apply = (q) => q) {
  const pageSize = 1000;
  let from = 0;
  const all = [];
  for (;;) {
    let q = sb.from(table).select(select).order("created_at", { ascending: true }).range(from, from + pageSize - 1);
    q = apply(q);
    const { data, error } = await q;
    if (error) throw error;
    all.push(...(data || []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

function extractOrderIdFromKey(key) {
  const s = String(key || "");
  // common patterns: ...:uuid or uuid
  const m = s.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
  return m ? m[0] : null;
}

async function main() {
  console.log(`\n=== Pet V2 Forensic Audit ===`);
  console.log(`since=${since} days=${days}`);

  const events = await fetchPaged(
    "pet_v2_funnel_events",
    "id,event_name,funnel_session_id,idempotency_key,species,utm_source,utm_medium,utm_campaign,utm_content,utm_term,campaign_id,adset_id,ad_id,device_type,pathname,amount_cents,has_meta_click,referrer_host,client_event_id,created_at,is_test,environment,country_code",
    (q) => q.gte("created_at", since),
  );

  const prod = events.filter((e) => !e.is_test);
  const test = events.filter((e) => e.is_test);

  const byName = {};
  const byNameSessions = {};
  for (const e of prod) {
    byName[e.event_name] = (byName[e.event_name] || 0) + 1;
    if (!byNameSessions[e.event_name]) byNameSessions[e.event_name] = new Set();
    byNameSessions[e.event_name].add(e.funnel_session_id);
  }

  console.log("\n--- RAW independent unique-session counts (prod) ---");
  const rawRows = Object.keys(byName)
    .sort((a, b) => byName[b] - byName[a])
    .map((k) => ({
      event: k,
      events: byName[k],
      unique_sessions: byNameSessions[k].size,
    }));
  console.table(rawRows);

  const previewViewed = byNameSessions["v2_preview_viewed"] || new Set();
  const teaserViewed = byNameSessions["v2_teaser_viewed"] || new Set();
  const teaserOrPreview = new Set([...teaserViewed, ...previewViewed]);

  function setFor(ev) {
    if (ev === "v2_teaser_viewed") return teaserOrPreview;
    return byNameSessions[ev] || new Set();
  }

  function sequentialCount(required) {
    let set = null;
    for (const ev of required) {
      const next = setFor(ev);
      set = set == null ? new Set(next) : new Set([...set].filter((id) => next.has(id)));
    }
    return set?.size || 0;
  }

  const sequential = {
    landing: sequentialCount(["v2_landing_view"]),
    upload: sequentialCount(["v2_landing_view", "v2_upload_completed"]),
    teaser: sequentialCount(["v2_landing_view", "v2_upload_completed", "v2_teaser_viewed"]),
    offer: sequentialCount(["v2_landing_view", "v2_upload_completed", "v2_teaser_viewed", "v2_offer_viewed"]),
    begin_checkout: sequentialCount([
      "v2_landing_view",
      "v2_upload_completed",
      "v2_teaser_viewed",
      "v2_offer_viewed",
      "v2_begin_checkout",
    ]),
    session_created_seq: (() => {
      // alternate: require session_created instead of begin
      let set = null;
      for (const ev of [
        "v2_landing_view",
        "v2_upload_completed",
        "v2_teaser_viewed",
        "v2_offer_viewed",
        "v2_checkout_session_created",
      ]) {
        const next = setFor(ev);
        set = set == null ? new Set(next) : new Set([...set].filter((id) => next.has(id)));
      }
      return set?.size || 0;
    })(),
    purchase: sequentialCount([
      "v2_landing_view",
      "v2_upload_completed",
      "v2_teaser_viewed",
      "v2_offer_viewed",
      "v2_begin_checkout",
      "v2_purchase",
    ]),
  };
  console.log("\n--- TRUE sequential cohort ---");
  console.log(sequential);

  // Non-sequential: offer without teaser, checkout without offer, etc.
  const offerSet = byNameSessions["v2_offer_viewed"] || new Set();
  const beginSet = byNameSessions["v2_begin_checkout"] || new Set();
  const createdSet = byNameSessions["v2_checkout_session_created"] || new Set();
  const anomalies = {
    offer_without_teaser_or_preview: [...offerSet].filter((id) => !teaserOrPreview.has(id)).length,
    begin_without_offer: [...beginSet].filter((id) => !offerSet.has(id)).length,
    begin_without_teaser: [...beginSet].filter((id) => !teaserOrPreview.has(id)).length,
    created_without_offer: [...createdSet].filter((id) => !offerSet.has(id)).length,
    begin_without_created: [...beginSet].filter((id) => !createdSet.has(id)).length,
    created_without_begin: [...createdSet].filter((id) => !beginSet.has(id)).length,
  };
  console.log("\n--- Funnel anomalies (unique sessions) ---");
  console.log(anomalies);

  const orders = await fetchPaged(
    "pet_orders",
    "id,status,amount_cents,charged_amount_cents,currency,funnel_variant,sku,stripe_checkout_session_id,stripe_payment_intent_id,stripe_payment_status,paid_at,created_at,last_error,species,email,meta_purchase_sent_at,meta_event_id,offer_id,device_type",
    (q) => q.eq("funnel_variant", "v2").gte("created_at", since),
  ).catch(async (e) => {
    console.warn("orders select narrowed", e.message || e);
    return fetchPaged(
      "pet_orders",
      "id,status,amount_cents,charged_amount_cents,currency,funnel_variant,sku,stripe_checkout_session_id,stripe_payment_intent_id,stripe_payment_status,paid_at,created_at,last_error,species,email,meta_purchase_sent_at,meta_event_id,offer_id",
      (q) => q.eq("funnel_variant", "v2").gte("created_at", since),
    );
  });

  const byStatus = {};
  for (const o of orders) byStatus[o.status] = (byStatus[o.status] || 0) + 1;
  const paid = orders.filter(
    (o) =>
      o.paid_at ||
      o.status === "paid" ||
      o.status === "completed" ||
      o.stripe_payment_status === "paid" ||
      o.stripe_payment_status === "succeeded",
  );
  console.log("\n--- V2 ORDERS ---");
  console.log({
    count: orders.length,
    by_status: byStatus,
    with_stripe_session: orders.filter((o) => o.stripe_checkout_session_id).length,
    with_payment_intent: orders.filter((o) => o.stripe_payment_intent_id).length,
    paid_count: paid.length,
    paid_revenue_cents: paid.reduce((s, o) => s + (o.charged_amount_cents || o.amount_cents || 0), 0),
    meta_purchase_sent: paid.filter((o) => o.meta_purchase_sent_at).length,
  });
  for (const p of paid) {
    console.log({
      id: mask(p.id),
      amount: p.charged_amount_cents || p.amount_cents,
      currency: p.currency,
      paid_at: p.paid_at,
      status: p.status,
      stripe_pay: p.stripe_payment_status,
      meta_sent: Boolean(p.meta_purchase_sent_at),
      session: mask(p.stripe_checkout_session_id, 14),
      pi: mask(p.stripe_payment_intent_id, 14),
    });
  }

  // Amount distribution for unpaid checkouts with sessions
  const amountDist = {};
  for (const o of orders) {
    const a = o.charged_amount_cents || o.amount_cents;
    amountDist[a] = (amountDist[a] || 0) + 1;
  }
  console.log("\n--- Amount distribution (cents) ---", amountDist);

  // Checkout sessions table join
  const checkoutRows = await fetchPaged(
    "pet_checkout_sessions",
    "id,order_id,stripe_session_id,created_at",
    (q) => q.gte("created_at", since),
  );
  const checkoutByOrder = new Map();
  for (const c of checkoutRows) {
    if (!checkoutByOrder.has(c.order_id)) checkoutByOrder.set(c.order_id, []);
    checkoutByOrder.get(c.order_id).push(c);
  }
  const multiSessionOrders = [...checkoutByOrder.entries()].filter(([, v]) => v.length > 1);
  console.log("\n--- pet_checkout_sessions ---", {
    rows: checkoutRows.length,
    unique_orders: checkoutByOrder.size,
    orders_with_multiple_sessions: multiSessionOrders.length,
  });

  // Order events for all v2 orders
  const orderIds = orders.map((o) => o.id);
  const orderEvents = [];
  for (let i = 0; i < orderIds.length; i += 80) {
    const chunk = orderIds.slice(i, i + 80);
    const { data, error } = await sb
      .from("pet_order_events")
      .select("id,order_id,action,payload,created_at,actor_type")
      .in("order_id", chunk)
      .order("created_at", { ascending: true });
    if (error) {
      console.warn("order_events error", error.message);
      break;
    }
    orderEvents.push(...(data || []));
  }
  const orderEventsByOrder = new Map();
  const actionCounts = {};
  for (const ev of orderEvents) {
    if (!orderEventsByOrder.has(ev.order_id)) orderEventsByOrder.set(ev.order_id, []);
    orderEventsByOrder.get(ev.order_id).push(ev);
    actionCounts[ev.action] = (actionCounts[ev.action] || 0) + 1;
  }
  console.log("\n--- pet_order_events action counts ---");
  console.log(actionCounts);

  // Build session -> order mapping via idempotency keys on checkout events
  const sessionToOrders = new Map();
  const orderToSessions = new Map();
  for (const e of prod) {
    if (
      ![
        "v2_begin_checkout",
        "v2_checkout_session_created",
        "v2_checkout_session_requested",
        "v2_checkout_failed",
        "v2_purchase",
        "v2_checkout_canceled",
      ].includes(e.event_name)
    )
      continue;
    const oid = extractOrderIdFromKey(e.idempotency_key);
    if (!oid) continue;
    if (!sessionToOrders.has(e.funnel_session_id)) sessionToOrders.set(e.funnel_session_id, new Set());
    sessionToOrders.get(e.funnel_session_id).add(oid);
    if (!orderToSessions.has(oid)) orderToSessions.set(oid, new Set());
    orderToSessions.get(oid).add(e.funnel_session_id);
  }

  // Checkout population = any session with begin OR session_created OR session_requested
  // PLUS any order that has a stripe checkout session (even if events missing)
  const checkoutSessionIds = new Set([
    ...(byNameSessions["v2_begin_checkout"] || []),
    ...(byNameSessions["v2_checkout_session_created"] || []),
    ...(byNameSessions["v2_checkout_session_requested"] || []),
  ]);
  for (const [, sessions] of orderToSessions) for (const s of sessions) checkoutSessionIds.add(s);

  // Also treat each order with stripe session as a checkout unit if no session mapped
  const orphanOrders = orders.filter(
    (o) => o.stripe_checkout_session_id && !(orderToSessions.get(o.id)?.size > 0),
  );

  const forensic = [];

  for (const sid of checkoutSessionIds) {
    const sessionEvents = prod.filter((e) => e.funnel_session_id === sid);
    const names = new Set(sessionEvents.map((e) => e.event_name));
    const first = sessionEvents[0];
    const begin = sessionEvents.filter((e) => e.event_name === "v2_begin_checkout");
    const created = sessionEvents.filter((e) => e.event_name === "v2_checkout_session_created");
    const requested = sessionEvents.filter((e) => e.event_name === "v2_checkout_session_requested");
    const failed = sessionEvents.filter((e) => e.event_name === "v2_checkout_failed");
    const canceled = sessionEvents.filter((e) => e.event_name === "v2_checkout_canceled");
    const purchased = sessionEvents.filter((e) => e.event_name === "v2_purchase");

    const relatedOrderIds = [...(sessionToOrders.get(sid) || [])];
    const relatedOrders = orders.filter((o) => relatedOrderIds.includes(o.id));
    // fallback: if only one recent unpaid? skip guessing
    const order = relatedOrders.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0] || null;
    const oev = order ? orderEventsByOrder.get(order.id) || [] : [];
    const payloadHints = oev.map((e) => ({ action: e.action, keys: e.payload ? Object.keys(e.payload) : [] }));

    // Infer payment attempt from order events / stripe status
    const stripeStatus = order?.stripe_payment_status || null;
    const hasSession = Boolean(order?.stripe_checkout_session_id) || created.length > 0;
    const paymentFailedActions = oev.filter((e) =>
      /payment_failed|requires_action|decline|checkout_failed|payment_error/i.test(e.action),
    );
    const requiresAction = oev.some((e) => /requires_action|3ds|authentication/i.test(e.action + JSON.stringify(e.payload || {})));
    const lastError = order?.last_error || null;

    let classification = "K";
    if (purchased.length || order?.paid_at || ["paid", "succeeded"].includes(String(stripeStatus)) || ["paid", "completed"].includes(String(order?.status))) {
      classification = "A";
    } else if (/card_declined|insufficient_funds|generic_decline|do_not_honor/i.test(String(lastError || ""))) {
      classification = "C";
    } else if (requiresAction && !order?.paid_at) {
      classification = "D";
    } else if (paymentFailedActions.length || /payment|stripe|elements|confirm/i.test(String(lastError || ""))) {
      classification = "B";
    } else if (failed.length) {
      classification = "G";
    } else if (relatedOrders.length > 1 || created.length > 2 || (checkoutByOrder.get(order?.id)?.length || 0) > 1) {
      classification = "H";
    } else if (first?.is_test || first?.environment === "test") {
      classification = "I";
    } else if (!hasSession && begin.length && !requested.length) {
      classification = "J"; // tracking: begin without create
    } else if (canceled.length && !order?.paid_at) {
      classification = "F";
    } else if (hasSession && !order?.paid_at) {
      // Created but no evidence of payment attempt in our DB
      classification = stripeStatus && !["unpaid", "null", "none", ""].includes(String(stripeStatus)) ? "B" : "E";
    } else if (requested.length && !created.length) {
      classification = "G";
    } else {
      classification = "K";
    }

    forensic.push({
      session: mask(sid),
      ts: begin[0]?.created_at || created[0]?.created_at || requested[0]?.created_at || first?.created_at,
      source: first?.utm_source || null,
      medium: first?.utm_medium || null,
      campaign: first?.utm_campaign || first?.campaign_id || null,
      adset: first?.adset_id || null,
      ad: first?.ad_id || null,
      country: first?.country_code || null,
      device: first?.device_type || null,
      pathname: first?.pathname || null,
      species: first?.species || null,
      has_meta_click: Boolean(first?.has_meta_click),
      referrer_host: first?.referrer_host || null,
      teaser: names.has("v2_teaser_viewed") || names.has("v2_preview_viewed"),
      offer: names.has("v2_offer_viewed"),
      landing: names.has("v2_landing_view"),
      upload: names.has("v2_upload_completed"),
      begin_n: begin.length,
      session_req_n: requested.length,
      session_created_n: created.length,
      failed_n: failed.length,
      canceled_n: canceled.length,
      purchase_n: purchased.length,
      related_orders: relatedOrders.length,
      order_id: order ? mask(order.id) : null,
      stripe_session: order?.stripe_checkout_session_id ? mask(order.stripe_checkout_session_id, 14) : null,
      stripe_pi: order?.stripe_payment_intent_id ? mask(order.stripe_payment_intent_id, 14) : null,
      amount: order?.charged_amount_cents ?? order?.amount_cents ?? first?.amount_cents ?? null,
      currency: order?.currency || null,
      order_status: order?.status || null,
      stripe_payment_status: stripeStatus,
      paid_at: order?.paid_at || null,
      last_error: lastError ? String(lastError).slice(0, 160) : null,
      order_actions: oev.map((e) => e.action).slice(0, 20),
      checkout_session_rows: order ? checkoutByOrder.get(order.id)?.length || 0 : 0,
      classification,
      event_names: [...names].sort(),
    });
  }

  // Orphan orders with stripe sessions but no funnel session link
  for (const o of orphanOrders) {
    const oev = orderEventsByOrder.get(o.id) || [];
    let classification = "K";
    if (o.paid_at || ["paid", "completed"].includes(o.status)) classification = "A";
    else if (o.last_error) classification = "G";
    else classification = "E";
    forensic.push({
      session: `order:${mask(o.id)}`,
      ts: o.created_at,
      source: null,
      medium: null,
      campaign: null,
      adset: null,
      ad: null,
      country: null,
      device: null,
      pathname: null,
      species: o.species,
      has_meta_click: false,
      referrer_host: null,
      teaser: false,
      offer: false,
      landing: false,
      upload: false,
      begin_n: 0,
      session_req_n: 0,
      session_created_n: 0,
      failed_n: 0,
      canceled_n: 0,
      purchase_n: 0,
      related_orders: 1,
      order_id: mask(o.id),
      stripe_session: o.stripe_checkout_session_id ? mask(o.stripe_checkout_session_id, 14) : null,
      stripe_pi: o.stripe_payment_intent_id ? mask(o.stripe_payment_intent_id, 14) : null,
      amount: o.charged_amount_cents ?? o.amount_cents,
      currency: o.currency,
      order_status: o.status,
      stripe_payment_status: o.stripe_payment_status,
      paid_at: o.paid_at,
      last_error: o.last_error ? String(o.last_error).slice(0, 160) : null,
      order_actions: oev.map((e) => e.action).slice(0, 20),
      checkout_session_rows: checkoutByOrder.get(o.id)?.length || 0,
      classification,
      event_names: [],
      orphan_order: true,
    });
  }

  forensic.sort((a, b) => String(a.ts).localeCompare(String(b.ts)));

  const classTotals = {};
  for (const row of forensic) classTotals[row.classification] = (classTotals[row.classification] || 0) + 1;

  console.log("\n--- CHECKOUT FORENSIC CLASS TOTALS ---");
  console.log({
    unique_checkout_units: forensic.length,
    classifications: classTotals,
    legend: {
      A: "PURCHASED",
      B: "PAYMENT FAILED",
      C: "PAYMENT DECLINED",
      D: "3DS ABANDONED",
      E: "CHECKOUT CREATED BUT NO PAYMENT ATTEMPT",
      F: "USER ABANDONED BEFORE PAYMENT",
      G: "TECHNICAL FAILURE",
      H: "DUPLICATE CHECKOUT",
      I: "BOT/TEST/INTERNAL",
      J: "TRACKING FALSE POSITIVE",
      K: "UNKNOWN",
    },
  });

  console.log("\n--- FORENSIC TABLE ---");
  console.table(
    forensic.map((r) => ({
      session: r.session,
      ts: r.ts?.slice?.(0, 19) || r.ts,
      src: r.source,
      country: r.country,
      device: r.device,
      teaser: r.teaser,
      offer: r.offer,
      begin: r.begin_n,
      created: r.session_created_n,
      fail: r.failed_n,
      status: r.order_status,
      pay: r.stripe_payment_status,
      amt: r.amount,
      class: r.classification,
      err: (r.last_error || "").slice(0, 40),
    })),
  );

  // Device breakdown
  const deviceBreak = {};
  const sourceBreak = {};
  const countryBreak = {};
  for (const r of forensic) {
    deviceBreak[r.device || "unknown"] = (deviceBreak[r.device || "unknown"] || 0) + 1;
    sourceBreak[r.source || "unknown"] = (sourceBreak[r.source || "unknown"] || 0) + 1;
    countryBreak[r.country || "unknown"] = (countryBreak[r.country || "unknown"] || 0) + 1;
  }
  console.log("\n--- Breakdowns ---");
  console.log({ device: deviceBreak, source: sourceBreak, country: countryBreak });

  // Admin mapping simulation
  const adminMapped = {
    landing: byNameSessions["v2_landing_view"]?.size || 0,
    upload: byNameSessions["v2_upload_completed"]?.size || 0,
    teaser_viewed_raw: teaserViewed.size,
    preview_viewed_raw: previewViewed.size,
    admin_teaser_if_rpc_omits_teaser: previewViewed.size,
    offer: offerSet.size,
    begin_checkout: beginSet.size,
    session_created: createdSet.size,
    admin_checkout_mapped_begin_or_created_js: beginSet.size || createdSet.size, // || semantics
    purchase: byNameSessions["v2_purchase"]?.size || 0,
  };
  console.log("\n--- Admin mapping simulation ---");
  console.log(adminMapped);

  // Try admin RPC with various signatures
  const rpcAttempts = [
    { p_from: since, p_to: new Date().toISOString() },
    { p_start_at: since, p_end_at: new Date().toISOString() },
    { start_at: since, end_at: new Date().toISOString() },
  ];
  for (const args of rpcAttempts) {
    const { data, error } = await sb.rpc("admin_pet_funnel_analytics", args);
    if (!error) {
      console.log("\n--- admin RPC success with", Object.keys(args));
      const steps = data?.v2_steps || data?.payload?.v2_steps || data?.steps || null;
      console.log("v2_steps", JSON.stringify(steps, null, 2)?.slice(0, 5000));
      break;
    } else {
      console.log("rpc fail", Object.keys(args), error.message);
    }
  }

  // Inspect last_error / unpaid with stripe for payment clues
  const unpaidWithSession = orders.filter((o) => o.stripe_checkout_session_id && !o.paid_at);
  console.log("\n--- Unpaid orders with Stripe session (sample) ---");
  console.table(
    unpaidWithSession.slice(0, 40).map((o) => ({
      id: mask(o.id),
      status: o.status,
      pay: o.stripe_payment_status,
      amt: o.charged_amount_cents || o.amount_cents,
      err: (o.last_error || "").slice(0, 50),
      created: o.created_at?.slice?.(0, 19),
      sessions: checkoutByOrder.get(o.id)?.length || 0,
    })),
  );

  // Purchase reconciliation first-party
  const fpPurchaseSessions = byNameSessions["v2_purchase"]?.size || 0;
  console.log("\n--- Purchase reconciliation ---");
  console.log({
    stripe_or_db_paid_orders: paid.length,
    first_party_v2_purchase_sessions: fpPurchaseSessions,
    meta_purchase_sent_on_paid: paid.filter((o) => o.meta_purchase_sent_at).length,
  });

  const out = {
    since,
    days,
    raw: rawRows,
    sequential,
    anomalies,
    orders: {
      count: orders.length,
      by_status: byStatus,
      with_stripe_session: orders.filter((o) => o.stripe_checkout_session_id).length,
      with_payment_intent: orders.filter((o) => o.stripe_payment_intent_id).length,
      paid_count: paid.length,
      paid_revenue_cents: paid.reduce((s, o) => s + (o.charged_amount_cents || o.amount_cents || 0), 0),
      amount_dist: amountDist,
      paid: paid.map((p) => ({
        id: mask(p.id),
        amount: p.charged_amount_cents || p.amount_cents,
        currency: p.currency,
        paid_at: p.paid_at,
        status: p.status,
        stripe_payment_status: p.stripe_payment_status,
        meta_sent: Boolean(p.meta_purchase_sent_at),
      })),
    },
    checkout_sessions_table: {
      rows: checkoutRows.length,
      unique_orders: checkoutByOrder.size,
      multi_session_orders: multiSessionOrders.length,
    },
    order_event_actions: actionCounts,
    forensic_class_totals: classTotals,
    forensic,
    device_break: deviceBreak,
    source_break: sourceBreak,
    country_break: countryBreak,
    admin_mapped: adminMapped,
    test_event_count: test.length,
    prod_event_count: prod.length,
    orphan_orders: orphanOrders.length,
  };

  writeFileSync("/tmp/v2-checkout-forensic.json", JSON.stringify(out, null, 2));
  console.log("\nWrote /tmp/v2-checkout-forensic.json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
