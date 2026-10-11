/**
 * Christmas V2 Meta Purchase CAPI · reuses pet hashing/click-id helpers.
 * Purchase fires only after server-verified paid fulfill; never blocks payment.
 * Credentials: META_CAPI_ACCESS_TOKEN (server secret only). Never log tokens/fbc/fbp/email.
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  sanitizeMetaClickId,
  sendMetaCapiPurchase,
  metaTestEventCodeConfigured,
} from "../pet/meta.ts";
import { asInt, asString, isUuid } from "./crypto.ts";
import { siteOrigin } from "./constants.ts";

export function christmasPurchaseEventId(orderId: string): string {
  return `christmas_purchase_${orderId}`;
}

type RpcClient = Pick<SupabaseClient, "rpc">;

function christmasMetaCapiLiveAllowed(): boolean {
  const raw = asString(Deno.env.get("CHRISTMAS_META_CAPI_LIVE")).toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
}

/** Refuse live Ads dataset writes unless explicitly enabled or test_event_code is set. */
export function christmasMetaCapiTransmissionAllowed(): {
  allowed: boolean;
  reason?: string;
  testEventCode?: string | null;
} {
  const token = asString(
    Deno.env.get("META_CAPI_ACCESS_TOKEN") || Deno.env.get("META_ACCESS_TOKEN"),
  );
  if (!token) return { allowed: false, reason: "unconfigured" };

  const dryRun = asString(Deno.env.get("META_CAPI_DRY_RUN")).toLowerCase();
  if (dryRun === "true" || dryRun === "1") return { allowed: false, reason: "dry_run" };

  const testCode = asString(Deno.env.get("META_TEST_EVENT_CODE")) || null;
  if (testCode) return { allowed: true, testEventCode: testCode };
  if (christmasMetaCapiLiveAllowed()) return { allowed: true, testEventCode: null };
  return { allowed: false, reason: "live_gated" };
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

/**
 * Durable claim → CAPI → finalize. Safe to call from webhook + confirm race.
 * Never throws to the payment path. Does not send mock/fabricated conversions
 * to a live production dataset (requires TEST code or CHRISTMAS_META_CAPI_LIVE).
 */
export async function emitChristmasV2MetaPurchase(
  service: RpcClient,
  orderId: string,
  options?: {
    clientIpAddress?: string | null;
    clientUserAgent?: string | null;
  },
): Promise<{ sent: boolean; reason?: string; status?: string }> {
  if (!isUuid(orderId)) return { sent: false, reason: "invalid_order" };

  const eventId = christmasPurchaseEventId(orderId);

  try {
    // Lightweight pre-read for amount/sku (claim also validates paid_at).
    const { data: order, error: orderErr } = await (service as SupabaseClient)
      .from("christmas_v2_orders")
      .select(
        "id, email, paid_at, charged_amount_cents, amount_cents, currency, sku, meta_event_id, meta_purchase_sent_at, parent_order_id",
      )
      .eq("id", orderId)
      .maybeSingle();
    if (orderErr || !order) return { sent: false, reason: "order_not_found" };
    if (!order.paid_at) return { sent: false, reason: "not_paid" };
    if (order.meta_purchase_sent_at) return { sent: false, reason: "already_sent", status: "deduplicated" };

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
      capiResult = await sendMetaCapiPurchase({
        eventId: asString(claim.event_id) || stableEventId,
        orderId,
        email: orderEmail,
        eventTime: paidAt,
        sourceUrl: `${siteOrigin()}/christmas-ai-photos/order`,
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
        // Never log email/fbc/fbp/token
        has_test_event: metaTestEventCodeConfigured(),
      });
      return { sent: false, reason: "capi_error", status: permanently ? "permanently_failed" : "failed" };
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
    console.error("christmas_v2 meta purchase emit failed", { orderId, message: message.slice(0, 180) });
    return { sent: false, reason: "emit_error" };
  }
}

/** Persist sanitized fbc/fbp on the order before checkout (never log values). */
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
