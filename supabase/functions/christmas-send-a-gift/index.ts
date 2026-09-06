import { jsonResponse, optionsResponse } from "../_shared/cors.ts";
import { getServiceClient, readJson } from "../_shared/supabase.ts";
import { SEND_A_GIFT_PRODUCT_KEY } from "../_shared/christmas/sendAGift.ts";
import { sendSendAGiftRecipientEmail } from "../_shared/christmas/sendAGiftEmail.ts";

/**
 * Send-a-Gift seam — christmas_gift_shares / entitlements / redemptions.
 * Never returns private gift message by default.
 */

type Body = {
  action?: string;
  share_id?: string;
  service_key?: string;
  idempotency_key?: string;
  gift_share_id?: string;
  recipient_email?: string;
  force_resend?: boolean;
};

function asString(value: unknown): string {
  return String(value ?? "").trim();
}

async function requireAdmin(req: Request, service: ReturnType<typeof getServiceClient>) {
  const auth = req.headers.get("Authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) return { ok: false as const, status: 401, error: "auth_required" };
  const { data: userData, error } = await service.auth.getUser(token);
  if (error || !userData.user?.email) {
    return { ok: false as const, status: 401, error: "auth_invalid" };
  }
  const email = userData.user.email.trim().toLowerCase();
  const { data: row } = await service.from("admin_users").select("email").eq("email", email).maybeSingle();
  if (!row?.email) return { ok: false as const, status: 403, error: "not_admin" };
  return { ok: true as const, email };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const body = await readJson<Body>(req);
    const action = asString(body.action);
    const service = getServiceClient();

    if (action === "getCatalog") {
      const { data: prod } = await service
        .from("christmas_products")
        .select("id,product_key,name,description,route_path,metadata")
        .eq("product_key", SEND_A_GIFT_PRODUCT_KEY)
        .maybeSingle();
      const { data: packages } = prod?.id
        ? await service
            .from("christmas_packages")
            .select(
              "package_key,package_name,description,currency,price_cents,purchasable,active,features,metadata,sort_order",
            )
            .eq("product_id", prod.id)
            .order("sort_order", { ascending: true })
        : { data: [] };

      return jsonResponse({
        ok: true,
        product: prod,
        packages: packages || [],
        production_purchasable: false,
      });
    }

    if (action === "getGift" || action === "markOpened") {
      const shareId = asString(body.share_id);
      if (shareId.length < 32) return jsonResponse({ error: "invalid_share_id" }, 400);

      if (action === "markOpened") {
        await service.rpc("mark_christmas_gift_opened", { p_share_id: shareId });
      }

      const { data: gift } = await service
        .from("christmas_gift_shares")
        .select(
          "id,share_id,package_key,status,first_opened_at,activated_at,sender_display_name,recipient_display_name,email_status,last_safe_error,order_id",
        )
        .eq("share_id", shareId)
        .maybeSingle();

      if (!gift) return jsonResponse({ error: "gift_unavailable" }, 404);
      if (gift.status === "disabled") {
        return jsonResponse({ ok: true, status: "disabled", gift: null });
      }

      const { data: entitlements } = await service
        .from("christmas_gift_entitlements")
        .select("service_key,total_quantity,used_quantity")
        .eq("gift_share_id", gift.id);

      return jsonResponse({
        ok: true,
        gift: {
          id: gift.id,
          share_id: gift.share_id,
          package_key: gift.package_key,
          status: gift.status,
          first_opened_at: gift.first_opened_at,
          activated_at: gift.activated_at,
          sender_label: gift.sender_display_name,
          recipient_label: gift.recipient_display_name,
          entitlements: (entitlements || []).map((e) => ({
            service_key: e.service_key,
            quantity_total: e.total_quantity,
            quantity_used: e.used_quantity,
            quantity_remaining: Math.max(0, e.total_quantity - e.used_quantity),
          })),
        },
      });
    }

    if (action === "redeem") {
      const shareId = asString(body.share_id);
      const serviceKey = asString(body.service_key);
      const idempotencyKey = asString(body.idempotency_key) || crypto.randomUUID();
      if (shareId.length < 32 || !serviceKey) {
        return jsonResponse({ error: "invalid_redeem_args" }, 400);
      }
      const { data, error } = await service.rpc("redeem_christmas_gift_entitlement", {
        p_share_id: shareId,
        p_service_key: serviceKey,
        p_idempotency_key: idempotencyKey,
        p_quantity: 1,
      });
      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse({ ok: true, result: data, idempotency_key: idempotencyKey });
    }

    if (action === "adminList" || action === "adminDisable" || action === "adminResendEmail" || action === "adminRedemptions") {
      const gate = await requireAdmin(req, service);
      if (!gate.ok) return jsonResponse({ error: gate.error }, gate.status);

      if (action === "adminDisable") {
        const shareId = asString(body.share_id);
        const { data, error } = await service.rpc("disable_christmas_gift_share", {
          p_share_id: shareId,
          p_reason: "admin_disabled",
        });
        if (error) return jsonResponse({ error: error.message }, 500);
        return jsonResponse({ ok: true, result: data });
      }

      if (action === "adminRedemptions") {
        const shareId = asString(body.share_id);
        const { data: gift } = await service
          .from("christmas_gift_shares")
          .select("id,share_id")
          .eq("share_id", shareId)
          .maybeSingle();
        if (!gift) return jsonResponse({ error: "gift_not_found" }, 404);
        const { data: redemptions, error } = await service
          .from("christmas_gift_redemptions")
          .select("id,service_key,quantity,idempotency_key,status,created_at")
          .eq("gift_share_id", gift.id)
          .order("created_at", { ascending: false })
          .limit(100);
        if (error) return jsonResponse({ error: error.message }, 500);
        return jsonResponse({
          ok: true,
          share_id: gift.share_id,
          redemptions: (redemptions || []).map((r) => ({
            id: r.id,
            service_key: r.service_key,
            quantity: r.quantity,
            status: r.status,
            created_at: r.created_at,
            // idempotency_key truncated — not a secret but keep short
            idempotency_key_prefix: String(r.idempotency_key || "").slice(0, 12),
          })),
        });
      }

      if (action === "adminResendEmail") {
        const shareId = asString(body.share_id);
        const toEmail = asString(body.recipient_email);
        const { data: gift } = await service
          .from("christmas_gift_shares")
          .select("id,share_id,order_id,status")
          .eq("share_id", shareId)
          .maybeSingle();
        if (!gift) return jsonResponse({ error: "gift_not_found" }, 404);

        let recipient = toEmail;
        if (!recipient) {
          const { data: order } = await service
            .from("christmas_orders")
            .select("email")
            .eq("id", gift.order_id)
            .maybeSingle();
          recipient = asString(order?.email);
        }
        if (!recipient) return jsonResponse({ error: "recipient_email_required" }, 400);

        const result = await sendSendAGiftRecipientEmail({
          service,
          giftShareId: gift.id,
          shareId: gift.share_id,
          toEmail: recipient,
          forceResend: body.force_resend === true,
        });
        return jsonResponse({ ok: result.sent || result.reason === "already_sent", result });
      }

      const { data: gifts, error } = await service
        .from("christmas_gift_shares")
        .select(
          "id,order_id,share_id,package_key,status,first_opened_at,activated_at,disabled_at,email_status,email_last_sent_at,last_safe_error,created_at",
        )
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) return jsonResponse({ error: error.message }, 500);

      const giftIds = (gifts || []).map((g) => g.id);
      const { data: ents } = giftIds.length
        ? await service
            .from("christmas_gift_entitlements")
            .select("gift_share_id,service_key,total_quantity,used_quantity")
            .in("gift_share_id", giftIds)
        : { data: [] as Array<Record<string, unknown>> };

      const orderIds = [...new Set((gifts || []).map((g) => g.order_id).filter(Boolean))];
      const { data: orders } = orderIds.length
        ? await service
            .from("christmas_orders")
            .select("id,payment_status,fulfillment_status,package_key,amount_cents,currency,last_error")
            .in("id", orderIds)
        : { data: [] as Array<Record<string, unknown>> };

      const orderById = new Map((orders || []).map((o) => [o.id, o]));
      const entsByGift = new Map<string, Array<Record<string, unknown>>>();
      for (const e of ents || []) {
        const list = entsByGift.get(String(e.gift_share_id)) || [];
        list.push(e);
        entsByGift.set(String(e.gift_share_id), list);
      }

      return jsonResponse({
        ok: true,
        gifts: (gifts || []).map((g) => {
          const eList = entsByGift.get(g.id) || [];
          const total = eList.reduce((s, e) => s + Number(e.total_quantity || 0), 0);
          const used = eList.reduce((s, e) => s + Number(e.used_quantity || 0), 0);
          const order = orderById.get(g.order_id);
          return {
            id: g.id,
            order_id: g.order_id,
            share_id: g.share_id,
            gift_url: `/gift/${g.share_id}`,
            package_key: g.package_key,
            status: g.status,
            first_opened_at: g.first_opened_at,
            activated_at: g.activated_at,
            email_status: g.email_status,
            last_safe_error: g.last_safe_error,
            entitlements_total: total,
            entitlements_used: used,
            entitlements_remaining: Math.max(0, total - used),
            payment_status: order?.payment_status ?? null,
            fulfillment_status: order?.fulfillment_status ?? null,
            amount_cents: order?.amount_cents ?? null,
            currency: order?.currency ?? null,
            created_at: g.created_at,
          };
        }),
      });
    }

    return jsonResponse({ error: "unknown_action", action }, 400);
  } catch (err) {
    console.error("christmas-send-a-gift error", err);
    return jsonResponse({ error: "internal_error" }, 500);
  }
});
