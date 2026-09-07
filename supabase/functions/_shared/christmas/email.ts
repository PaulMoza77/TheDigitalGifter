import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { CHRISTMAS_PACKS, siteOrigin } from "./constants.ts";
import { asString } from "./crypto.ts";

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
}): Promise<{ sent: boolean; reason?: string }> {
  const kind =
    input.packKey === "magic"
      ? "magic_ready"
      : input.packKey === "ultimate"
        ? "ultimate_ready"
        : "starter_ready";

  const { data: existing } = await input.service
    .from("christmas_v2_email_deliveries")
    .select("id, status")
    .eq("order_id", input.orderId)
    .eq("kind", kind)
    .maybeSingle();
  if (existing?.status === "sent") return { sent: false, reason: "already_sent" };

  const pack = CHRISTMAS_PACKS[input.packKey];
  const url = `${siteOrigin()}/christmas-ai-photos/order?token=${encodeURIComponent(input.publicToken)}`;
  const subject =
    input.packKey === "magic"
      ? "Your Christmas Magic Pack is ready"
      : input.packKey === "ultimate"
        ? "Your Ultimate Christmas Pack is ready"
        : "Your Christmas photos are ready 🎄";

  const html = `<!doctype html><html><body style="font-family:Georgia,serif;background:#3b0610;color:#F7F0E4;padding:32px">
  <div style="max-width:560px;margin:0 auto;background:#5c0a14;border-radius:18px;padding:28px">
    <h1 style="font-size:28px;margin:0 0 12px">${escapeHtml(subject)}</h1>
    <p style="line-height:1.6;opacity:.9">${escapeHtml(pack.name)} includes ${pack.imageCount} Christmas photos${
      pack.videoCount ? ` and ${pack.videoCount} short AI video${pack.videoCount > 1 ? "s" : ""}` : ""
    }.</p>
    <p style="margin:24px 0"><a href="${url}" style="display:inline-block;background:#1B4332;color:#F7F0E4;text-decoration:none;padding:14px 22px;border-radius:999px;font-weight:600">View your results</a></p>
    <p style="font-size:12px;opacity:.55">Digital Gifter · No subscription</p>
  </div></body></html>`;

  const apiKey = asString(Deno.env.get("RESEND_API_KEY"));
  const from = asString(
    Deno.env.get("CHRISTMAS_EMAIL_FROM") ||
      Deno.env.get("TRANSACTIONAL_EMAIL_FROM") ||
      Deno.env.get("PET_EMAIL_FROM"),
  );

  await input.service.from("christmas_v2_email_deliveries").upsert(
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
      .from("christmas_v2_email_deliveries")
      .update({ status: "failed" })
      .eq("order_id", input.orderId)
      .eq("kind", kind);
    throw new Error(`Christmas delivery email failed (${res.status})`);
  }
  const body = await res.json();
  await input.service
    .from("christmas_v2_email_deliveries")
    .update({ status: "sent", provider_message_id: asString(body.id) })
    .eq("order_id", input.orderId)
    .eq("kind", kind);
  await input.service
    .from("christmas_v2_orders")
    .update({ delivery_email_sent_at: new Date().toISOString() })
    .eq("id", input.orderId);
  return { sent: true };
}

export async function sendGiftTreePackEmail(input: {
  service: SupabaseClient;
  orderId: string;
  email: string;
  opensGranted: number;
  packageName: string;
}): Promise<{ sent: boolean; reason?: string }> {
  const { data: grant } = await input.service
    .from("christmas_gift_tree_grants")
    .select("id, email_status")
    .eq("order_id", input.orderId)
    .maybeSingle();
  if (grant?.email_status === "sent") return { sent: false, reason: "already_sent" };

  const url = `${siteOrigin()}/christmas/gifts`;
  const subject = "Your Christmas Gift Tree opens are ready";
  const html = `<!doctype html><html><body style="font-family:Georgia,serif;background:#1b1020;color:#F7F0E4;padding:32px">
  <div style="max-width:560px;margin:0 auto;background:#2a1830;border-radius:18px;padding:28px">
    <h1 style="font-size:26px;margin:0 0 12px">${escapeHtml(subject)}</h1>
    <p style="line-height:1.6;opacity:.9">${escapeHtml(input.packageName)} added ${input.opensGranted} catalog gift open${input.opensGranted === 1 ? "" : "s"} to your chance tree.</p>
    <p style="margin:24px 0"><a href="${url}" style="display:inline-block;background:#1B4332;color:#F7F0E4;text-decoration:none;padding:14px 22px;border-radius:999px;font-weight:600">Open your Gift Tree</a></p>
    <p style="font-size:12px;opacity:.55">The Digital Gifter · Rewards are drawn from the catalog when you open a gift. This is not the shareable /christmas/tree.</p>
  </div></body></html>`;

  const apiKey = asString(Deno.env.get("RESEND_API_KEY"));
  const from = asString(
    Deno.env.get("CHRISTMAS_EMAIL_FROM") ||
      Deno.env.get("TRANSACTIONAL_EMAIL_FROM") ||
      Deno.env.get("PET_EMAIL_FROM"),
  );

  if (grant?.id) {
    await input.service
      .from("christmas_gift_tree_grants")
      .update({ email_status: apiKey && from ? "queued" : "skipped" })
      .eq("id", grant.id);
  }

  if (!apiKey || !from) return { sent: false, reason: "unconfigured" };
  if (!input.email) return { sent: false, reason: "no_email" };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [input.email], subject, html }),
  });
  if (!res.ok) {
    if (grant?.id) {
      await input.service
        .from("christmas_gift_tree_grants")
        .update({ email_status: "failed" })
        .eq("id", grant.id);
    }
    throw new Error(`Gift Tree pack email failed (${res.status})`);
  }
  const body = await res.json();
  if (grant?.id) {
    await input.service
      .from("christmas_gift_tree_grants")
      .update({ email_status: "sent", email_provider_id: asString(body.id) })
      .eq("id", grant.id);
  }
  return { sent: true };
}
