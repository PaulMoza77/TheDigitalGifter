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

  const origin = siteOrigin();
  const plannerUrl = `${origin}/account/christmas`;
  const generatorUrl = `${origin}/generator`;
  const loginUrl = `${origin}/login?next=${encodeURIComponent("/account/christmas")}`;
  const subject = "Your Christmas Planner is ready 🎄";
  const html = `<!doctype html><html><body style="font-family:Georgia,serif;background:#10261c;color:#F7F0E4;padding:32px">
  <div style="max-width:560px;margin:0 auto;background:#1B4332;border-radius:18px;padding:28px">
    <h1 style="font-size:28px;margin:0 0 12px">${escapeHtml(subject)}</h1>
    <p style="line-height:1.6;opacity:.9">Your Christmas Planner 2026 access is confirmed. This is your online planner for the season · not a PDF.</p>
    <p style="line-height:1.6;opacity:.9"><strong>300 bonus AI credits</strong> have been added to the same credits wallet you use for images and videos. They are not cash and cannot be withdrawn.</p>
    <p style="margin:24px 0 12px"><a href="${plannerUrl}" style="display:inline-block;background:#C9A227;color:#10261c;text-decoration:none;padding:14px 22px;border-radius:999px;font-weight:600">Open my Planner</a></p>
    <p style="margin:0 0 24px"><a href="${generatorUrl}" style="display:inline-block;background:transparent;color:#F7F0E4;text-decoration:underline;padding:8px 0;font-weight:600">Go to Generator</a></p>
    <p style="line-height:1.6;opacity:.9">Log in with the same email you used to purchase: <a href="${loginUrl}" style="color:#F0D59A">Log in</a>.</p>
    <p style="font-size:13px;opacity:.7">Need help? Visit ${escapeHtml(origin)}/support</p>
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
