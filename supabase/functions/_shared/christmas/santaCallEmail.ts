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

export type SantaCallReadyEmailContent = {
  subject: string;
  html: string;
  text: string;
  callUrl: string;
  supportUrl: string;
  privacyUrl: string;
  termsUrl: string;
  brandUrl: string;
  links: string[];
};

/** Build the production customer email (no send). Used for link QA + delivery. */
export function buildSantaCallReadyEmailContent(input: {
  accessToken: string;
  language: SantaCallLanguage;
  expiresAt: string;
  amountCents?: number;
  currency?: string;
  childFirstName?: string;
  previewBanner?: string | null;
}): SantaCallReadyEmailContent {
  const origin = siteOrigin();
  const langQs = input.language === "en" ? "?lang=en" : "?lang=ro";
  const callUrl = `${origin}/santa/call/${encodeURIComponent(input.accessToken)}${langQs}`;
  const supportUrl = `${origin}/support`;
  const privacyUrl = `${origin}/privacy`;
  const termsUrl = `${origin}/terms`;
  const brandUrl = origin;
  const paidLabel = formatMoney(input.amountCents, input.currency, input.language);
  const child = asString(input.childFirstName).trim().slice(0, 40);
  const previewBanner = asString(input.previewBanner).trim();

  const copy =
    input.language === "ro"
      ? {
          subject: "🎅 Apelul cu Moș Crăciun este pregătit!",
          greeting: child ? `Bună! Apelul pentru ${child} este gata.` : "Bună! Apelul tău este gata.",
          title: "Apelul cu Moș Crăciun este pregătit!",
          product: "Sună-l pe Moș Crăciun",
          confirm: "Plata a fost confirmată cu succes.",
          body: child
            ? `${child} are o conversație magică de 3 minute cu Moș Crăciun (personaj AI), personalizată.`
            : "Ai o conversație magică de 3 minute cu Moș Crăciun (personaj AI), personalizată pentru copilul tău.",
          cta: "Începe apelul cu Moș Crăciun",
          mic: "Înainte de apel: permite accesul la microfon când ți se cere și alege un spațiu liniștit.",
          expiry: `Accesul expiră pe ${formatExpiry(input.expiresAt, "ro")}.`,
          ai: "Moșul este un personaj AI. Nu promite livrarea cadourilor și nu înlocuiește supravegherea unui adult.",
          support: "Ai nevoie de ajutor? Răspunde la acest email sau vizitează pagina de suport.",
          paid: paidLabel ? `Sumă plătită: ${paidLabel}` : "",
          duration: "Durată: 3 minute",
          privacy: "Confidențialitate",
          terms: "Termeni",
          supportLabel: "Suport",
        }
      : {
          subject: "🎅 Your Santa call is ready!",
          greeting: child ? `Hi! ${child}'s call is ready.` : "Hi! Your call is ready.",
          title: "Your Santa call is ready!",
          product: "Call Santa Claus",
          confirm: "Your payment was confirmed successfully.",
          body: child
            ? `${child} has a magical 3-minute realtime conversation with AI Santa, personalized just for them.`
            : "You have a magical 3-minute realtime conversation with AI Santa, personalized for your child.",
          cta: "Start the call with Santa",
          mic: "Before the call: allow microphone access when prompted and choose a quiet space.",
          expiry: `Access expires on ${formatExpiry(input.expiresAt, "en")}.`,
          ai: "Santa is an AI character. He does not promise gift delivery and does not replace adult supervision.",
          support: "Need help? Reply to this email or visit our support page.",
          paid: paidLabel ? `Amount paid: ${paidLabel}` : "",
          duration: "Duration: 3 minutes",
          privacy: "Privacy",
          terms: "Terms",
          supportLabel: "Support",
        };

  const bannerHtml = previewBanner
    ? `<tr><td style="padding:12px 24px 0;font-family:Georgia,'Times New Roman',serif;font-size:12px;line-height:1.5;color:#3b0610;background:#e8c547;">${escapeHtml(previewBanner)}</td></tr>`
    : "";

  const html = `<!doctype html>
<html lang="${input.language === "ro" ? "ro" : "en"}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(copy.subject)}</title>
</head>
<body style="margin:0;padding:0;background:#1a0b0d;-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    ${escapeHtml(copy.greeting)} ${escapeHtml(copy.duration)}${copy.paid ? ` · ${escapeHtml(copy.paid)}` : ""}
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#1a0b0d;margin:0;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#5c0a14;border:1px solid #c9a22766;border-radius:18px;overflow:hidden;">
          ${bannerHtml}
          <tr>
            <td style="padding:28px 24px 8px;font-family:Georgia,'Times New Roman',serif;">
              <a href="${escapeHtml(brandUrl)}" style="text-decoration:none;color:#e8c547;font-size:12px;letter-spacing:.14em;text-transform:uppercase;">The Digital Gifter</a>
              <h1 style="margin:12px 0 0;font-size:26px;line-height:1.25;color:#F7F0E4;font-weight:700;">${escapeHtml(copy.title)}</h1>
              <p style="margin:14px 0 0;font-size:16px;line-height:1.55;color:#F7F0E4;">${escapeHtml(copy.greeting)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 24px 0;font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:1.6;color:#F7F0E4;">
              <p style="margin:0 0 10px;">${escapeHtml(copy.confirm)}</p>
              <p style="margin:0 0 10px;">${escapeHtml(copy.body)}</p>
              <p style="margin:0;"><strong>${escapeHtml(copy.product)}</strong><br>${escapeHtml(copy.duration)}${copy.paid ? `<br>${escapeHtml(copy.paid)}` : ""}</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:24px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" bgcolor="#0f3d2e" style="border-radius:999px;">
                    <a href="${escapeHtml(callUrl)}" style="display:inline-block;padding:14px 26px;font-family:Georgia,'Times New Roman',serif;font-size:16px;font-weight:700;color:#F7F0E4;text-decoration:none;border-radius:999px;background:#0f3d2e;">
                      ${escapeHtml(copy.cta)}
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:14px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:13px;line-height:1.5;color:#F7F0E4;opacity:.85;word-break:break-all;">
                ${escapeHtml(callUrl)}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 24px 24px;font-family:Georgia,'Times New Roman',serif;font-size:14px;line-height:1.6;color:#F7F0E4;">
              <p style="margin:0 0 10px;">${escapeHtml(copy.mic)}</p>
              <p style="margin:0 0 10px;opacity:.9;">${escapeHtml(copy.expiry)}</p>
              <p style="margin:0;opacity:.75;font-size:13px;">${escapeHtml(copy.ai)}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px 24px;border-top:1px solid #c9a22744;font-family:Georgia,'Times New Roman',serif;font-size:13px;line-height:1.6;color:#F7F0E4;opacity:.85;">
              <p style="margin:0 0 8px;">${escapeHtml(copy.support)}</p>
              <p style="margin:0;">
                <a href="${escapeHtml(supportUrl)}" style="color:#e8c547;text-decoration:underline;">${escapeHtml(copy.supportLabel)}</a>
                &nbsp;·&nbsp;
                <a href="${escapeHtml(privacyUrl)}" style="color:#e8c547;text-decoration:underline;">${escapeHtml(copy.privacy)}</a>
                &nbsp;·&nbsp;
                <a href="${escapeHtml(termsUrl)}" style="color:#e8c547;text-decoration:underline;">${escapeHtml(copy.terms)}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    previewBanner || "",
    copy.subject,
    "",
    copy.greeting,
    copy.confirm,
    copy.body,
    `${copy.product} · ${copy.duration}${copy.paid ? ` · ${copy.paid}` : ""}`,
    "",
    `${copy.cta}:`,
    callUrl,
    "",
    copy.mic,
    copy.expiry,
    copy.ai,
    "",
    copy.support,
    `Support: ${supportUrl}`,
    `Privacy: ${privacyUrl}`,
    `Terms: ${termsUrl}`,
    `Brand: ${brandUrl}`,
  ]
    .filter((line, idx, arr) => !(line === "" && arr[idx - 1] === ""))
    .join("\n");

  const links = [brandUrl, callUrl, supportUrl, privacyUrl, termsUrl];

  return {
    subject: copy.subject,
    html,
    text,
    callUrl,
    supportUrl,
    privacyUrl,
    termsUrl,
    brandUrl,
    links,
  };
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
  childFirstName?: string;
  previewBanner?: string | null;
}): Promise<{ sent: boolean; reason?: string; providerMessageId?: string; content?: SantaCallReadyEmailContent }> {
  const kind = input.resend ? "santa_call_resent" : "santa_call_ready";
  const content = buildSantaCallReadyEmailContent({
    accessToken: input.accessToken,
    language: input.language,
    expiresAt: input.expiresAt,
    amountCents: input.amountCents,
    currency: input.currency,
    childFirstName: input.childFirstName,
    previewBanner: input.previewBanner,
  });

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

  // Idempotency: do not re-send the same kind unless explicit resend.
  if (!input.resend) {
    const { data: prior } = await input.service
      .from("christmas_email_deliveries")
      .select("status,provider_message_id")
      .eq("order_id", input.orderId)
      .eq("kind", kind)
      .maybeSingle();
    if (asString(prior?.status) === "sent" && asString(prior?.provider_message_id)) {
      return {
        sent: true,
        reason: "already_sent",
        providerMessageId: asString(prior?.provider_message_id),
        content,
      };
    }
  }

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
    return { sent: false, reason: "unconfigured", content };
  }

  // Best-effort attempt counter for delivery observability / future retry worker.
  {
    const { data: row } = await input.service
      .from("christmas_email_deliveries")
      .select("attempt_count")
      .eq("order_id", input.orderId)
      .eq("kind", kind)
      .maybeSingle();
    const next = Number(row?.attempt_count || 0) + 1;
    await input.service
      .from("christmas_email_deliveries")
      .update({ attempt_count: next })
      .eq("order_id", input.orderId)
      .eq("kind", kind);
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `santa-call-${kind}-${input.orderId}`,
    },
    body: JSON.stringify({
      from,
      to: [input.email],
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
    throw new Error(`Santa call email failed (${res.status})`);
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

  await input.service
    .from("christmas_santa_call_entitlements")
    .update({ email_sent_at: new Date().toISOString() })
    .eq("order_id", input.orderId);

  return { sent: true, providerMessageId, content };
}
