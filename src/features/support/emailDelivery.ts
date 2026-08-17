export const SUPPORT_SITE_ORIGIN = "https://www.thedigitalgifter.com";

export type SupportEmailKind = "ticket_received" | "admin_reply";
export type SupportEmailStatus = "queued" | "sent" | "pending" | "failed" | "skipped";

export type SupportEmailPayload = {
  subject: string;
  text: string;
  html: string;
};

export type DeliveryDecision =
  | { action: "skip_already_sent"; status: "sent"; send: false }
  | { action: "mark_pending_unconfigured"; status: "pending"; send: false; errorCode: "unconfigured" }
  | { action: "send"; status: "queued"; send: true };

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;
const SECRET_QUERY_RE = /(guestToken|guest_token|publicToken|public_token|token)=(?!\[redacted\])[^\s"'&<>]+/i;

export function supportFromAddress(env: Record<string, string | undefined>): string {
  return String(env.PET_EMAIL_FROM || env.TRANSACTIONAL_EMAIL_FROM || "").trim();
}

export function resendApiKey(env: Record<string, string | undefined>): string {
  return String(env.RESEND_API_KEY || "").trim();
}

export function isResendConfigured(env: Record<string, string | undefined>): boolean {
  return Boolean(resendApiKey(env) && supportFromAddress(env));
}

export function normalizeTicketReference(value: string): string {
  return value.trim().toUpperCase();
}

export function decideSupportEmailAttempt(input: {
  existingStatus?: string | null;
  configured: boolean;
}): DeliveryDecision {
  if (input.existingStatus === "sent") {
    return { action: "skip_already_sent", status: "sent", send: false };
  }
  if (!input.configured) {
    return {
      action: "mark_pending_unconfigured",
      status: "pending",
      send: false,
      errorCode: "unconfigured",
    };
  }
  return { action: "send", status: "queued", send: true };
}

export function statusAfterProviderResult(ok: boolean): SupportEmailStatus {
  return ok ? "sent" : "pending";
}

export function customerNotified(status: string | null | undefined): boolean {
  return status === "sent";
}

export function adminNotificationLabel(status: string | null | undefined): string {
  return customerNotified(status) ? "Customer notified" : "Customer not notified";
}

export function adminReplyToast(status: string | null | undefined): string {
  if (customerNotified(status)) return "Reply saved and the customer was emailed.";
  return "Reply saved. Customer not notified.";
}

export function confirmationCopy(status: string | null | undefined): string | null {
  if (status === "sent") {
    return "We emailed a confirmation that includes this reference.";
  }
  return null;
}

export function supportReturnInstructions(origin = SUPPORT_SITE_ORIGIN): string {
  const site = origin.replace(/\/$/, "");
  return `To reply, open ${site}/support and include your ticket reference in the message. Do not include order links, passwords, or payment details.`;
}

export function redactSupportEmailSecrets(value: string): string {
  return value
    .replace(/(guestToken|guest_token|publicToken|public_token|token)=([^\s"'&<>]+)/gi, "$1=[redacted]")
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi, "[redacted]");
}

export function supportEmailContainsSecrets(value: string): boolean {
  return SECRET_QUERY_RE.test(value) || UUID_RE.test(value) || /mailto:/i.test(value);
}

export function buildTicketReceivedEmail(input: {
  reference: string;
  siteOrigin?: string;
}): SupportEmailPayload {
  const reference = normalizeTicketReference(input.reference);
  const origin = (input.siteOrigin || SUPPORT_SITE_ORIGIN).replace(/\/$/, "");
  const subject = `We received your support ticket ${reference}`;
  const text = [
    "We received your support request.",
    `Ticket reference: ${reference}`,
    "We typically reply within 1–2 business days.",
    supportReturnInstructions(origin),
  ].join("\n\n");
  const html = `<!doctype html><html><body style="background:#0b1220;color:#f6efe4;font-family:Georgia,serif;padding:32px">
<p>We received your support request.</p>
<p>Ticket reference: <strong style="color:#d4a84b">${escapeHtml(reference)}</strong></p>
<p>We typically reply within 1–2 business days.</p>
<p>${escapeHtml(supportReturnInstructions(origin))}</p>
</body></html>`;
  return assertSafeSupportEmail({ subject, text, html });
}

export function buildAdminReplyEmail(input: {
  reference: string;
  replyText: string;
  siteOrigin?: string;
}): SupportEmailPayload {
  const reference = normalizeTicketReference(input.reference);
  const origin = (input.siteOrigin || SUPPORT_SITE_ORIGIN).replace(/\/$/, "");
  const reply = redactSupportEmailSecrets(input.replyText.trim());
  const subject = `Update on your support ticket ${reference}`;
  const text = [
    `Here is a reply from The Digital Gifter support for ticket ${reference}.`,
    reply,
    supportReturnInstructions(origin),
  ].join("\n\n");
  const html = `<!doctype html><html><body style="background:#0b1220;color:#f6efe4;font-family:Georgia,serif;padding:32px">
<p>Here is a reply from The Digital Gifter support for ticket <strong style="color:#d4a84b">${escapeHtml(reference)}</strong>.</p>
<p style="white-space:pre-wrap">${escapeHtml(reply)}</p>
<p>${escapeHtml(supportReturnInstructions(origin))}</p>
</body></html>`;
  return assertSafeSupportEmail({ subject, text, html });
}

export function assertSafeSupportEmail(payload: SupportEmailPayload): SupportEmailPayload {
  const blob = `${payload.subject}\n${payload.text}\n${payload.html}`;
  if (supportEmailContainsSecrets(blob)) {
    throw new Error("unsafe_email_payload");
  }
  return payload;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
