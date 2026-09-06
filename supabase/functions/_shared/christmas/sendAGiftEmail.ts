/**
 * QA-safe Send-a-Gift recipient email via Resend.
 * Never sends to real customers unless SEND_A_GIFT_EMAIL_ENABLED=true
 * and recipient passes allowlist (or is explicitly admin-forced with allowlist).
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

function asString(value: unknown): string {
  return String(value ?? "").trim();
}

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

function emailEnabled(): boolean {
  const raw = asString(Deno.env.get("SEND_A_GIFT_EMAIL_ENABLED")).toLowerCase();
  return raw === "true" || raw === "1" || raw === "on";
}

/** Comma-separated domains or exact emails. Empty = block all (fail closed). */
function allowlist(): string[] {
  return asString(Deno.env.get("SEND_A_GIFT_EMAIL_ALLOWLIST"))
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isSendAGiftEmailRecipientAllowed(email: string): boolean {
  const normalized = asString(email).toLowerCase();
  if (!normalized || !normalized.includes("@")) return false;
  const list = allowlist();
  if (!list.length) return false;
  const domain = normalized.split("@")[1] || "";
  return list.some((entry) => entry === normalized || entry === domain || entry === `@${domain}`);
}

export async function sendSendAGiftRecipientEmail(input: {
  service: SupabaseClient;
  giftShareId: string;
  shareId: string;
  toEmail: string;
  forceResend?: boolean;
}): Promise<{ sent: boolean; reason?: string; status?: string }> {
  if (!emailEnabled()) {
    return { sent: false, reason: "email_disabled", status: "skipped" };
  }
  if (!isSendAGiftEmailRecipientAllowed(input.toEmail)) {
    return { sent: false, reason: "recipient_not_allowlisted", status: "skipped" };
  }

  const { data: gift } = await input.service
    .from("christmas_gift_shares")
    .select("id,email_status,email_idempotency_key,status")
    .eq("id", input.giftShareId)
    .maybeSingle();

  if (!gift) return { sent: false, reason: "gift_not_found" };
  if (gift.status === "disabled") return { sent: false, reason: "gift_disabled" };

  const idempotencyKey = `send_a_gift_recipient:${input.giftShareId}`;
  if (!input.forceResend && gift.email_status === "sent") {
    return { sent: false, reason: "already_sent", status: "sent" };
  }

  const apiKey = asString(Deno.env.get("RESEND_API_KEY"));
  const from = asString(
    Deno.env.get("SEND_A_GIFT_EMAIL_FROM") ||
      Deno.env.get("CHRISTMAS_EMAIL_FROM") ||
      Deno.env.get("TRANSACTIONAL_EMAIL_FROM") ||
      Deno.env.get("PET_EMAIL_FROM"),
  );
  if (!apiKey || !from) {
    await input.service
      .from("christmas_gift_shares")
      .update({
        email_status: "skipped",
        last_safe_error: "email_unconfigured",
        email_idempotency_key: idempotencyKey,
      })
      .eq("id", input.giftShareId);
    return { sent: false, reason: "unconfigured", status: "skipped" };
  }

  await input.service
    .from("christmas_gift_shares")
    .update({
      email_status: "queued",
      email_idempotency_key: idempotencyKey,
      last_safe_error: null,
    })
    .eq("id", input.giftShareId);

  const url = `${siteOrigin()}/gift/${encodeURIComponent(input.shareId)}`;
  const subject = "Your Christmas gift is ready";
  const html = `<!doctype html><html><body style="font-family:Georgia,serif;background:#0b1220;color:#F7F0E4;padding:32px">
  <div style="max-width:560px;margin:0 auto;background:#122033;border-radius:18px;padding:28px">
    <h1 style="font-size:26px;margin:0 0 12px">${escapeHtml(subject)}</h1>
    <p style="line-height:1.6;opacity:.9">Someone sent you a prepaid Digital Gifter Christmas gift. No payment needed.</p>
    <p style="margin:24px 0"><a href="${escapeHtml(url)}" style="display:inline-block;background:#10b981;color:#041016;text-decoration:none;padding:14px 22px;border-radius:999px;font-weight:600">Open your gift</a></p>
    <p style="font-size:12px;opacity:.55">Digital Gifter · One-time gift · No subscription</p>
  </div></body></html>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.toEmail],
      subject,
      html,
      headers: { "Idempotency-Key": idempotencyKey + (input.forceResend ? `:r${Date.now()}` : "") },
    }),
  });

  if (!res.ok) {
    await input.service
      .from("christmas_gift_shares")
      .update({
        email_status: "failed",
        last_safe_error: `resend_${res.status}`,
      })
      .eq("id", input.giftShareId);
    return { sent: false, reason: `resend_${res.status}`, status: "failed" };
  }

  await input.service
    .from("christmas_gift_shares")
    .update({
      email_status: "sent",
      email_last_sent_at: new Date().toISOString(),
      last_safe_error: null,
    })
    .eq("id", input.giftShareId);

  return { sent: true, status: "sent" };
}
