import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { asString } from "./crypto.ts";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/**
 * Best-effort notice after a full portrait refund.
 * Partial refunds do not send email (download remains available).
 */
export async function sendPortraitRefundedEmail(input: {
  service: SupabaseClient;
  orderId: string;
  email: string;
  refundedAmountCents: number;
  currency: string;
}): Promise<{ sent: boolean; reason?: string }> {
  const kind = "portrait_refunded";
  const { data: existing } = await input.service
    .from("christmas_email_deliveries")
    .select("id, status")
    .eq("order_id", input.orderId)
    .eq("kind", kind)
    .maybeSingle();
  if (existing?.status === "sent") return { sent: false, reason: "already_sent" };

  const apiKey = asString(Deno.env.get("RESEND_API_KEY"));
  const from = asString(
    Deno.env.get("CHRISTMAS_EMAIL_FROM") ||
      Deno.env.get("TRANSACTIONAL_EMAIL_FROM") ||
      Deno.env.get("PET_EMAIL_FROM"),
  );

  await input.service.from("christmas_email_deliveries").upsert(
    {
      order_id: input.orderId,
      kind,
      status: apiKey && from ? "queued" : "skipped",
      last_error: apiKey && from ? null : "email_provider_unconfigured",
      attempt_count: (existing ? 1 : 0) + 1,
    },
    { onConflict: "order_id,kind" },
  );

  if (!apiKey || !from) return { sent: false, reason: "unconfigured" };
  if (!input.email.trim()) return { sent: false, reason: "missing_email" };

  const amount = (Math.max(0, input.refundedAmountCents) / 100).toFixed(2);
  const currency = (input.currency || "eur").toUpperCase();
  const subject = "Your Christmas portrait refund was processed";
  const html =
    `<p>We processed a full refund of ${escapeHtml(amount)} ${escapeHtml(currency)} ` +
    `for your Christmas portrait order.</p>` +
    `<p>Download access for this order has been revoked.</p>` +
    `<p>- The Digital Gifter</p>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `xmas-portrait-refunded/${input.orderId}`,
    },
    body: JSON.stringify({ from, to: [input.email], subject, html }),
  });

  if (!res.ok) {
    const providerError = (await res.text()).slice(0, 500);
    await input.service
      .from("christmas_email_deliveries")
      .update({
        status: "failed",
        last_error: providerError || `resend_http_${res.status}`,
      })
      .eq("order_id", input.orderId)
      .eq("kind", kind);
    return { sent: false, reason: "provider_error" };
  }

  const body = (await res.json()) as { id?: string };
  await input.service
    .from("christmas_email_deliveries")
    .update({
      status: "sent",
      provider_message_id: asString(body.id) || null,
      last_error: null,
      sent_at: new Date().toISOString(),
    })
    .eq("order_id", input.orderId)
    .eq("kind", kind);

  return { sent: true };
}
