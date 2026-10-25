import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { siteOrigin } from "./constants.ts";
import { asString } from "./crypto.ts";
import type { SantaCallLanguage } from "./santaCallPersonality.ts";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatExpiry(iso: string, language: SantaCallLanguage): string {
  try {
    return new Date(iso).toLocaleDateString(language === "ro" ? "ro-RO" : "en-GB", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function formatMoney(amountMinor: number | undefined, currency: string | undefined, language: SantaCallLanguage): string {
  if (!amountMinor || !currency) return "";
  try {
    return new Intl.NumberFormat(language === "ro" ? "ro-RO" : "en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
      maximumFractionDigits: 2,
    }).format(amountMinor / 100);
  } catch {
    return `${(amountMinor / 100).toFixed(2)} ${String(currency).toUpperCase()}`;
  }
}

export async function sendSantaCallReadyEmail(input: {
  service: SupabaseClient;
  orderId: string;
  email: string;
  accessToken: string;
  language: SantaCallLanguage;
  expiresAt: string;
  resend?: boolean;
  amountCents?: number;
  currency?: string;
}): Promise<{ sent: boolean; reason?: string }> {
  const kind = input.resend ? "santa_call_resent" : "santa_call_ready";
  const langQs = input.language === "en" ? "?lang=en" : "?lang=ro";
  const callUrl = `${siteOrigin()}/santa/call/${encodeURIComponent(input.accessToken)}${langQs}`;
  const supportUrl = `${siteOrigin()}/support`;
  const paidLabel = formatMoney(input.amountCents, input.currency, input.language);

  const copy =
    input.language === "ro"
      ? {
          subject: "Moș Crăciun te așteaptă! 🎅",
          title: "Moș Crăciun te așteaptă!",
          product: "Sună-l pe Moș Crăciun",
          body: "Achiziția ta este confirmată. Ai o conversație magică de 3 minute cu Moș Crăciun (personaj AI), personalizată pentru copilul tău.",
          cta: "Deschide apelul privat",
          mic: "Permite accesul la microfon când ți se cere. Folosește un spațiu liniștit, fără zgomot puternic.",
          expiry: `Accesul expiră pe ${formatExpiry(input.expiresAt, "ro")}.`,
          ai: "Moșul este un personaj AI. Nu promite livrarea cadourilor și nu înlocuiește supravegherea unui adult.",
          support: "Ai nevoie de ajutor?",
          paid: paidLabel ? `Sumă plătită: ${paidLabel}.` : "",
          duration: "3 minute",
        }
      : {
          subject: "Santa Claus is waiting for your call! 🎅",
          title: "Santa Claus is waiting for your call!",
          product: "Call Santa Claus",
          body: "Your purchase is confirmed. You have a magical 3-minute realtime conversation with AI Santa, personalized for your child.",
          cta: "Open private call",
          mic: "Allow microphone access when prompted. Use a quiet space with minimal background noise.",
          expiry: `Access expires on ${formatExpiry(input.expiresAt, "en")}.`,
          ai: "Santa is an AI character. He does not promise gift delivery and does not replace adult supervision.",
          support: "Need help?",
          paid: paidLabel ? `Amount paid: ${paidLabel}.` : "",
          duration: "3 minutes",
        };

  const html = `<!doctype html><html><body style="font-family:Georgia,serif;background:#1a0b0d;color:#F7F0E4;padding:32px">
  <div style="max-width:560px;margin:0 auto;background:linear-gradient(180deg,#5c0a14,#3b0610);border-radius:18px;padding:28px;border:1px solid #c9a22755">
    <p style="letter-spacing:.12em;text-transform:uppercase;font-size:12px;color:#e8c547;margin:0 0 8px">The Digital Gifter</p>
    <h1 style="font-size:28px;margin:0 0 12px">${escapeHtml(copy.title)}</h1>
    <p style="line-height:1.6;opacity:.92">${escapeHtml(copy.body)}</p>
    <p style="line-height:1.6"><strong>${escapeHtml(copy.product)}</strong> · ${escapeHtml(copy.duration)}${copy.paid ? ` · ${escapeHtml(copy.paid)}` : ""}</p>
    <p style="margin:24px 0"><a href="${escapeHtml(callUrl)}" style="display:inline-block;background:#0f3d2e;color:#F7F0E4;text-decoration:none;padding:14px 22px;border-radius:999px;font-weight:600">${escapeHtml(copy.cta)}</a></p>
    <p style="line-height:1.6;opacity:.9">${escapeHtml(copy.mic)}</p>
    <p style="line-height:1.6;opacity:.9">${escapeHtml(copy.expiry)}</p>
    <p style="line-height:1.6;opacity:.75;font-size:14px">${escapeHtml(copy.ai)}</p>
    <p style="margin-top:24px;font-size:13px;opacity:.7"><a href="${escapeHtml(supportUrl)}" style="color:#e8c547">${escapeHtml(copy.support)}</a></p>
  </div></body></html>`;

  const apiKey = asString(Deno.env.get("RESEND_API_KEY"));
  const from = asString(
    Deno.env.get("CHRISTMAS_EMAIL_FROM") ||
      Deno.env.get("TRANSACTIONAL_EMAIL_FROM") ||
      Deno.env.get("PET_EMAIL_FROM"),
  );

  // Prefer commerce email deliveries table when present; otherwise entitlement metadata.
  const { error: deliveryInsertError } = await input.service.from("christmas_email_deliveries").upsert(
    {
      order_id: input.orderId,
      kind,
      status: apiKey && from ? "queued" : "skipped",
    },
    { onConflict: "order_id,kind" },
  );

  if (deliveryInsertError) {
    console.warn("santa call email delivery row skipped", deliveryInsertError.message);
  }

  if (!apiKey || !from) {
    return { sent: false, reason: "unconfigured" };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `santa-call-${kind}-${input.orderId}`,
    },
    body: JSON.stringify({ from, to: [input.email], subject: copy.subject, html }),
  });

  if (!res.ok) {
    await input.service
      .from("christmas_email_deliveries")
      .update({ status: "failed" })
      .eq("order_id", input.orderId)
      .eq("kind", kind);
    throw new Error(`Santa call email failed (${res.status})`);
  }

  const body = await res.json();
  await input.service
    .from("christmas_email_deliveries")
    .update({ status: "sent", provider_message_id: asString(body.id) })
    .eq("order_id", input.orderId)
    .eq("kind", kind);

  await input.service
    .from("christmas_santa_call_entitlements")
    .update({ email_sent_at: new Date().toISOString() })
    .eq("order_id", input.orderId);

  return { sent: true };
}
