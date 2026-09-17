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

export async function sendPlannerReadyEmail(input: {
  service: SupabaseClient;
  orderId: string;
  email: string;
  publicToken: string;
  packageName: string;
  unlocked: string[];
}): Promise<{ sent: boolean; reason?: string }> {
  const kind = "planner_ready";
  const { data: existing } = await input.service
    .from("christmas_email_deliveries")
    .select("id, status")
    .eq("order_id", input.orderId)
    .eq("kind", kind)
    .maybeSingle();
  if (existing?.status === "sent") return { sent: false, reason: "already_sent" };

  const url = `${siteOrigin()}/christmas/planner/welcome?token=${encodeURIComponent(input.publicToken)}`;
  const subject = "Your Christmas Planner is ready 🎄";
  const unlocked = input.unlocked.length
    ? input.unlocked.map((item) => `<li>${escapeHtml(item)}</li>`).join("")
    : "<li>Your Christmas Planner access</li>";
  const html = `<!doctype html><html><body style="font-family:Georgia,serif;background:#10261c;color:#F7F0E4;padding:32px">
  <div style="max-width:560px;margin:0 auto;background:#1B4332;border-radius:18px;padding:28px">
    <h1 style="font-size:28px;margin:0 0 12px">${escapeHtml(subject)}</h1>
    <p style="line-height:1.6;opacity:.9">Thanks for your purchase of ${escapeHtml(input.packageName)}. Your interactive Christmas Planner access is unlocked — this is not a PDF.</p>
    <p style="line-height:1.6;opacity:.9">What you unlocked:</p>
    <ul style="line-height:1.7">${unlocked}</ul>
    <p style="margin:24px 0"><a href="${url}" style="display:inline-block;background:#C9A227;color:#10261c;text-decoration:none;padding:14px 22px;border-radius:999px;font-weight:600">Continue to Planner</a></p>
    <p style="font-size:13px;opacity:.7">Create an account or sign in on that page to keep your Planner on every device. Need help? Visit ${escapeHtml(siteOrigin())}/support</p>
  </div></body></html>`;

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
    },
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
    const providerError = (await res.text()).slice(0, 500);
    await input.service
      .from("christmas_email_deliveries")
      .update({ status: "failed", last_error: providerError || `resend_http_${res.status}` })
      .eq("order_id", input.orderId)
      .eq("kind", kind);
    return { sent: false, reason: "provider_error" };
  }
  const body = (await res.json()) as { id?: string };
  await input.service
    .from("christmas_email_deliveries")
    .update({
      status: "sent",
      provider_message_id: asString(body.id),
      last_error: null,
      sent_at: new Date().toISOString(),
    })
    .eq("order_id", input.orderId)
    .eq("kind", kind);
  return { sent: true };
}
