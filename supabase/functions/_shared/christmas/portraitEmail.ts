import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { asString } from "./crypto.ts";
import { recoveryRouteForOrder } from "./portraitPromptRegistry.ts";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function siteOrigin(): string {
  return (
    Deno.env.get("SITE_URL") ||
    Deno.env.get("PUBLIC_APP_URL") ||
    "https://www.thedigitalgifter.com"
  ).replace(/\/$/, "");
}

/**
 * Post-generation transactional email for commerce portraits.
 * Idempotent via christmas_email_deliveries (kind=portrait_ready) + Resend Idempotency-Key.
 */
export async function sendPortraitReadyEmail(input: {
  service: SupabaseClient;
  orderId: string;
  email: string;
  publicToken: string;
  productKey: string;
  species?: string | null;
  sourceRoute?: string | null;
  landingPath?: string | null;
}): Promise<{ sent: boolean; reason?: string; providerMessageId?: string }> {
  const kind = "portrait_ready";
  const { data: existing } = await input.service
    .from("christmas_email_deliveries")
    .select("id, status, provider_message_id, attempt_count")
    .eq("order_id", input.orderId)
    .eq("kind", kind)
    .maybeSingle();
  if (existing?.status === "sent") {
    return {
      sent: false,
      reason: "already_sent",
      providerMessageId: asString(existing.provider_message_id) || undefined,
    };
  }

  const apiKey = asString(Deno.env.get("RESEND_API_KEY"));
  const from = asString(
    Deno.env.get("CHRISTMAS_EMAIL_FROM") ||
      Deno.env.get("TRANSACTIONAL_EMAIL_FROM") ||
      Deno.env.get("PET_EMAIL_FROM"),
  );

  const attemptCount = (existing?.attempt_count ?? 0) + 1;
  await input.service.from("christmas_email_deliveries").upsert(
    {
      order_id: input.orderId,
      kind,
      status: apiKey && from ? "queued" : "skipped",
      last_error: apiKey && from ? null : "email_provider_unconfigured",
      attempt_count: attemptCount,
    },
    { onConflict: "order_id,kind" },
  );

  if (!apiKey || !from) return { sent: false, reason: "unconfigured" };
  if (!input.email.trim()) return { sent: false, reason: "missing_email" };
  if (!input.publicToken.trim()) return { sent: false, reason: "missing_token" };

  const route = recoveryRouteForOrder({
    productKey: input.productKey,
    species: input.species || null,
    sourceRoute: input.sourceRoute || null,
    landingPath: input.landingPath || null,
  });
  const link = `${siteOrigin()}${route}?token=${encodeURIComponent(input.publicToken)}`;
  const subject = "Your Christmas portrait is ready";
  const html =
    `<p>Your personalized Christmas portrait is ready.</p>` +
    `<p><a href="${escapeHtml(link)}">Open your result</a></p>` +
    `<p>- The Digital Gifter</p>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `xmas-portrait-ready/${input.orderId}`,
    },
    body: JSON.stringify({
      from,
      to: [input.email],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const providerError = (await res.text()).slice(0, 500);
    await input.service
      .from("christmas_email_deliveries")
      .update({
        status: "failed",
        last_error: providerError || `resend_http_${res.status}`,
        attempt_count: attemptCount,
      })
      .eq("order_id", input.orderId)
      .eq("kind", kind);
    return { sent: false, reason: "provider_error" };
  }

  const body = (await res.json()) as { id?: string };
  const providerMessageId = asString(body.id);
  const sentAt = new Date().toISOString();
  await input.service
    .from("christmas_email_deliveries")
    .update({
      status: "sent",
      provider_message_id: providerMessageId || null,
      last_error: null,
      sent_at: sentAt,
      attempt_count: attemptCount,
    })
    .eq("order_id", input.orderId)
    .eq("kind", kind);
  await input.service
    .from("christmas_orders")
    .update({ delivery_email_sent_at: sentAt })
    .eq("id", input.orderId);

  return { sent: true, providerMessageId: providerMessageId || undefined };
}
