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

function siteOrigin(env: Record<string, string | undefined>): string {
  return (
    asString(env.SITE_URL) ||
    asString(env.PUBLIC_APP_URL) ||
    "https://www.thedigitalgifter.com"
  ).replace(/\/$/, "");
}

export function supportFromAddress(env: Record<string, string | undefined>): string {
  return asString(env.PET_EMAIL_FROM || env.TRANSACTIONAL_EMAIL_FROM);
}

export function isResendConfigured(env: Record<string, string | undefined>): boolean {
  return Boolean(asString(env.RESEND_API_KEY) && supportFromAddress(env));
}

export function redactSupportEmailSecrets(value: string): string {
  return value
    .replace(/(guestToken|guest_token|publicToken|public_token|token)=([^\s"'&<>]+)/gi, "$1=[redacted]")
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi, "[redacted]");
}

export function returnInstructions(origin: string): string {
  return `To reply, open ${origin}/support and include your ticket reference in the message. Do not include order links, passwords, or payment details.`;
}

export function buildTicketReceivedEmail(reference: string, env: Record<string, string | undefined>) {
  const origin = siteOrigin(env);
  const ref = asString(reference).toUpperCase();
  const subject = `We received your support ticket ${ref}`;
  const text = [
    "We received your support request.",
    `Ticket reference: ${ref}`,
    "We typically reply within 1–2 business days.",
    returnInstructions(origin),
  ].join("\n\n");
  const html = `<!doctype html><html><body style="background:#0b1220;color:#f6efe4;font-family:Georgia,serif;padding:32px">
<p>We received your support request.</p>
<p>Ticket reference: <strong style="color:#d4a84b">${escapeHtml(ref)}</strong></p>
<p>We typically reply within 1–2 business days.</p>
<p>${escapeHtml(returnInstructions(origin))}</p>
</body></html>`;
  return { subject, text, html };
}

export function buildAdminReplyEmail(
  reference: string,
  replyText: string,
  env: Record<string, string | undefined>,
) {
  const origin = siteOrigin(env);
  const ref = asString(reference).toUpperCase();
  const reply = redactSupportEmailSecrets(asString(replyText));
  const subject = `Update on your support ticket ${ref}`;
  const text = [
    `Here is a reply from The Digital Gifter support for ticket ${ref}.`,
    reply,
    returnInstructions(origin),
  ].join("\n\n");
  const html = `<!doctype html><html><body style="background:#0b1220;color:#f6efe4;font-family:Georgia,serif;padding:32px">
<p>Here is a reply from The Digital Gifter support for ticket <strong style="color:#d4a84b">${escapeHtml(ref)}</strong>.</p>
<p style="white-space:pre-wrap">${escapeHtml(reply)}</p>
<p>${escapeHtml(returnInstructions(origin))}</p>
</body></html>`;
  return { subject, text, html };
}

export async function sendSupportResend(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: boolean; providerMessageId?: string; errorCode?: string }> {
  const env = input.env ?? {
    RESEND_API_KEY: Deno.env.get("RESEND_API_KEY"),
    PET_EMAIL_FROM: Deno.env.get("PET_EMAIL_FROM"),
    TRANSACTIONAL_EMAIL_FROM: Deno.env.get("TRANSACTIONAL_EMAIL_FROM"),
  };
  const apiKey = asString(env.RESEND_API_KEY);
  const from = supportFromAddress(env);
  if (!apiKey || !from) return { ok: false, errorCode: "unconfigured" };

  const fetchImpl = input.fetchImpl ?? fetch;
  const res = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  });

  if (!res.ok) return { ok: false, errorCode: `provider_${res.status}` };

  try {
    const body = (await res.json()) as { id?: string };
    return { ok: true, providerMessageId: asString(body.id) || undefined };
  } catch {
    return { ok: true };
  }
}
