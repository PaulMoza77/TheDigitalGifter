import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { siteOrigin } from "./constants.ts";
import { asString } from "./crypto.ts";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function deliveryAllowlist(): Set<string> {
  const raw =
    asString(Deno.env.get("CHRISTMAS_STORY_DELIVERY_ALLOWLIST")) ||
    "thedigitalgifter@gmail.com";
  return new Set(
    raw
      .split(/[,;\s]+/)
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.includes("@")),
  );
}

export function buildChristmasStoryGiftEmailContent(input: {
  recipientToken: string;
  recipientName?: string;
  fromName?: string;
}): { subject: string; html: string; text: string; giftUrl: string } {
  const origin = siteOrigin();
  const giftUrl = `${origin}/gift/${encodeURIComponent(input.recipientToken)}`;
  const name = escapeHtml((input.recipientName || "someone special").trim().slice(0, 60));
  const from = escapeHtml((input.fromName || "Someone who loves you").trim().slice(0, 60));
  const subject = "A Christmas Story was made for you";
  const html = `<!doctype html><html><body style="font-family:Georgia,serif;background:#1B4332;color:#F7F0E4;padding:32px">
  <div style="max-width:560px;margin:0 auto;background:#2d6a4f;border-radius:18px;padding:28px">
    <p style="opacity:.85;margin:0 0 8px">From ${from}</p>
    <h1 style="font-size:26px;margin:0 0 12px">${name}, your Christmas Story is ready</h1>
    <p style="line-height:1.65;opacity:.92">A private song, memory film, and interactive gift page — unwrap when you are ready.</p>
    <p style="margin:24px 0"><a href="${giftUrl}" style="display:inline-block;background:#C1121F;color:#F7F0E4;text-decoration:none;padding:14px 22px;border-radius:999px;font-weight:600">Open your gift</a></p>
    <p style="font-size:12px;opacity:.55">This link is personal. Digital Gifter · No subscription.</p>
  </div></body></html>`;
  const text = `${name}, your Christmas Story is ready.\n\nOpen your gift: ${giftUrl}\n\nFrom ${input.fromName || "Someone who loves you"}.`;
  return { subject, html, text, giftUrl };
}

export async function sendChristmasStoryGiftEmail(input: {
  service: SupabaseClient;
  orderId: string;
  email: string;
  recipientToken: string;
  recipientName?: string;
  fromName?: string;
  resend?: boolean;
}): Promise<{ sent: boolean; reason?: string; providerMessageId?: string }> {
  const kind = input.resend ? "christmas_story_gift_resent" : "christmas_story_gift_sent";
  const to = asString(input.email).trim().toLowerCase();
  if (!to) return { sent: false, reason: "missing_email" };

  const allow = deliveryAllowlist();
  if (!allow.has(to)) {
    return { sent: false, reason: "recipient_not_allowlisted" };
  }

  if (!input.resend) {
    const { data: prior } = await input.service
      .from("christmas_email_deliveries")
      .select("status,provider_message_id")
      .eq("order_id", input.orderId)
      .eq("kind", kind)
      .maybeSingle();
    if (asString(prior?.status) === "sent" && asString(prior?.provider_message_id)) {
      return { sent: true, reason: "already_sent", providerMessageId: asString(prior?.provider_message_id) };
    }
  }

  const apiKey = asString(Deno.env.get("RESEND_API_KEY"));
  const from = asString(
    Deno.env.get("CHRISTMAS_EMAIL_FROM") ||
      Deno.env.get("TRANSACTIONAL_EMAIL_FROM") ||
      Deno.env.get("PET_EMAIL_FROM"),
  );
  const replyTo = asString(
    Deno.env.get("CHRISTMAS_EMAIL_REPLY_TO") ||
      Deno.env.get("SUPPORT_EMAIL") ||
      "support@thedigitalgifter.com",
  );
  if (!apiKey || !from) {
    return { sent: false, reason: "unconfigured" };
  }

  const content = buildChristmasStoryGiftEmailContent({
    recipientToken: input.recipientToken,
    recipientName: input.recipientName,
    fromName: input.fromName,
  });

  await input.service.from("christmas_email_deliveries").upsert(
    { order_id: input.orderId, kind, status: "queued" },
    { onConflict: "order_id,kind" },
  );

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `christmas-story-${kind}-${input.orderId}`,
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: content.subject,
      html: content.html,
      text: content.text,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });

  if (!res.ok) {
    await input.service
      .from("christmas_email_deliveries")
      .update({ status: "failed", last_error: `resend_${res.status}` })
      .eq("order_id", input.orderId)
      .eq("kind", kind);
    throw new Error(`Christmas Story delivery email failed (${res.status})`);
  }

  const body = await res.json();
  const providerMessageId = asString(body.id);
  await input.service
    .from("christmas_email_deliveries")
    .update({
      status: "sent",
      provider_message_id: providerMessageId,
      sent_at: new Date().toISOString(),
      last_error: null,
    })
    .eq("order_id", input.orderId)
    .eq("kind", kind);

  await auditStoryEmailSent(input.service, input.orderId, { kind, providerMessageId, to });

  return { sent: true, providerMessageId };
}

async function auditStoryEmailSent(
  service: SupabaseClient,
  orderId: string,
  meta: Record<string, unknown>,
) {
  await service.from("christmas_story_audit_events").insert({
    order_id: orderId,
    event_name: "gift_delivery_email",
    actor_kind: "system",
    metadata: meta,
  });
}