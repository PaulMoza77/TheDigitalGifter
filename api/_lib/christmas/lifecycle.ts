/**
 * Node/API Christmas lifecycle sender.
 * Uses src/features/christmas/lifecycle/lifecycleCore for pure logic.
 * Default: dry-run ledger only unless CHRISTMAS_LIFECYCLE_SEND_ENABLED=true.
 * Marketing additionally requires CHRISTMAS_LIFECYCLE_MARKETING_ENABLED=true + consent.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
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

function emailHash(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
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
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();
  if (!data) return null;
  return data.marketing !== false;
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
  const email = asString(input.order.email);

  if (category === "marketing") {
    const consent = await lookupMarketingConsent(input.service, email || null);
    const gate = marketingSendAllowed({
      marketingEnabled: lifecycleMarketingEnabled(),
      marketingConsent: consent,
    });
    if (!gate.ok) {
      await input.service.rpc("claim_christmas_lifecycle_event", {
        p_event_key: eventKey,
        p_template_key: input.template,
        p_category: category,
        p_order_id: input.order.id,
        p_product_key: input.order.productKey,
        p_locale: locale,
        p_recipient_email_hash: email ? emailHash(email) : null,
        p_dry_run: true,
        p_metadata: { skip_reason: gate.reason },
      });
      await input.service
        .from("christmas_lifecycle_events")
        .update({
          status: "suppressed",
          last_error: gate.reason,
          updated_at: new Date().toISOString(),
        })
        .eq("event_key", eventKey);
      return {
        status: "suppressed",
        claimed: true,
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
  const claim = (await input.service.rpc("claim_christmas_lifecycle_event", {
    p_event_key: eventKey,
    p_template_key: input.template,
    p_category: category,
    p_order_id: input.order.id,
    p_product_key: input.order.productKey,
    p_locale: locale,
    p_recipient_email_hash: emailHash(email),
    p_dry_run: dryRun,
    p_metadata: {
      product_key: input.order.productKey,
      amount_cents: input.order.amountCents,
    },
  })) as {
    claimed?: boolean;
    already_exists?: boolean;
    status?: string;
  };

  if (!claim?.claimed) {
    return {
      status: String(claim?.status || "already_exists"),
      claimed: false,
      dryRun,
      eventKey,
      reason: "idempotent_skip",
    };
  }

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
  });

  if (dryRun) {
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
    await input.service
      .from("christmas_lifecycle_events")
      .update({
        status: "skipped",
        last_error: "unconfigured",
        updated_at: new Date().toISOString(),
      })
      .eq("event_key", eventKey);
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
      await input.service
        .from("christmas_lifecycle_events")
        .update({
          status: "failed",
          last_error: `resend_${res.status}`,
          updated_at: new Date().toISOString(),
        })
        .eq("event_key", eventKey);
      return {
        status: "failed",
        claimed: true,
        dryRun: false,
        eventKey,
        reason: `resend_${res.status}`,
      };
    }
    const body = (await res.json()) as { id?: string };
    await input.service
      .from("christmas_lifecycle_events")
      .update({
        status: "sent",
        provider_message_id: asString(body.id) || null,
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("event_key", eventKey);
    return { status: "sent", claimed: true, dryRun: false, eventKey };
  } catch (err) {
    await input.service
      .from("christmas_lifecycle_events")
      .update({
        status: "failed",
        last_error: err instanceof Error ? err.message.slice(0, 200) : "send_error",
        updated_at: new Date().toISOString(),
      })
      .eq("event_key", eventKey);
    return {
      status: "failed",
      claimed: true,
      dryRun: false,
      eventKey,
      reason: "exception",
    };
  }
}
