/**
 * Node origin twin of supabase/functions/_shared/christmas/metaCapi.ts
 * Uses process.env; keeps claim → CAPI → finalize contract identical.
 */
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { asInt, asString, isUuid } from "./crypto";
import { siteOrigin } from "./constants";

export const TDG_META_PIXEL_ID = "1581639566935542";

export function christmasPurchaseEventId(orderId: string): string {
  return `christmas_purchase_${orderId}`;
}

export function sanitizeMetaClickId(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw || raw.length > 200) return null;
  if (!raw.startsWith("fb.")) return null;
  if (/[<>@\s]/.test(raw)) return null;
  if (!raw.includes(".")) return null;
  return raw;
}

export function parseChristmasMetaClickIds(raw: unknown): {
  fbc: string | null;
  fbp: string | null;
} {
  const row =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  return {
    fbc: sanitizeMetaClickId(row.fbc ?? row.meta_fbc),
    fbp: sanitizeMetaClickId(row.fbp ?? row.meta_fbp),
  };
}

function isCheckoutPlaceholderEmail(email: string | null | undefined): boolean {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) return false;
  return /^pending\+[a-z0-9_-]*@checkout\.thedigitalgifter\.com$/i.test(normalized);
}

async function hashCustomerEmailForMeta(email: string | null | undefined): Promise<string | null> {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized || isCheckoutPlaceholderEmail(normalized)) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return null;
  return createHash("sha256").update(normalized).digest("hex");
}

function christmasMetaCapiLiveAllowed(): boolean {
  const raw = asString(process.env.CHRISTMAS_META_CAPI_LIVE).toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
}

export function christmasMetaCapiTransmissionAllowed(): {
  allowed: boolean;
  reason?: string;
  testEventCode?: string | null;
} {
  const token = asString(process.env.META_CAPI_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN);
  if (!token) return { allowed: false, reason: "unconfigured" };
  const dryRun = asString(process.env.META_CAPI_DRY_RUN).toLowerCase();
  if (dryRun === "true" || dryRun === "1") return { allowed: false, reason: "dry_run" };
  const testCode = asString(process.env.META_TEST_EVENT_CODE) || null;
  if (testCode) return { allowed: true, testEventCode: testCode };
  if (christmasMetaCapiLiveAllowed()) return { allowed: true, testEventCode: null };
  return { allowed: false, reason: "live_gated" };
}

async function postMetaCapiPurchase(input: {
  eventId: string;
  orderId: string;
  email?: string | null;
  eventTime?: number;
  amountCents: number;
  currency: string;
  sku: string;
  fbc?: string | null;
  fbp?: string | null;
  clientIpAddress?: string | null;
  clientUserAgent?: string | null;
  testEventCode?: string | null;
}): Promise<{ sent: boolean; reason?: string; eventsReceived?: number }> {
  const pixelId = asString(process.env.META_PIXEL_ID || process.env.FACEBOOK_PIXEL_ID || TDG_META_PIXEL_ID);
  const token = asString(process.env.META_CAPI_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN);
  if (!pixelId || !token) return { sent: false, reason: "unconfigured" };
  if (!input.eventId || input.amountCents <= 0) return { sent: false, reason: "not_paid" };

  const value = input.amountCents / 100;
  const currency = (input.currency || "EUR").toUpperCase();
  const customData: Record<string, unknown> = {
    currency,
    value,
    content_ids: [input.sku],
    content_type: "product",
    contents: [{ id: input.sku, quantity: 1, item_price: value }],
    num_items: 1,
    order_id: input.orderId,
  };
  const customJson = JSON.stringify(customData);
  if (/https?:\/\//i.test(customJson) || /@/.test(customJson)) {
    return { sent: false, reason: "unsafe_custom_data" };
  }

  const hashedEmail = await hashCustomerEmailForMeta(input.email);
  const userData: Record<string, unknown> = {};
  if (hashedEmail) userData.em = [hashedEmail];
  const fbc = sanitizeMetaClickId(input.fbc);
  const fbp = sanitizeMetaClickId(input.fbp);
  if (fbc) userData.fbc = fbc;
  if (fbp) userData.fbp = fbp;
  const ip = asString(input.clientIpAddress);
  if (ip && ip.length <= 64) userData.client_ip_address = ip;
  const ua = asString(input.clientUserAgent);
  if (ua && ua.length <= 512) userData.client_user_agent = ua.slice(0, 512);

  const body: Record<string, unknown> = {
    data: [
      {
        event_name: "Purchase",
        event_time: input.eventTime || Math.floor(Date.now() / 1000),
        event_id: input.eventId,
        action_source: "website",
        event_source_url: `${siteOrigin()}/christmas-ai-photos/order`,
        user_data: userData,
        custom_data: customData,
      },
    ],
  };
  const testCode = asString(input.testEventCode) || asString(process.env.META_TEST_EVENT_CODE);
  if (testCode) body.test_event_code = testCode;

  const res = await fetch(`https://graph.facebook.com/v21.0/${pixelId}/events`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Meta CAPI failed (${res.status}): ${text.slice(0, 180)}`);
  }
  let eventsReceived: number | undefined;
  try {
    const parsed = JSON.parse(text) as { events_received?: number };
    if (typeof parsed.events_received === "number") eventsReceived = parsed.events_received;
  } catch {
    /* empty */
  }
  return { sent: true, eventsReceived };
}

export async function emitChristmasV2MetaPurchase(
  service: SupabaseClient,
  orderId: string,
  options?: {
    clientIpAddress?: string | null;
    clientUserAgent?: string | null;
  },
): Promise<{ sent: boolean; reason?: string; status?: string }> {
  if (!isUuid(orderId)) return { sent: false, reason: "invalid_order" };

  const eventId = christmasPurchaseEventId(orderId);

  try {
    const { data: order, error: orderErr } = await service
      .from("christmas_v2_orders")
      .select(
        "id, email, paid_at, charged_amount_cents, amount_cents, currency, sku, meta_event_id, meta_purchase_sent_at",
      )
      .eq("id", orderId)
      .maybeSingle();
    if (orderErr || !order) return { sent: false, reason: "order_not_found" };
    if (!order.paid_at) return { sent: false, reason: "not_paid" };
    if (order.meta_purchase_sent_at) {
      return { sent: false, reason: "already_sent", status: "deduplicated" };
    }

    const amountCents = asInt(order.charged_amount_cents ?? order.amount_cents);
    if (amountCents <= 0) return { sent: false, reason: "not_paid" };
    const currency = asString(order.currency).toLowerCase() || "eur";
    const sku = asString(order.sku);
    const stableEventId = asString(order.meta_event_id) || eventId;
    const orderEmail = asString(order.email) || null;

    const { data: claimRaw, error: claimErr } = await service.rpc(
      "christmas_v2_claim_meta_purchase_delivery",
      {
        p_order_id: orderId,
        p_event_id: stableEventId,
        p_amount_cents: amountCents,
        p_currency: currency,
        p_sku: sku,
      },
    );
    if (claimErr) {
      console.error("christmas_v2 meta claim failed", { orderId, message: claimErr.message });
      return { sent: false, reason: "claim_error" };
    }

    const claim = (typeof claimRaw === "string" ? JSON.parse(claimRaw) : claimRaw) as {
      claim?: boolean;
      reason?: string;
      event_id?: string;
      amount_cents?: number;
      currency?: string;
      sku?: string;
      fbc?: string | null;
      fbp?: string | null;
      paid_at?: string | null;
      attempt_count?: number;
    };

    if (!claim?.claim) {
      return { sent: false, reason: claim?.reason || "not_claimed", status: claim?.reason };
    }

    const gate = christmasMetaCapiTransmissionAllowed();
    if (!gate.allowed) {
      await service.rpc("christmas_v2_finalize_meta_purchase_delivery", {
        p_order_id: orderId,
        p_status: "skipped",
        p_last_error: gate.reason || "skipped",
      });
      return { sent: false, reason: gate.reason || "skipped", status: "skipped" };
    }

    const paidAt = claim.paid_at ? Math.floor(new Date(claim.paid_at).getTime() / 1000) : undefined;
    let capiResult: { sent: boolean; reason?: string; eventsReceived?: number };
    try {
      capiResult = await postMetaCapiPurchase({
        eventId: asString(claim.event_id) || stableEventId,
        orderId,
        email: orderEmail,
        eventTime: paidAt,
        amountCents: asInt(claim.amount_cents) || amountCents,
        currency: asString(claim.currency) || currency,
        sku: asString(claim.sku) || sku,
        fbc: claim.fbc,
        fbp: claim.fbp,
        clientIpAddress: options?.clientIpAddress,
        clientUserAgent: options?.clientUserAgent,
        testEventCode: gate.testEventCode,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const permanently = (claim.attempt_count || 0) >= 5;
      await service.rpc("christmas_v2_finalize_meta_purchase_delivery", {
        p_order_id: orderId,
        p_status: permanently ? "permanently_failed" : "failed",
        p_last_error: message.slice(0, 180),
      });
      console.error("christmas_v2 meta CAPI error", {
        orderId,
        attempt: claim.attempt_count,
      });
      return {
        sent: false,
        reason: "capi_error",
        status: permanently ? "permanently_failed" : "failed",
      };
    }

    if (capiResult.sent) {
      await service.rpc("christmas_v2_finalize_meta_purchase_delivery", {
        p_order_id: orderId,
        p_status: "sent",
        p_events_received: capiResult.eventsReceived ?? null,
      });
      return { sent: true, status: "sent" };
    }

    const skipStatus =
      capiResult.reason === "duplicate" || capiResult.reason === "unconfigured"
        ? "skipped"
        : "failed";
    await service.rpc("christmas_v2_finalize_meta_purchase_delivery", {
      p_order_id: orderId,
      p_status: skipStatus,
      p_last_error: capiResult.reason || "not_sent",
    });
    return { sent: false, reason: capiResult.reason, status: skipStatus };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("christmas_v2 meta purchase emit failed", {
      orderId,
      message: message.slice(0, 180),
    });
    return { sent: false, reason: "emit_error" };
  }
}

export async function persistChristmasMetaClickIds(
  service: SupabaseClient,
  orderId: string,
  raw: unknown,
): Promise<void> {
  if (!isUuid(orderId)) return;
  const ids = parseChristmasMetaClickIds(raw);
  if (!ids.fbc && !ids.fbp) return;
  const patch: Record<string, string> = {};
  if (ids.fbc) patch.meta_fbc = ids.fbc;
  if (ids.fbp) patch.meta_fbp = ids.fbp;
  await service.from("christmas_v2_orders").update(patch).eq("id", orderId);
}
