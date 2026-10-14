import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  MEMORIES_PRODUCT_FAMILY,
  MEMORIES_PRODUCT_TYPE,
  isMemoriesPlanKey,
  type MemoriesPlanKey,
} from "./constants.ts";
import { notifyFounderFirstSale, sendMemoriesLifecycleEmail, sendMemoriesSubscriptionEmail } from "./email.ts";
import { asInt, asString, isUuid } from "../christmas/crypto.ts";

export function isMemoriesCheckoutMetadata(metadata: Record<string, unknown>): boolean {
  const family = asString(metadata.product_family);
  const productType = asString(metadata.product_type);
  const sku = asString(metadata.sku);
  return (
    family === MEMORIES_PRODUCT_FAMILY ||
    productType === MEMORIES_PRODUCT_TYPE ||
    productType === "memories" ||
    sku.startsWith("memories-")
  );
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function livemode(obj: Record<string, unknown>): boolean {
  return obj.livemode === true;
}

async function syncSubscriptionRow(
  service: SupabaseClient,
  input: {
    stripeSubscriptionId: string;
    status: string;
    cancelAtPeriodEnd?: boolean;
    periodStart?: number | null;
    periodEnd?: number | null;
    canceledAt?: number | null;
    priceId?: string | null;
    customerId?: string | null;
  },
) {
  const patch: Record<string, unknown> = {
    status: input.status,
    updated_at: new Date().toISOString(),
  };
  if (typeof input.cancelAtPeriodEnd === "boolean") {
    patch.cancel_at_period_end = input.cancelAtPeriodEnd;
  }
  if (input.periodStart) patch.current_period_start = new Date(input.periodStart * 1000).toISOString();
  if (input.periodEnd) patch.current_period_end = new Date(input.periodEnd * 1000).toISOString();
  if (input.canceledAt) patch.canceled_at = new Date(input.canceledAt * 1000).toISOString();
  if (input.priceId) patch.stripe_price_id = input.priceId;
  if (input.customerId) patch.stripe_customer_id = input.customerId;

  await service
    .from("memories_subscriptions")
    .update(patch)
    .eq("stripe_subscription_id", input.stripeSubscriptionId);

  const orderStatus =
    input.status === "canceled"
      ? "canceled"
      : input.status === "past_due" || input.status === "unpaid"
        ? "past_due"
        : input.status === "active" || input.status === "trialing"
          ? "active"
          : null;
  if (orderStatus) {
    await service
      .from("memories_orders")
      .update({
        status: orderStatus,
        canceled_at: orderStatus === "canceled" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("stripe_subscription_id", input.stripeSubscriptionId);
  }
}

export async function handleMemoriesStripeEvent(input: {
  service: SupabaseClient;
  eventId: string;
  eventType: string;
  obj: Record<string, unknown>;
  metadata: Record<string, unknown>;
}): Promise<Response | null> {
  const meta = input.metadata;
  const objMeta = (input.obj.metadata || {}) as Record<string, unknown>;
  const merged = { ...objMeta, ...meta };

  // Subscription lifecycle may carry memories metadata on the subscription object
  if (
    input.eventType.startsWith("customer.subscription.") ||
    input.eventType === "invoice.paid" ||
    input.eventType === "invoice.payment_failed" ||
    input.eventType === "charge.refunded" ||
    input.eventType === "refund.created"
  ) {
    const subId =
      asString(input.obj.subscription) ||
      (input.eventType.startsWith("customer.subscription.") ? asString(input.obj.id) : "");
    if (subId) {
      const { data: existingSub } = await input.service
        .from("memories_subscriptions")
        .select("id, order_id, customer_id, plan_key")
        .eq("stripe_subscription_id", subId)
        .maybeSingle();
      if (existingSub || isMemoriesCheckoutMetadata(merged)) {
        // continue
      } else if (!isMemoriesCheckoutMetadata(merged)) {
        return null;
      }
    } else if (!isMemoriesCheckoutMetadata(merged)) {
      return null;
    }
  } else if (!isMemoriesCheckoutMetadata(merged)) {
    return null;
  }

  if (input.eventType === "customer.subscription.updated" || input.eventType === "customer.subscription.created") {
    const items = (input.obj.items as { data?: Array<{ price?: { id?: string } }> } | undefined)?.data;
    await syncSubscriptionRow(input.service, {
      stripeSubscriptionId: asString(input.obj.id),
      status: asString(input.obj.status) || "incomplete",
      cancelAtPeriodEnd: input.obj.cancel_at_period_end === true,
      periodStart: typeof input.obj.current_period_start === "number" ? input.obj.current_period_start : null,
      periodEnd: typeof input.obj.current_period_end === "number" ? input.obj.current_period_end : null,
      canceledAt: typeof input.obj.canceled_at === "number" ? input.obj.canceled_at : null,
      priceId: items?.[0]?.price?.id || null,
      customerId: asString(input.obj.customer) || null,
    });
    await input.service.from("processed_stripe_events").insert({
      event_id: input.eventId,
      event_type: input.eventType,
      result: { status: "memories_subscription_synced", subscription_id: asString(input.obj.id) },
    });
    return json({ ok: true, status: "memories_subscription_synced" });
  }

  if (input.eventType === "customer.subscription.deleted") {
    await syncSubscriptionRow(input.service, {
      stripeSubscriptionId: asString(input.obj.id),
      status: "canceled",
      cancelAtPeriodEnd: false,
      canceledAt: Math.floor(Date.now() / 1000),
    });
    const { data: sub } = await input.service
      .from("memories_subscriptions")
      .select("order_id, customer_id")
      .eq("stripe_subscription_id", asString(input.obj.id))
      .maybeSingle();
    if (sub?.order_id) {
      const { data: order } = await input.service
        .from("memories_orders")
        .select("email, customer_id")
        .eq("id", sub.order_id)
        .maybeSingle();
      if (order?.email) {
        await sendMemoriesLifecycleEmail({
          service: input.service,
          email: order.email,
          customerId: order.customer_id,
          orderId: sub.order_id,
          kind: "cancellation_confirmation",
          subject: "Memories subscription canceled",
          message:
            "Your Memories subscription has been canceled. No further charges will be made. Uploaded materials remain subject to our retention and deletion policy.",
        }).catch(() => undefined);
      }
    }
    await input.service.from("processed_stripe_events").insert({
      event_id: input.eventId,
      event_type: input.eventType,
      result: { status: "memories_subscription_canceled" },
    });
    return json({ ok: true, status: "memories_subscription_canceled" });
  }

  if (input.eventType === "invoice.payment_failed") {
    const subId = asString(input.obj.subscription);
    if (subId) {
      await syncSubscriptionRow(input.service, {
        stripeSubscriptionId: subId,
        status: "past_due",
      });
      const { data: sub } = await input.service
        .from("memories_subscriptions")
        .select("order_id")
        .eq("stripe_subscription_id", subId)
        .maybeSingle();
      if (sub?.order_id) {
        const { data: order } = await input.service
          .from("memories_orders")
          .select("email, customer_id")
          .eq("id", sub.order_id)
          .maybeSingle();
        if (order?.email) {
          await sendMemoriesLifecycleEmail({
            service: input.service,
            email: order.email,
            customerId: order.customer_id,
            orderId: sub.order_id,
            kind: "payment_failed",
            subject: "Memories payment failed",
            message:
              "We could not process your latest Memories subscription payment. Please update your payment method in the billing portal to avoid interruption of early-access membership.",
          }).catch(() => undefined);
        }
      }
    }
    await input.service.from("processed_stripe_events").insert({
      event_id: input.eventId,
      event_type: input.eventType,
      result: { status: "memories_payment_failed" },
    });
    return json({ ok: true, status: "memories_payment_failed" });
  }

  if (input.eventType === "charge.refunded" || input.eventType === "refund.created") {
    const subId = asString(input.obj.subscription);
    const orderId = asString(merged.order_id);
    let targetOrderId = isUuid(orderId) ? orderId : null;
    if (!targetOrderId && subId) {
      const { data: sub } = await input.service
        .from("memories_subscriptions")
        .select("order_id")
        .eq("stripe_subscription_id", subId)
        .maybeSingle();
      targetOrderId = sub?.order_id || null;
    }
    if (targetOrderId) {
      await input.service
        .from("memories_orders")
        .update({
          status: "refunded",
          payment_status: "refunded",
          refunded_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", targetOrderId);
      const { data: order } = await input.service
        .from("memories_orders")
        .select("email, customer_id")
        .eq("id", targetOrderId)
        .maybeSingle();
      if (order?.email) {
        await sendMemoriesLifecycleEmail({
          service: input.service,
          email: order.email,
          customerId: order.customer_id,
          orderId: targetOrderId,
          kind: "refund_confirmation",
          subject: "Memories refund confirmed",
          message: "A refund related to your Memories subscription has been processed by Stripe.",
        }).catch(() => undefined);
      }
    }
    await input.service.from("processed_stripe_events").insert({
      event_id: input.eventId,
      event_type: input.eventType,
      result: { status: "memories_refunded", order_id: targetOrderId },
    });
    return json({ ok: true, status: "memories_refunded" });
  }

  if (
    input.eventType === "checkout.session.completed" ||
    input.eventType === "checkout.session.async_payment_succeeded" ||
    input.eventType === "invoice.paid"
  ) {
    const orderId = asString(merged.order_id);
    if (!isUuid(orderId)) {
      await input.service.from("processed_stripe_events").insert({
        event_id: input.eventId,
        event_type: input.eventType,
        result: { status: "ignored", reason: "memories_missing_order_id" },
      });
      return json({ ok: true, status: "ignored", reason: "memories_missing_order_id" });
    }

    const amount =
      asInt(input.obj.amount_total) ||
      asInt(input.obj.amount_paid) ||
      asInt(merged.amount_cents);
    const isLive = livemode(input.obj);
    const subscriptionId =
      asString(input.obj.subscription) || asString(merged.subscription_id);
    const customerId = asString(input.obj.customer) || asString(merged.stripe_customer_id);
    const priceId = asString(merged.stripe_price_id) || asString(merged.price_id);

    const { data, error } = await input.service.rpc("fulfill_memories_subscription_payment", {
      p_event_id: input.eventId,
      p_event_type: input.eventType,
      p_session_id: asString(input.obj.id),
      p_subscription_id: subscriptionId,
      p_customer_id: customerId,
      p_payment_status: asString(input.obj.payment_status) || "paid",
      p_amount_cents: amount,
      p_currency: asString(input.obj.currency) || "usd",
      p_order_id: orderId,
      p_is_live: isLive,
      p_price_id: priceId || null,
      p_subscription_status: "active",
      p_period_start: null,
      p_period_end: null,
      p_invoice_id: input.eventType === "invoice.paid" ? asString(input.obj.id) : null,
    });
    if (error) throw error;

    const { data: order } = await input.service
      .from("memories_orders")
      .select("email, customer_id, plan_key")
      .eq("id", orderId)
      .maybeSingle();
    if (order?.email && isMemoriesPlanKey(order.plan_key)) {
      await sendMemoriesSubscriptionEmail({
        service: input.service,
        email: order.email,
        customerId: order.customer_id,
        orderId,
        planKey: order.plan_key as MemoriesPlanKey,
      }).catch(() => undefined);
    }

    if (data?.first_sale === true) {
      await notifyFounderFirstSale({
        orderId,
        amountCents: amount,
        currency: asString(input.obj.currency) || "usd",
        planKey: asString(order?.plan_key) || asString(merged.plan_key),
      }).catch(() => undefined);
      await input.service
        .from("memories_milestones")
        .update({ notified_at: new Date().toISOString() })
        .eq("milestone_key", "MEMORIES_FIRST_SALE_VERIFIED");
    }

    return json({ ok: true, result: data });
  }

  return null;
}
