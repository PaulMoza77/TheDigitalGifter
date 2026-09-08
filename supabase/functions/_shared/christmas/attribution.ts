/**
 * Christmas checkout → purchase attribution join.
 * Reuses pet sendMetaCapiPurchase (do not add a second CAPI client).
 * First-touch wins; never wipe affiliate_ref.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  parseMetaCapiClickIds,
  sanitizeMetaClickId,
  sendMetaCapiPurchase,
} from "../pet/meta.ts";
import { siteOrigin } from "./constants.ts";
import { asString, isUuid } from "./crypto.ts";

export function christmasPurchaseEventId(orderId: string): string {
  const id = asString(orderId);
  return id ? `xmas_purchase_${id}` : "";
}

export type ChristmasAttr = {
  landing_path: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  affiliate_ref: string | null;
  campaign_id: string | null;
  adset_id: string | null;
  ad_id: string | null;
  funnel_session_id: string | null;
  has_meta_click: boolean;
  fbc: string | null;
  fbp: string | null;
};

function clip(value: unknown, max = 120): string | null {
  const s = asString(value);
  if (!s) return null;
  if (/[<>]/.test(s) || /@/.test(s) || /^https?:/i.test(s)) return null;
  return s.slice(0, max);
}

export function coalesceChristmasAttribution(
  existing: Partial<ChristmasAttr> | null | undefined,
  incoming: Partial<ChristmasAttr> | null | undefined,
): ChristmasAttr {
  const prev = existing || {};
  const next = incoming || {};
  const pick = (key: keyof Omit<ChristmasAttr, "has_meta_click" | "fbc" | "fbp">) =>
    clip(prev[key]) || clip(next[key]) || null;
  return {
    landing_path: pick("landing_path"),
    utm_source: pick("utm_source"),
    utm_medium: pick("utm_medium"),
    utm_campaign: pick("utm_campaign"),
    utm_content: pick("utm_content"),
    utm_term: pick("utm_term"),
    affiliate_ref: pick("affiliate_ref"),
    campaign_id: pick("campaign_id"),
    adset_id: pick("adset_id"),
    ad_id: pick("ad_id"),
    funnel_session_id: pick("funnel_session_id"),
    has_meta_click: Boolean(prev.has_meta_click || next.has_meta_click),
    fbc: sanitizeMetaClickId(prev.fbc) || sanitizeMetaClickId(next.fbc),
    fbp: sanitizeMetaClickId(prev.fbp) || sanitizeMetaClickId(next.fbp),
  };
}

export function attributionFromClientBody(body: Record<string, unknown>): ChristmasAttr {
  const click = parseMetaCapiClickIds(body);
  return {
    landing_path: clip(body.landing_path),
    utm_source: clip(body.utm_source),
    utm_medium: clip(body.utm_medium),
    utm_campaign: clip(body.utm_campaign),
    utm_content: clip(body.utm_content),
    utm_term: clip(body.utm_term),
    affiliate_ref: clip(body.affiliate_ref),
    campaign_id: clip(body.campaign_id),
    adset_id: clip(body.adset_id),
    ad_id: clip(body.ad_id),
    funnel_session_id: isUuid(body.funnel_session_id) ? asString(body.funnel_session_id) : null,
    has_meta_click: click.hasMetaClick || body.has_meta_click === true || asString(body.has_meta_click) === "1",
    fbc: click.fbc,
    fbp: click.fbp,
  };
}

export function attributionFromOrderRow(row: Record<string, unknown> | null | undefined): ChristmasAttr {
  const meta =
    row?.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {};
  const click = parseMetaCapiClickIds({ ...meta, ...row });
  return {
    landing_path: clip(row?.landing_path),
    utm_source: clip(row?.utm_source),
    utm_medium: clip(row?.utm_medium),
    utm_campaign: clip(row?.utm_campaign),
    utm_content: clip(row?.utm_content),
    utm_term: clip(row?.utm_term),
    affiliate_ref: clip(row?.affiliate_ref),
    campaign_id: clip(row?.campaign_id),
    adset_id: clip(row?.adset_id),
    ad_id: clip(row?.ad_id),
    funnel_session_id: isUuid(row?.funnel_session_id) ? asString(row?.funnel_session_id) : null,
    has_meta_click: click.hasMetaClick || row?.has_meta_click === true,
    fbc: click.fbc,
    fbp: click.fbp,
  };
}

export function attributionFromStripeMetadata(metadata: Record<string, unknown>): ChristmasAttr {
  const click = parseMetaCapiClickIds(metadata);
  return {
    landing_path: clip(metadata.landing_path),
    utm_source: clip(metadata.utm_source),
    utm_medium: clip(metadata.utm_medium),
    utm_campaign: clip(metadata.utm_campaign),
    utm_content: clip(metadata.utm_content),
    utm_term: clip(metadata.utm_term),
    affiliate_ref: clip(metadata.affiliate_ref),
    campaign_id: clip(metadata.campaign_id),
    adset_id: clip(metadata.adset_id),
    ad_id: clip(metadata.ad_id),
    funnel_session_id: isUuid(metadata.funnel_session_id) ? asString(metadata.funnel_session_id) : null,
    has_meta_click: click.hasMetaClick || asString(metadata.has_meta_click) === "1",
    fbc: click.fbc,
    fbp: click.fbp,
  };
}

export function applyChristmasCheckoutAttributionMetadata(
  params: URLSearchParams,
  attr: ChristmasAttr,
  orderId: string,
) {
  const eventId = christmasPurchaseEventId(orderId);
  if (eventId) {
    params.set("metadata[meta_event_id]", eventId);
    params.set("payment_intent_data[metadata][meta_event_id]", eventId);
  }
  for (const [key, value] of [
    ["utm_source", attr.utm_source],
    ["utm_medium", attr.utm_medium],
    ["utm_campaign", attr.utm_campaign],
    ["utm_content", attr.utm_content],
    ["utm_term", attr.utm_term],
    ["campaign_id", attr.campaign_id],
    ["adset_id", attr.adset_id],
    ["ad_id", attr.ad_id],
    ["affiliate_ref", attr.affiliate_ref],
    ["landing_path", attr.landing_path],
    ["funnel_session_id", attr.funnel_session_id],
  ] as const) {
    if (value) params.set(`metadata[${key}]`, value.slice(0, 500));
  }
  if (attr.fbc) params.set("metadata[meta_fbc]", attr.fbc.slice(0, 200));
  if (attr.fbp) params.set("metadata[meta_fbp]", attr.fbp.slice(0, 200));
  if (attr.has_meta_click) params.set("metadata[has_meta_click]", "1");
}

export function orderAttributionColumns(attr: ChristmasAttr) {
  return {
    landing_path: attr.landing_path,
    utm_source: attr.utm_source,
    utm_medium: attr.utm_medium,
    utm_campaign: attr.utm_campaign,
    utm_content: attr.utm_content,
    utm_term: attr.utm_term,
    affiliate_ref: attr.affiliate_ref,
    campaign_id: attr.campaign_id,
    adset_id: attr.adset_id,
    ad_id: attr.ad_id,
    funnel_session_id: attr.funnel_session_id,
  };
}

async function loadSessionAttribution(
  service: SupabaseClient,
  sessionId: string,
): Promise<Partial<ChristmasAttr> | null> {
  if (!isUuid(sessionId)) return null;
  const { data } = await service
    .from("christmas_funnel_events")
    .select(
      "utm_source, utm_medium, utm_campaign, utm_content, utm_term, affiliate_ref, campaign_id, adset_id, ad_id, has_meta_click, referrer_host, landing_path, funnel_session_id",
    )
    .eq("funnel_session_id", sessionId)
    .order("created_at", { ascending: true })
    .limit(5);
  const rows = Array.isArray(data) ? data : [];
  if (rows.length === 0) return null;
  let merged: Partial<ChristmasAttr> = {};
  for (const row of rows) {
    merged = coalesceChristmasAttribution(merged as ChristmasAttr, {
      landing_path: clip(row.landing_path),
      utm_source: clip(row.utm_source),
      utm_medium: clip(row.utm_medium),
      utm_campaign: clip(row.utm_campaign),
      utm_content: clip(row.utm_content),
      utm_term: clip(row.utm_term),
      affiliate_ref: clip(row.affiliate_ref),
      campaign_id: clip(row.campaign_id),
      adset_id: clip(row.adset_id),
      ad_id: clip(row.ad_id),
      funnel_session_id: isUuid(row.funnel_session_id) ? asString(row.funnel_session_id) : null,
      has_meta_click: row.has_meta_click === true,
      fbc: null,
      fbp: null,
    });
  }
  return merged;
}

export async function joinAndSendChristmasPurchase(input: {
  service: SupabaseClient;
  orderId: string;
  metadata: Record<string, unknown>;
}): Promise<{ sent: boolean; eventId: string; reason?: string }> {
  const eventId = christmasPurchaseEventId(input.orderId);
  const { data: order } = await input.service
    .from("christmas_orders")
    .select(
      "id, email, product_key, package_key, sku, amount_cents, currency, metadata, affiliate_ref, landing_path, utm_source, utm_medium, utm_campaign, utm_content, utm_term, campaign_id, adset_id, ad_id, funnel_session_id, source_route",
    )
    .eq("id", input.orderId)
    .maybeSingle();
  if (!order) return { sent: false, eventId, reason: "order_not_found" };

  const meta =
    order.metadata && typeof order.metadata === "object" && !Array.isArray(order.metadata)
      ? (order.metadata as Record<string, unknown>)
      : {};
  const alreadySentAt = asString(meta.meta_purchase_sent_at) || null;

  let attr = coalesceChristmasAttribution(
    attributionFromOrderRow(order as Record<string, unknown>),
    attributionFromStripeMetadata(input.metadata),
  );
  const sessionId = attr.funnel_session_id || asString(order.funnel_session_id);
  if (sessionId) {
    const fromEvents = await loadSessionAttribution(input.service, sessionId);
    attr = coalesceChristmasAttribution(attr, fromEvents);
  }

  if (sessionId && isUuid(sessionId)) {
    const { error: purchaseEventError } = await input.service.from("christmas_funnel_events").insert({
      event_name: "purchase",
      funnel_session_id: sessionId,
      idempotency_key: `purchase:${input.orderId}`,
      product_key: asString(order.product_key) || null,
      package_key: asString(order.package_key) || null,
      order_id: input.orderId,
      amount_cents: Number(order.amount_cents) || null,
      utm_source: attr.utm_source,
      utm_medium: attr.utm_medium,
      utm_campaign: attr.utm_campaign,
      utm_content: attr.utm_content,
      utm_term: attr.utm_term,
      affiliate_ref: attr.affiliate_ref,
      campaign_id: attr.campaign_id,
      adset_id: attr.adset_id,
      ad_id: attr.ad_id,
      has_meta_click: attr.has_meta_click,
      landing_path: attr.landing_path,
      metadata: { source: "stripe_fulfill", meta_event_id: eventId },
    });
    if (
      purchaseEventError &&
      purchaseEventError.code !== "23505" &&
      !/duplicate|unique/i.test(String(purchaseEventError.message || ""))
    ) {
      console.error("christmas purchase event write failed", purchaseEventError.message);
    }
  }

  const amountCents = Number(order.amount_cents) || 0;
  const sourcePath = asString(order.source_route) || "/christmas";
  try {
    const capi = await sendMetaCapiPurchase({
      eventId,
      orderId: input.orderId,
      email: order.email,
      alreadySentAt,
      sourceUrl: `${siteOrigin()}${sourcePath.startsWith("/") ? sourcePath : `/${sourcePath}`}`,
      amountCents,
      sku: asString(order.sku) || asString(input.metadata.sku) || undefined,
      currency: asString(order.currency) || undefined,
      fbc: attr.fbc,
      fbp: attr.fbp,
    });
    if (capi.sent) {
      await input.service
        .from("christmas_orders")
        .update({
          metadata: {
            ...meta,
            meta_event_id: eventId,
            meta_purchase_sent_at: new Date().toISOString(),
            has_meta_click: attr.has_meta_click,
          },
        })
        .eq("id", input.orderId);
    }
    return { sent: capi.sent, eventId, reason: capi.reason };
  } catch (err) {
    console.error("christmas CAPI purchase failed", err instanceof Error ? err.message : "error");
    return { sent: false, eventId, reason: "capi_error" };
  }
}
