/**
 * Node/Vercel port of supabase/functions/_shared/christmas/email.ts.
 * Keep in sync with the Deno source.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { CHRISTMAS_PACKS, siteOrigin } from "./constants";
import { asString } from "./crypto";
import {
  christmasV2DeliveryEmailCopy,
  normalizeEmailLocale,
} from "./emailI18n";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export async function sendChristmasDeliveryEmail(input: {
  service: SupabaseClient;
  orderId: string;
  email: string;
  publicToken: string;
  packKey: keyof typeof CHRISTMAS_PACKS;
  /** Persisted order/user locale — never infer from webhook headers alone. */
  locale?: string | null;
}): Promise<{ sent: boolean; reason?: string }> {
  const kind =
    input.packKey === "magic"
      ? "magic_ready"
      : input.packKey === "ultimate"
        ? "ultimate_ready"
        : "starter_ready";

  const { data: existing } = await input.service
    .from("christmas_email_deliveries")
    .select("id, status")
    .eq("order_id", input.orderId)
    .eq("kind", kind)
    .maybeSingle();
  if (existing?.status === "sent") return { sent: false, reason: "already_sent" };

  const pack = CHRISTMAS_PACKS[input.packKey];
  const url = `${siteOrigin()}/christmas-ai-photos/order?token=${encodeURIComponent(input.publicToken)}`;
  const copy = christmasV2DeliveryEmailCopy(normalizeEmailLocale(input.locale), {
    packKey: input.packKey,
    packName: pack.name,
    imageCount: pack.imageCount,
    videoCount: pack.videoCount,
  });
  const subject = copy.subject;

  const html = `<!doctype html><html><body style="font-family:Georgia,serif;background:#3b0610;color:#F7F0E4;padding:32px">
  <div style="max-width:560px;margin:0 auto;background:#5c0a14;border-radius:18px;padding:28px">
    <h1 style="font-size:28px;margin:0 0 12px">${escapeHtml(subject)}</h1>
    <p style="line-height:1.6;opacity:.9">${escapeHtml(copy.body)}</p>
    <p style="margin:24px 0"><a href="${url}" style="display:inline-block;background:#1B4332;color:#F7F0E4;text-decoration:none;padding:14px 22px;border-radius:999px;font-weight:600">${escapeHtml(copy.cta)}</a></p>
    <p style="font-size:12px;opacity:.55">${escapeHtml(copy.footer)}</p>
  </div></body></html>`;

  const apiKey = asString(process.env.RESEND_API_KEY);
  const from = asString(
    process.env.CHRISTMAS_EMAIL_FROM || process.env.TRANSACTIONAL_EMAIL_FROM || process.env.PET_EMAIL_FROM,
  );

  await input.service.from("christmas_email_deliveries").upsert(
    { order_id: input.orderId, kind, status: apiKey && from ? "queued" : "skipped" },
    { onConflict: "order_id,kind" },
  );

  if (!apiKey || !from) return { sent: false, reason: "unconfigured" };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [input.email], subject, html }),
  });
  if (!res.ok) {
    await input.service
      .from("christmas_email_deliveries")
      .update({ status: "failed" })
      .eq("order_id", input.orderId)
      .eq("kind", kind);
    throw new Error(`Christmas delivery email failed (${res.status})`);
  }
  const body = (await res.json()) as { id?: string };
  await input.service
    .from("christmas_email_deliveries")
    .update({ status: "sent", provider_message_id: asString(body.id) })
    .eq("order_id", input.orderId)
    .eq("kind", kind);
  await input.service
    .from("christmas_orders")
    .update({ delivery_email_sent_at: new Date().toISOString() })
    .eq("id", input.orderId);
  return { sent: true };
}
