/**
 * Node/API Christmas lifecycle sender.
 * Uses src/features/christmas/lifecycle/lifecycleCore for pure logic.
 * Default: dry-run ledger only unless CHRISTMAS_LIFECYCLE_SEND_ENABLED=true.
 * Marketing additionally requires CHRISTMAS_LIFECYCLE_MARKETING_ENABLED=true + consent.
 *
 * RPC contract must match claim_christmas_lifecycle_event migration
 * (p_email_normalized — not hash / dry_run params).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  LIFECYCLE_TEMPLATE_CATEGORY,
  lifecycleEmailCopy,
  lifecycleEventKey,
  marketingSendAllowed,
  resolvePersistedOrderLocale,
  type ChristmasLifecycleTemplate,
  type ChristmasOrderLifecycleView,
} from "../../../src/features/christmas/lifecycle/lifecycleCore";

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function lifecycleSendEnabled(): boolean {
  return asString(process.env.CHRISTMAS_LIFECYCLE_SEND_ENABLED).toLowerCase() === "true";
}

export function lifecycleMarketingEnabled(): boolean {
  return (
    asString(process.env.CHRISTMAS_LIFECYCLE_MARKETING_ENABLED).toLowerCase() ===
    "true"
  );
}

export async function lookupMarketingConsent(
  service: SupabaseClient,
  email: string | null,
): Promise<boolean | null> {
  if (!email) return null;
  const { data } = await service
    .from("email_preferences")
    .select("marketing")
    .eq("email", normalizeEmail(email))
    .maybeSingle();
  if (!data) return null;
  return data.marketing !== false;
}

export async function recordChristmasLifecycleAnalytics(
  service: SupabaseClient,
  input: {
    eventName: string;
    orderId: string;
    productKey: string;
    locale: string;
    template: string;
    status: string;
  },
): Promise<void> {
  try {
    const idempotencyKey = `lifecycle:${input.eventName}:${input.orderId}:${input.template}:${input.status}`;
    await service.from("christmas_funnel_events").upsert(
      {
        event_name: input.eventName,
        funnel_session_id: "00000000-0000-4000-8000-000000000001",
        idempotency_key: idempotencyKey,
        product_key: input.productKey,
        order_id: input.orderId,
        locale: input.locale,
        pathname: "/lifecycle/email",
        is_test: asString(process.env.VERCEL_ENV) !== "production",
        environment: asString(process.env.VERCEL_ENV) || "api",
        metadata: {
          template: input.template,
          status: input.status,
          source: "christmas_lifecycle",
        },
      },
      { onConflict: "idempotency_key", ignoreDuplicates: true },
    );
  } catch {
    /* analytics best-effort */
  }
}

async function finalizeEventStatus(
  service: SupabaseClient,
  eventKey: string,
  patch: Record<string, unknown>,
): Promise<void> {
  await service
    .from("christmas_lifecycle_events")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("event_key", eventKey);
}

export async function claimAndSendLifecycleEmail(input: {
  service: SupabaseClient;
  template: ChristmasLifecycleTemplate;
  order: ChristmasOrderLifecycleView;
  productName: string;
  resultUrl?: string;
  resumeUrl?: string;
  crossSellName?: string;
  crossSellUrl?: string;
  eventSuffix?: string;
  siteOrigin: string;
}): Promise<{
  status: string;
  claimed: boolean;
  dryRun: boolean;
  eventKey: string;
  reason?: string;
}> {
  const category = LIFECYCLE_TEMPLATE_CATEGORY[input.template];
  const locale = resolvePersistedOrderLocale(input.order.locale);
  const eventKey = lifecycleEventKey(
    input.template,
    input.order.id,
    input.eventSuffix,
  );
  const email = asString(input.order.email)
    ? normalizeEmail(asString(input.order.email))
    : "";

  if (category === "marketing") {
    const consent = await lookupMarketingConsent(input.service, email || null);
    const gate = marketingSendAllowed({
      marketingEnabled: lifecycleMarketingEnabled(),
      marketingConsent: consent,
    });
    if (!gate.ok) {
      const { data: claim } = await input.service.rpc(
        "claim_christmas_lifecycle_event",
        {
          p_event_key: eventKey,
          p_template_key: input.template,
          p_category: category,
          p_order_id: input.order.id,
          p_product_key: input.order.productKey,
          p_locale: locale,
          p_email_normalized: email || null,
          p_metadata: { skip_reason: gate.reason },
        },
      );
      if ((claim as { claimed?: boolean } | null)?.claimed) {
        await finalizeEventStatus(input.service, eventKey, {
          status: "suppressed",
          last_error: gate.reason,
        });
        await recordChristmasLifecycleAnalytics(input.service, {
          eventName: "christmas_email_suppressed",
          orderId: input.order.id,
          productKey: input.order.productKey,
          locale,
          template: input.template,
          status: "suppressed",
        });
      }
      return {
        status: "suppressed",
        claimed: Boolean((claim as { claimed?: boolean } | null)?.claimed),
        dryRun: true,
        eventKey,
        reason: gate.reason,
      };
    }
  }

  if (!email) {
    return {
      status: "skipped",
      claimed: false,
      dryRun: true,
      eventKey,
      reason: "no_email",
    };
  }

  const dryRun = !lifecycleSendEnabled();
  const { data: claimRaw } = await input.service.rpc(
    "claim_christmas_lifecycle_event",
    {
      p_event_key: eventKey,
      p_template_key: input.template,
      p_category: category,
      p_order_id: input.order.id,
      p_product_key: input.order.productKey,
      p_locale: locale,
      p_email_normalized: email,
      p_metadata: {
        product_key: input.order.productKey,
        amount_cents: input.order.amountCents,
      },
    },
  );
  const claim = claimRaw as {
    claimed?: boolean;
    status?: string;
  } | null;

  if (!claim?.claimed) {
    return {
      status: String(claim?.status || "already_exists"),
      claimed: false,
      dryRun,
      eventKey,
      reason: "idempotent_skip",
    };
  }

  await recordChristmasLifecycleAnalytics(input.service, {
    eventName: "christmas_email_queued",
    orderId: input.order.id,
    productKey: input.order.productKey,
    locale,
    template: input.template,
    status: dryRun ? "dry_run" : "sending",
  });

  const amountLabel =
    input.order.amountCents > 0
      ? `${(input.order.amountCents / 100).toFixed(2)} ${input.order.currency.toUpperCase()}`
      : "";
  const copy = lifecycleEmailCopy(input.template, locale, {
    productName: input.productName,
    amountLabel,
    orderRef: input.order.id.slice(0, 8),
    resultUrl: input.resultUrl,
    resumeUrl: input.resumeUrl
      ? `${input.siteOrigin.replace(/\/$/, "")}${input.resumeUrl}`
      : undefined,
    crossSellName: input.crossSellName,
    crossSellUrl: input.crossSellUrl
      ? `${input.siteOrigin.replace(/\/$/, "")}${input.crossSellUrl}`
      : undefined,
    unsubscribeUrl:
      category === "marketing" && emailNormalized
        ? `${input.siteOrigin.replace(/\/$/, "")}/unsubscribe?email=${encodeURIComponent(emailNormalized)}`
        : undefined,
  });

  if (dryRun) {
    await finalizeEventStatus(input.service, eventKey, {
      status: "dry_run",
      last_error: "send_flag_off",
    });
    await recordChristmasLifecycleAnalytics(input.service, {
      eventName: "christmas_email_queued",
      orderId: input.order.id,
      productKey: input.order.productKey,
      locale,
      template: input.template,
      status: "dry_run",
    });
    return {
      status: "dry_run",
      claimed: true,
      dryRun: true,
      eventKey,
      reason: "send_flag_off",
    };
  }

  const apiKey = asString(process.env.RESEND_API_KEY);
  const from = asString(
    process.env.CHRISTMAS_EMAIL_FROM ||
      process.env.TRANSACTIONAL_EMAIL_FROM ||
      process.env.PET_EMAIL_FROM,
  );
  if (!apiKey || !from) {
    await finalizeEventStatus(input.service, eventKey, {
      status: "skipped",
      last_error: "unconfigured",
    });
    return {
      status: "skipped",
      claimed: true,
      dryRun: false,
      eventKey,
      reason: "unconfigured",
    };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: copy.subject,
        html: copy.htmlBody,
        text: copy.textBody,
      }),
    });
    if (!res.ok) {
      await finalizeEventStatus(input.service, eventKey, {
        status: "failed",
        last_error: `resend_${res.status}`,
      });
      await recordChristmasLifecycleAnalytics(input.service, {
        eventName: "christmas_email_failed",
        orderId: input.order.id,
        productKey: input.order.productKey,
        locale,
        template: input.template,
        status: "failed",
      });
      return {
        status: "failed",
        claimed: true,
        dryRun: false,
        eventKey,
        reason: `resend_${res.status}`,
      };
    }
    const body = (await res.json()) as { id?: string };
    await finalizeEventStatus(input.service, eventKey, {
      status: "sent",
      provider_message_id: asString(body.id) || null,
      sent_at: new Date().toISOString(),
    });
    await recordChristmasLifecycleAnalytics(input.service, {
      eventName: "christmas_email_sent",
      orderId: input.order.id,
      productKey: input.order.productKey,
      locale,
      template: input.template,
      status: "sent",
    });
    return { status: "sent", claimed: true, dryRun: false, eventKey };
  } catch (err) {
    await finalizeEventStatus(input.service, eventKey, {
      status: "failed",
      last_error: err instanceof Error ? err.message.slice(0, 200) : "send_error",
    });
    await recordChristmasLifecycleAnalytics(input.service, {
      eventName: "christmas_email_failed",
      orderId: input.order.id,
      productKey: input.order.productKey,
      locale,
      template: input.template,
      status: "failed",
    });
    return {
      status: "failed",
      claimed: true,
      dryRun: false,
      eventKey,
      reason: "exception",
    };
  }
}
