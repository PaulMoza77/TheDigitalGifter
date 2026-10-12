import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { MEMORIES_PLANS, siteOrigin, type MemoriesPlanKey } from "./constants.ts";
import { asString } from "../christmas/crypto.ts";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function sendResend(input: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; id?: string; reason?: string }> {
  const apiKey = asString(Deno.env.get("RESEND_API_KEY"));
  const from = asString(
    Deno.env.get("MEMORIES_EMAIL_FROM") ||
      Deno.env.get("TRANSACTIONAL_EMAIL_FROM") ||
      Deno.env.get("PET_EMAIL_FROM"),
  );
  if (!apiKey || !from) return { ok: false, reason: "unconfigured" };
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [input.to], subject: input.subject, html: input.html }),
  });
  if (!res.ok) return { ok: false, reason: `resend_${res.status}` };
  const body = await res.json();
  return { ok: true, id: asString(body.id) };
}

async function markDelivery(
  service: SupabaseClient,
  input: {
    orderId?: string | null;
    customerId?: string | null;
    kind: string;
    status: string;
    providerMessageId?: string | null;
  },
) {
  const row = {
    order_id: input.orderId || null,
    customer_id: input.customerId || null,
    kind: input.kind,
    status: input.status,
    provider_message_id: input.providerMessageId || null,
  };
  if (input.orderId) {
    await service.from("memories_email_deliveries").upsert(row, { onConflict: "order_id,kind" });
  } else {
    await service.from("memories_email_deliveries").insert(row);
  }
}

function shell(title: string, body: string): string {
  return `<!doctype html><html><body style="font-family:Georgia,serif;background:#1a1510;color:#F4EDE3;padding:32px">
  <div style="max-width:560px;margin:0 auto;background:#2a221a;border-radius:18px;padding:28px;border:1px solid rgba(212,175,122,.35)">
    <p style="margin:0 0 8px;letter-spacing:.14em;text-transform:uppercase;font-size:11px;color:#D4AF7A">Memories by The Digital Gifter</p>
    <h1 style="font-size:26px;margin:0 0 14px;line-height:1.2">${escapeHtml(title)}</h1>
    ${body}
    <p style="font-size:12px;opacity:.55;margin-top:28px">Early Access — Product in Development. Support: support@thedigitalgifter.com</p>
  </div></body></html>`;
}

export async function sendMemoriesEarlyAccessEmail(input: {
  service: SupabaseClient;
  email: string;
  customerId: string;
  orderId?: string | null;
  planKey?: MemoriesPlanKey | null;
  mode: string;
}): Promise<{ sent: boolean; reason?: string }> {
  const kind = "early_access_registration";
  const plan = input.planKey ? MEMORIES_PLANS[input.planKey] : null;
  const manageUrl = `${siteOrigin()}/memories/success`;
  const subject = "You're on the Memories early-access list";
  const html = shell(
    subject,
    `<p style="line-height:1.65;opacity:.92">Thanks for joining Memories early access. The AI memory experience is still in development — you have not been charged for a finished product.</p>
    ${plan ? `<p style="line-height:1.65">Interest recorded for <strong>${escapeHtml(plan.name)}</strong> (${escapeHtml(plan.priceDisplay)}).</p>` : ""}
    <p style="line-height:1.65">Commercial mode: <strong>${escapeHtml(input.mode)}</strong>. Recurring billing begins only when you complete an approved paid checkout and Stripe confirms payment.</p>
    <p style="margin:24px 0"><a href="${manageUrl}" style="display:inline-block;background:#D4AF7A;color:#1a1510;text-decoration:none;padding:14px 22px;border-radius:999px;font-weight:600">View your status</a></p>`,
  );
  await markDelivery(input.service, {
    orderId: input.orderId,
    customerId: input.customerId,
    kind,
    status: "queued",
  });
  const result = await sendResend({ to: input.email, subject, html });
  await markDelivery(input.service, {
    orderId: input.orderId,
    customerId: input.customerId,
    kind,
    status: result.ok ? "sent" : result.reason === "unconfigured" ? "skipped" : "failed",
    providerMessageId: result.id,
  });
  return { sent: Boolean(result.ok), reason: result.reason };
}

export async function sendMemoriesSubscriptionEmail(input: {
  service: SupabaseClient;
  email: string;
  customerId: string;
  orderId: string;
  planKey: MemoriesPlanKey;
  portalHint?: boolean;
}): Promise<{ sent: boolean; reason?: string }> {
  const kind = "subscription_confirmation";
  const plan = MEMORIES_PLANS[input.planKey];
  const subject = "Memories subscription confirmed";
  const html = shell(
    subject,
    `<p style="line-height:1.65">Stripe confirmed your <strong>${escapeHtml(plan.name)}</strong> subscription (${escapeHtml(plan.priceDisplay)}).</p>
    <p style="line-height:1.65"><strong>Important:</strong> Memories generation is not available yet. You are subscribed to early access. We will notify you when the product is ready. You can cancel anytime from the billing portal.</p>
    <p style="margin:24px 0"><a href="${siteOrigin()}/memories/success" style="display:inline-block;background:#D4AF7A;color:#1a1510;text-decoration:none;padding:14px 22px;border-radius:999px;font-weight:600">Manage your membership</a></p>`,
  );
  await markDelivery(input.service, {
    orderId: input.orderId,
    customerId: input.customerId,
    kind,
    status: "queued",
  });
  const result = await sendResend({ to: input.email, subject, html });
  await markDelivery(input.service, {
    orderId: input.orderId,
    customerId: input.customerId,
    kind,
    status: result.ok ? "sent" : result.reason === "unconfigured" ? "skipped" : "failed",
    providerMessageId: result.id,
  });
  return { sent: Boolean(result.ok), reason: result.reason };
}

export async function sendMemoriesLifecycleEmail(input: {
  service: SupabaseClient;
  email: string;
  customerId?: string | null;
  orderId?: string | null;
  kind: "payment_failed" | "cancellation_confirmation" | "refund_confirmation" | "product_available";
  subject: string;
  message: string;
}): Promise<{ sent: boolean; reason?: string }> {
  const html = shell(input.subject, `<p style="line-height:1.65">${escapeHtml(input.message)}</p>`);
  await markDelivery(input.service, {
    orderId: input.orderId,
    customerId: input.customerId,
    kind: input.kind,
    status: "queued",
  });
  const result = await sendResend({ to: input.email, subject: input.subject, html });
  await markDelivery(input.service, {
    orderId: input.orderId,
    customerId: input.customerId,
    kind: input.kind,
    status: result.ok ? "sent" : result.reason === "unconfigured" ? "skipped" : "failed",
    providerMessageId: result.id,
  });
  return { sent: Boolean(result.ok), reason: result.reason };
}

export async function notifyFounderFirstSale(input: {
  orderId: string;
  amountCents: number;
  currency: string;
  planKey: string;
}): Promise<void> {
  const to = asString(
    Deno.env.get("MEMORIES_OPS_NOTIFY_EMAIL") ||
      Deno.env.get("OPS_NOTIFY_EMAIL") ||
      Deno.env.get("FOUNDER_NOTIFY_EMAIL"),
  );
  if (!to) {
    console.log(
      JSON.stringify({
        type: "MEMORIES_FIRST_SALE_VERIFIED",
        ...input,
        note: "No MEMORIES_OPS_NOTIFY_EMAIL configured",
      }),
    );
    return;
  }
  await sendResend({
    to,
    subject: "[TDG] Memories first verified sale",
    html: shell(
      "Memories first verified sale",
      `<p>Order ${escapeHtml(input.orderId)}</p>
      <p>Plan ${escapeHtml(input.planKey)} · ${(input.amountCents / 100).toFixed(2)} ${escapeHtml(input.currency.toUpperCase())}</p>
      <p><strong>Do not start AI product development automatically.</strong> Founder review required.</p>`,
    ),
  });
}
