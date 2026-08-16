import { PET_PRODUCT_NAME, siteOrigin } from "./constants.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

function asString(value: unknown): string {
  return String(value ?? "").trim();
}

function orderUrl(publicToken: string): string {
  return `${siteOrigin()}/pet/order?token=${encodeURIComponent(publicToken)}`;
}

export async function sendPetDeliveryEmail(input: {
  service: SupabaseClient;
  orderId: string;
  petName: string;
  email: string;
  publicToken: string;
  kind: "gallery_ready" | "partial_failure";
}): Promise<{ sent: boolean; reason?: string }> {
  const { data: existing } = await input.service
    .from("pet_email_deliveries")
    .select("id, status")
    .eq("order_id", input.orderId)
    .eq("kind", input.kind)
    .maybeSingle();

  if (existing?.status === "sent") {
    return { sent: false, reason: "already_sent" };
  }

  const { data: template } = await input.service
    .from("email_templates")
    .select("subject, html")
    .eq("name", "pet_gallery_ready")
    .maybeSingle();

  const url = orderUrl(input.publicToken);
  const subject = asString(template?.subject) || `${input.petName}’s portraits are ready`;
  const html = (asString(template?.html) || defaultHtml())
    .replaceAll("{{pet_name}}", escapeHtml(input.petName))
    .replaceAll("{{order_url}}", url)
    .replaceAll("{{product_name}}", PET_PRODUCT_NAME);

  const apiKey = asString(Deno.env.get("RESEND_API_KEY"));
  const from = asString(Deno.env.get("PET_EMAIL_FROM") || Deno.env.get("TRANSACTIONAL_EMAIL_FROM"));

  await input.service.from("pet_email_deliveries").upsert(
    {
      order_id: input.orderId,
      kind: input.kind,
      status: apiKey && from ? "queued" : "skipped",
    },
    { onConflict: "order_id,kind" },
  );

  if (!apiKey || !from) {
    await input.service.rpc("pet_log_event", {
      p_order_id: input.orderId,
      p_action: "delivery_email_skipped",
      p_actor_type: "system",
      p_payload: { reason: "email_unconfigured", kind: input.kind },
    });
    return { sent: false, reason: "unconfigured" };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.email],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    await input.service.from("pet_email_deliveries").update({ status: "failed" }).eq("order_id", input.orderId).eq("kind", input.kind);
    throw new Error(`Delivery email failed (${res.status}): ${detail.slice(0, 180)}`);
  }

  const body = await res.json();
  await input.service
    .from("pet_email_deliveries")
    .update({ status: "sent", provider_message_id: asString(body.id) })
    .eq("order_id", input.orderId)
    .eq("kind", input.kind);
  await input.service
    .from("pet_orders")
    .update({ delivery_email_sent_at: new Date().toISOString() })
    .eq("id", input.orderId);

  return { sent: true };
}

function defaultHtml(): string {
  return `<!doctype html><html><body style="background:#140e0a;color:#f6efe4;font-family:Georgia,serif;padding:32px"><h1 style="color:#d4a84b">${PET_PRODUCT_NAME}</h1><p>{{pet_name}}’s portraits are ready after human quality control.</p><p><a href="{{order_url}}" style="color:#1a140e;background:#d4a84b;padding:12px 20px;border-radius:999px;text-decoration:none">Open the gallery</a></p></body></html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
