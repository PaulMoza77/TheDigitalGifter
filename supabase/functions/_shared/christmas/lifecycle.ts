/**
 * Deno Edge Christmas lifecycle claim + optional Resend send.
 * Keep template copy aligned with src/features/christmas/lifecycle/lifecycleCore.ts
 * Default dry-run unless CHRISTMAS_LIFECYCLE_SEND_ENABLED=true.
 *
 * RPC contract must match claim_christmas_lifecycle_event migration:
 * p_event_key, p_template_key, p_category, p_locale, p_order_id,
 * p_product_key, p_email_normalized, p_metadata
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { asString } from "./crypto.ts";

export type LifecycleTemplate =
  | "payment_confirmation"
  | "generation_started"
  | "generation_ready"
  | "generation_failed";

function normalizeLocale(value: string | null | undefined): "en" | "ro" {
  const raw = asString(value).toLowerCase();
  return raw === "ro" || raw.startsWith("ro") ? "ro" : "en";
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function sendEnabled(): boolean {
  return asString(Deno.env.get("CHRISTMAS_LIFECYCLE_SEND_ENABLED")).toLowerCase() === "true";
}

function eventKey(template: LifecycleTemplate, orderId: string): string {
  return `order:${orderId}:${template}`;
}

function emailCopy(
  template: LifecycleTemplate,
  locale: "en" | "ro",
  vars: { productName: string; amountLabel?: string; orderRef?: string; resultUrl?: string },
): { subject: string; html: string } {
  const ro = locale === "ro";
  const product = vars.productName;
  const amount = vars.amountLabel || "";
  const ref = vars.orderRef || "";
  if (template === "payment_confirmation") {
    return {
      subject: ro ? `Plata confirmată — ${product}` : `Payment confirmed — ${product}`,
      html: ro
        ? `<p>Plata ta pentru <strong>${product}</strong>${amount ? ` (${amount})` : ""} a fost confirmată.</p><p>Pregătim generarea. Îți vom trimite un email când rezultatul este gata.</p><p>Referință: ${ref}</p><p>— The Digital Gifter</p>`
        : `<p>Your payment for <strong>${product}</strong>${amount ? ` (${amount})` : ""} is confirmed.</p><p>We're preparing generation. We'll email you when your result is ready.</p><p>Order reference: ${ref}</p><p>— The Digital Gifter</p>`,
    };
  }
  if (template === "generation_started") {
    return {
      subject: ro ? `Generăm ${product}…` : `Creating your ${product}…`,
      html: ro
        ? `<p>Am început generarea pentru <strong>${product}</strong>.</p><p>— The Digital Gifter</p>`
        : `<p>We've started creating your <strong>${product}</strong>.</p><p>— The Digital Gifter</p>`,
    };
  }
  if (template === "generation_ready") {
    const link = vars.resultUrl || "#";
    return {
      subject: ro ? `${product} este gata` : `Your ${product} is ready`,
      html: ro
        ? `<p><strong>${product}</strong> este gata.</p><p><a href="${link}">Deschide rezultatul</a></p><p>— The Digital Gifter</p>`
        : `<p>Your <strong>${product}</strong> is ready.</p><p><a href="${link}">Open your result</a></p><p>— The Digital Gifter</p>`,
    };
  }
  return {
    subject: ro ? `Nu am putut finaliza ${product}` : `We couldn't finish your ${product}`,
    html: ro
      ? `<p>Nu am putut finaliza <strong>${product}</strong> după mai multe încercări. Dacă ai plătit, nu vei fi taxat din nou.</p><p>Referință: ${ref}</p><p>— The Digital Gifter</p>`
      : `<p>We couldn't finish your <strong>${product}</strong> after several attempts. If you paid, you won't be charged again for a retry.</p><p>Reference: ${ref}</p><p>— The Digital Gifter</p>`,
  };
}

async function recordLifecycleAnalytics(
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
        is_test: asString(Deno.env.get("VERCEL_ENV")) !== "production",
        environment: asString(Deno.env.get("VERCEL_ENV")) || "edge",
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

export async function claimAndSendChristmasLifecycle(input: {
  service: SupabaseClient;
  template: LifecycleTemplate;
  orderId: string;
  productKey: string;
  locale: string | null | undefined;
  email: string | null | undefined;
  productName: string;
  amountCents?: number;
  currency?: string;
  resultUrl?: string;
}): Promise<{ status: string; eventKey: string }> {
  const locale = normalizeLocale(input.locale);
  const key = eventKey(input.template, input.orderId);
  const email = normalizeEmail(asString(input.email));
  if (!email) return { status: "skipped_no_email", eventKey: key };

  const dryRun = !sendEnabled();
  const { data: claim } = await input.service.rpc("claim_christmas_lifecycle_event", {
    p_event_key: key,
    p_template_key: input.template,
    p_category: "transactional",
    p_order_id: input.orderId,
    p_product_key: input.productKey,
    p_locale: locale,
    p_email_normalized: email,
    p_metadata: { product_key: input.productKey },
  });
  const claimed = Boolean((claim as { claimed?: boolean } | null)?.claimed);
  if (!claimed) {
    return {
      status: asString((claim as { status?: string } | null)?.status) || "already_exists",
      eventKey: key,
    };
  }

  await recordLifecycleAnalytics(input.service, {
    eventName: "christmas_email_queued",
    orderId: input.orderId,
    productKey: input.productKey,
    locale,
    template: input.template,
    status: dryRun ? "dry_run" : "sending",
  });

  if (dryRun) {
    await input.service
      .from("christmas_lifecycle_events")
      .update({
        status: "dry_run",
        last_error: "send_flag_off",
        updated_at: new Date().toISOString(),
      })
      .eq("event_key", key);
    return { status: "dry_run", eventKey: key };
  }

  const amountLabel =
    input.amountCents && input.amountCents > 0
      ? `${(input.amountCents / 100).toFixed(2)} ${(input.currency || "usd").toUpperCase()}`
      : "";
  const copy = emailCopy(input.template, locale, {
    productName: input.productName,
    amountLabel,
    orderRef: input.orderId.slice(0, 8),
    resultUrl: input.resultUrl,
  });

  const apiKey = asString(Deno.env.get("RESEND_API_KEY"));
  const from = asString(
    Deno.env.get("CHRISTMAS_EMAIL_FROM") ||
      Deno.env.get("TRANSACTIONAL_EMAIL_FROM") ||
      Deno.env.get("PET_EMAIL_FROM"),
  );
  if (!apiKey || !from) {
    await input.service
      .from("christmas_lifecycle_events")
      .update({ status: "skipped", last_error: "unconfigured", updated_at: new Date().toISOString() })
      .eq("event_key", key);
    return { status: "skipped_unconfigured", eventKey: key };
  }

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
      html: copy.html,
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
      .eq("event_key", key);
    await recordLifecycleAnalytics(input.service, {
      eventName: "christmas_email_failed",
      orderId: input.orderId,
      productKey: input.productKey,
      locale,
      template: input.template,
      status: "failed",
    });
    return { status: "failed", eventKey: key };
  }
  const body = await res.json();
  await input.service
    .from("christmas_lifecycle_events")
    .update({
      status: "sent",
      provider_message_id: asString(body.id),
      sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("event_key", key);
  await recordLifecycleAnalytics(input.service, {
    eventName: "christmas_email_sent",
    orderId: input.orderId,
    productKey: input.productKey,
    locale,
    template: input.template,
    status: "sent",
  });
  return { status: "sent", eventKey: key };
}
