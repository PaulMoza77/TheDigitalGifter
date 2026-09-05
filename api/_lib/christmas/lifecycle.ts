/**
 * Node lifecycle email sender for Christmas commerce orders.
 * Uses claim_christmas_lifecycle_event for idempotency.
 * QA default: dry-run (no Resend) unless CHRISTMAS_LIFECYCLE_DRY_RUN=false and RESEND configured.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  abandonedCheckoutCopy,
  crossSellCopy,
  generationFailedCopy,
  generationReadyCopy,
  generationStartedCopy,
  paymentConfirmationCopy,
  type LifecycleEmailCopy,
} from "../../src/features/christmas/lifecycle/copy";
import {
  buildResultUrl,
  buildResumeUrl,
  lifecycleDryRun,
  lifecycleEventKey,
  marketingSendsEnabled,
  normalizeEmail,
  normalizeLifecycleLocale,
  planCrossSell,
  recoveryPathForOrder,
  shouldSendGenerationStarted,
  templateCategory,
  type ChristmasLifecycleTemplate,
  type LifecycleOrderSnapshot,
} from "../../src/features/christmas/lifecycle/engine";

function asString(value: unknown): string {
  return value == null ? "" : String(value).trim();
}

function siteOrigin(): string {
  return (
    process.env.SITE_URL ||
    process.env.PUBLIC_APP_URL ||
    "https://www.thedigitalgifter.com"
  ).replace(/\/$/, "");
}

function unsubscribeUrl(email: string): string {
  const base = siteOrigin();
  return `${base}/unsubscribe?email=${encodeURIComponent(email)}`;
}

async function resendSend(input: {
  to: string;
  copy: LifecycleEmailCopy;
}): Promise<{ ok: boolean; id?: string; reason?: string }> {
  const apiKey = asString(process.env.RESEND_API_KEY);
  const from = asString(
    process.env.CHRISTMAS_EMAIL_FROM ||
      process.env.TRANSACTIONAL_EMAIL_FROM ||
      process.env.PET_EMAIL_FROM,
  );
  if (!apiKey || !from) return { ok: false, reason: "unconfigured" };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.copy.subject,
      html: input.copy.html,
      text: input.copy.text,
    }),
  });
  if (!res.ok) return { ok: false, reason: `resend_${res.status}` };
  const body = (await res.json()) as { id?: string };
  return { ok: true, id: body.id };
}

async function isMarketingSuppressed(
  service: SupabaseClient,
  emailNormalized: string,
): Promise<boolean> {
  const { data } = await service
    .from("email_preferences")
    .select("marketing")
    .eq("email", emailNormalized)
    .maybeSingle();
  if (!data) return false;
  return data.marketing === false;
}

async function finalizeEvent(
  service: SupabaseClient,
  eventId: string,
  status: "sent" | "failed" | "suppressed" | "skipped" | "dry_run",
  patch: { provider_message_id?: string | null; last_error?: string | null },
) {
  await service
    .from("christmas_lifecycle_events")
    .update({
      status,
      provider_message_id: patch.provider_message_id ?? null,
      last_error: patch.last_error ?? null,
      sent_at: status === "sent" || status === "dry_run" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", eventId);
}

export async function dispatchChristmasLifecycleEmail(input: {
  service: SupabaseClient;
  template: ChristmasLifecycleTemplate;
  order: LifecycleOrderSnapshot;
  productName: string;
  /** For failed template */
  generationAttemptCount?: number;
  /** Live purchasable product keys for cross-sell */
  livePurchasableKeys?: string[];
  targetProductName?: string;
  dryRunEnv?: string | null;
  marketingEnv?: string | null;
}): Promise<{
  ok: boolean;
  status: string;
  eventKey: string;
  reason?: string;
}> {
  const locale = normalizeLifecycleLocale(input.order.locale);
  const email = normalizeEmail(input.order.email);
  const eventKey = lifecycleEventKey(input.template, input.order.id);
  const category = templateCategory(input.template);

  if (!email) {
    return { ok: false, status: "skipped", eventKey, reason: "missing_email" };
  }

  if (category === "marketing") {
    if (!marketingSendsEnabled(input.marketingEnv ?? process.env.CHRISTMAS_LIFECYCLE_MARKETING_ENABLED)) {
      return { ok: true, status: "skipped", eventKey, reason: "marketing_disabled" };
    }
    if (await isMarketingSuppressed(input.service, email)) {
      const claim = await input.service.rpc("claim_christmas_lifecycle_event", {
        p_event_key: eventKey,
        p_template_key: input.template,
        p_category: category,
        p_locale: locale,
        p_order_id: input.order.id,
        p_product_key: input.order.productKey,
        p_email_normalized: email,
        p_metadata: { reason: "suppressed" },
      });
      const claimed = claim.data as { claimed?: boolean; id?: string; already_final?: boolean };
      if (claimed?.id) {
        await finalizeEvent(input.service, claimed.id, "suppressed", {
          last_error: "marketing_opt_out",
        });
      }
      return { ok: true, status: "suppressed", eventKey, reason: "marketing_opt_out" };
    }
  }

  if (input.template === "generation_started" && !shouldSendGenerationStarted(input.order.productKey)) {
    return { ok: true, status: "skipped", eventKey, reason: "product_skips_started_email" };
  }

  if (input.template === "cross_sell") {
    const plan = planCrossSell(input.order.productKey, input.livePurchasableKeys || []);
    if (!plan.ok || !plan.targetProductKey) {
      return { ok: true, status: "skipped", eventKey, reason: plan.reason };
    }
  }

  const path = recoveryPathForOrder({
    productKey: input.order.productKey,
    sourceRoute: input.order.sourceRoute,
  });

  let copy: LifecycleEmailCopy;
  if (input.template === "payment_confirmation") {
    copy = paymentConfirmationCopy(locale, {
      productName: input.productName,
      amountCents: input.order.amountCents,
      currency: input.order.currency,
      orderId: input.order.id,
      nextStepUrl: buildResumeUrl({
        siteOrigin: siteOrigin(),
        path,
        orderId: input.order.id,
        locale,
      }),
    });
  } else if (input.template === "generation_started") {
    copy = generationStartedCopy(locale, {
      productName: input.productName,
      statusUrl: buildResumeUrl({
        siteOrigin: siteOrigin(),
        path,
        orderId: input.order.id,
        locale,
      }),
    });
  } else if (input.template === "generation_ready") {
    if (!input.order.publicTokenHint) {
      return { ok: false, status: "skipped", eventKey, reason: "missing_public_token_hint" };
    }
    copy = generationReadyCopy(locale, {
      productName: input.productName,
      resultUrl: buildResultUrl({
        siteOrigin: siteOrigin(),
        path,
        publicTokenHint: input.order.publicTokenHint,
        locale,
      }),
    });
  } else if (input.template === "generation_failed") {
    const attempts = input.generationAttemptCount ?? 1;
    copy = generationFailedCopy(locale, {
      productName: input.productName,
      statusUrl: buildResumeUrl({
        siteOrigin: siteOrigin(),
        path,
        orderId: input.order.id,
        locale,
      }),
      terminal: attempts >= 3,
    });
  } else if (input.template === "abandoned_checkout") {
    copy = abandonedCheckoutCopy(locale, {
      productName: input.productName,
      resumeUrl: buildResumeUrl({
        siteOrigin: siteOrigin(),
        path,
        orderId: input.order.id,
        locale,
      }),
      unsubscribeUrl: unsubscribeUrl(email),
    });
  } else {
    const plan = planCrossSell(input.order.productKey, input.livePurchasableKeys || []);
    copy = crossSellCopy(locale, {
      sourceProductName: input.productName,
      targetProductName: input.targetProductName || plan.targetProductKey || "Christmas",
      targetUrl: `${siteOrigin()}/${(plan.targetProductKey || "christmas").replace("christmas_", "christmas/")}`,
      unsubscribeUrl: unsubscribeUrl(email),
    });
  }

  const { data: claimData, error: claimError } = await input.service.rpc(
    "claim_christmas_lifecycle_event",
    {
      p_event_key: eventKey,
      p_template_key: input.template,
      p_category: category,
      p_locale: locale,
      p_order_id: input.order.id,
      p_product_key: input.order.productKey,
      p_email_normalized: email,
      p_metadata: { dry_run_check: true },
    },
  );
  if (claimError) {
    return { ok: false, status: "failed", eventKey, reason: claimError.message };
  }
  const claim = claimData as {
    claimed?: boolean;
    already_final?: boolean;
    in_flight?: boolean;
    id?: string;
    status?: string;
  };
  if (!claim?.claimed) {
    return {
      ok: true,
      status: claim?.status || "skipped",
      eventKey,
      reason: claim?.already_final
        ? "already_final"
        : claim?.in_flight
          ? "in_flight"
          : "not_claimed",
    };
  }

  const dry =
    lifecycleDryRun(input.dryRunEnv ?? process.env.CHRISTMAS_LIFECYCLE_DRY_RUN) ||
    !asString(process.env.RESEND_API_KEY);

  if (dry) {
    await finalizeEvent(input.service, claim.id!, "dry_run", {
      last_error: "dry_run_no_customer_send",
    });
    return { ok: true, status: "dry_run", eventKey, reason: "dry_run" };
  }

  const sent = await resendSend({ to: email, copy });
  if (!sent.ok) {
    await finalizeEvent(input.service, claim.id!, "failed", {
      last_error: sent.reason || "send_failed",
    });
    return { ok: false, status: "failed", eventKey, reason: sent.reason };
  }

  await finalizeEvent(input.service, claim.id!, "sent", {
    provider_message_id: sent.id || null,
  });
  return { ok: true, status: "sent", eventKey };
}

export function orderRowToLifecycleSnapshot(row: Record<string, unknown>): LifecycleOrderSnapshot {
  const metadata =
    row.metadata && typeof row.metadata === "object"
      ? (row.metadata as Record<string, unknown>)
      : {};
  return {
    id: asString(row.id),
    productKey: asString(row.product_key),
    packageKey: asString(row.package_key),
    paymentStatus: asString(row.payment_status) as LifecycleOrderSnapshot["paymentStatus"],
    fulfillmentStatus: asString(
      row.fulfillment_status,
    ) as LifecycleOrderSnapshot["fulfillmentStatus"],
    amountCents: Number(row.amount_cents) || 0,
    currency: asString(row.currency) || "usd",
    email: asString(row.email) || null,
    locale: asString(row.locale) || "en",
    publicTokenHint: asString(metadata.public_token_hint) || null,
    sourceRoute: asString(row.source_route) || null,
    stripeCheckoutSessionId: asString(row.stripe_checkout_session_id) || null,
    createdAt: asString(row.created_at),
    paidAt: asString(row.paid_at) || null,
    generationStartedAt: asString(row.generation_started_at) || null,
    generationFinishedAt: asString(row.generation_finished_at) || null,
    lastError: asString(row.last_error) || null,
  };
}
