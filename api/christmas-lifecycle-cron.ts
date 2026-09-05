/**
 * Christmas lifecycle cron — abandoned checkout + cross-sell eligibility.
 * Marketing defaults OFF. Concurrent-safe via claim_christmas_lifecycle_event.
 *
 * Auth: x-cron-secret / Authorization Bearer must match CHRISTMAS_LIFECYCLE_CRON_SECRET or CRON_SECRET.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import {
  abandonedCheckoutEligibility,
  abandonedResumePath,
  crossSellTargets,
  DEFAULT_ABANDONED_CHECKOUT_DELAY_MS,
  resultAccessPath,
  type ChristmasOrderLifecycleView,
} from "../src/features/christmas/lifecycle/lifecycleCore";
import {
  claimAndSendLifecycleEmail,
  lifecycleMarketingEnabled,
} from "./_lib/christmas/lifecycle";

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function cronAuthorized(req: VercelRequest): boolean {
  const secret = asString(
    process.env.CHRISTMAS_LIFECYCLE_CRON_SECRET || process.env.CRON_SECRET,
  );
  if (!secret) return false;
  const header = asString(
    req.headers["x-cron-secret"] || req.headers["authorization"],
  ).replace(/^Bearer\s+/i, "");
  return header === secret;
}

function siteOrigin(): string {
  return (
    asString(process.env.SITE_URL) ||
    asString(process.env.PUBLIC_APP_URL) ||
    "https://www.thedigitalgifter.com"
  ).replace(/\/$/, "");
}

function mapOrder(row: Record<string, unknown>): ChristmasOrderLifecycleView {
  const meta =
    row.metadata && typeof row.metadata === "object"
      ? (row.metadata as Record<string, unknown>)
      : {};
  return {
    id: asString(row.id),
    paymentStatus: asString(row.payment_status),
    fulfillmentStatus: asString(row.fulfillment_status),
    productKey: asString(row.product_key),
    packageKey: asString(row.package_key),
    amountCents: Number(row.amount_cents) || 0,
    currency: asString(row.currency) || "usd",
    locale: asString(row.locale) || "en",
    email: asString(row.email) || null,
    createdAt: asString(row.created_at),
    paidAt: asString(row.paid_at) || null,
    sourceRoute: asString(row.source_route) || null,
    publicTokenHint: asString(meta.public_token_hint) || null,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "method_not_allowed" });
  }
  if (!cronAuthorized(req)) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const url = asString(process.env.SUPABASE_URL);
  const key = asString(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!url || !key) {
    return res.status(500).json({ error: "supabase_unconfigured" });
  }
  const service = createClient(url, key, { auth: { persistSession: false } });

  const delayMs = Number(
    process.env.CHRISTMAS_ABANDONED_CHECKOUT_DELAY_MS ||
      DEFAULT_ABANDONED_CHECKOUT_DELAY_MS,
  );
  const nowMs = Date.now();
  const cutoff = new Date(nowMs - delayMs).toISOString();
  const origin = siteOrigin();

  const summary = {
    abandoned_considered: 0,
    abandoned_eligible: 0,
    abandoned_results: [] as Array<{ order_id: string; status: string }>,
    cross_sell_considered: 0,
    cross_sell_results: [] as Array<{ order_id: string; status: string }>,
    marketing_enabled: lifecycleMarketingEnabled(),
    real_customer_emails_sent: "NONE_UNLESS_SEND_FLAG",
  };

  // Abandoned checkout candidates
  const { data: pendingOrders, error: pendingErr } = await service
    .from("christmas_orders")
    .select(
      "id,payment_status,fulfillment_status,product_key,package_key,amount_cents,currency,locale,email,created_at,paid_at,source_route,metadata",
    )
    .in("payment_status", ["pending", "draft"])
    .lt("created_at", cutoff)
    .not("email", "is", null)
    .limit(50);
  if (pendingErr) {
    return res.status(500).json({ error: pendingErr.message });
  }

  for (const raw of pendingOrders || []) {
    summary.abandoned_considered += 1;
    const order = mapOrder(raw as Record<string, unknown>);
    // Re-check payment (race: paid between query and send)
    const { data: fresh } = await service
      .from("christmas_orders")
      .select("payment_status")
      .eq("id", order.id)
      .maybeSingle();
    if (asString(fresh?.payment_status) === "paid") {
      summary.abandoned_results.push({
        order_id: order.id,
        status: "skipped_paid_race",
      });
      continue;
    }
    const elig = abandonedCheckoutEligibility({
      order,
      nowMs,
      delayMs,
    });
    if (!elig.eligible) {
      summary.abandoned_results.push({
        order_id: order.id,
        status: elig.reason,
      });
      continue;
    }
    summary.abandoned_eligible += 1;
    const result = await claimAndSendLifecycleEmail({
      service,
      template: "abandoned_checkout",
      order,
      productName: order.productKey,
      resumeUrl: abandonedResumePath(order),
      siteOrigin: origin,
    });
    summary.abandoned_results.push({
      order_id: order.id,
      status: result.status,
    });
  }

  // Cross-sell: completed paid orders older than 24h, only if marketing live + live targets
  if (lifecycleMarketingEnabled()) {
    const { data: products } = await service
      .from("christmas_packages")
      .select("product_key, purchasable, active")
      .eq("purchasable", true)
      .eq("active", true);
    const live = new Set(
      (products || [])
        .map((p) => asString((p as { product_key?: string }).product_key))
        .filter(Boolean),
    );
    const dayAgo = new Date(nowMs - 24 * 60 * 60 * 1000).toISOString();
    const { data: completed } = await service
      .from("christmas_orders")
      .select(
        "id,payment_status,fulfillment_status,product_key,package_key,amount_cents,currency,locale,email,created_at,paid_at,source_route,metadata",
      )
      .eq("payment_status", "paid")
      .eq("fulfillment_status", "completed")
      .lt("paid_at", dayAgo)
      .not("email", "is", null)
      .limit(30);

    for (const raw of completed || []) {
      summary.cross_sell_considered += 1;
      const order = mapOrder(raw as Record<string, unknown>);
      const targets = crossSellTargets({
        productKey: order.productKey,
        liveProductKeys: live,
      });
      if (!targets.length) {
        summary.cross_sell_results.push({
          order_id: order.id,
          status: "no_live_target",
        });
        continue;
      }
      const target = targets[0];
      const result = await claimAndSendLifecycleEmail({
        service,
        template: "cross_sell",
        order,
        productName: order.productKey,
        crossSellName: target,
        crossSellUrl: resultAccessPath({
          ...order,
          sourceRoute: `/christmas/${target.replace("christmas_", "").replace("_", "-")}`,
          publicTokenHint: null,
        }),
        eventSuffix: target,
        siteOrigin: origin,
      });
      summary.cross_sell_results.push({
        order_id: order.id,
        status: result.status,
      });
    }
  }

  return res.status(200).json({
    ok: true,
    ...summary,
    note: "Default dry-run unless CHRISTMAS_LIFECYCLE_SEND_ENABLED=true; marketing requires CHRISTMAS_LIFECYCLE_MARKETING_ENABLED=true",
  });
}
