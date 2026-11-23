/**
 * Christmas Story durable API (Mission 02B).
 * Guest drafts/orders, hash-at-rest tokens, Stripe TEST checkout only.
 * Does not modify Santa Call commerce.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { optionsResponse, jsonResponse } from "../_shared/cors.ts";
import { getServiceClient, readJson } from "../_shared/supabase.ts";
import { assertRateLimit, clientIp } from "../_shared/rateLimit.ts";
import {
  asString,
  generatePublicToken,
  isUuid,
  sha256Hex,
} from "../_shared/christmas/crypto.ts";
import {
  STORY_CURRENCY,
  STORY_PRICE_CENTS,
  STORY_PRODUCT_KEY,
  assertStoryTransition,
  canMarkRecipientOpened,
} from "../_shared/christmas/storyLifecycle.ts";
import {
  isStoryCheckoutEnabled,
  resolveStoryStripeTestCredentials,
  stripeTestFormPost,
  stripeTestGet,
} from "../_shared/christmas/storyStripe.ts";

type Body = Record<string, unknown>;
type Service = ReturnType<typeof getServiceClient>;

const SIGNED_TTL_SEC = 60 * 15;
const MAX_PHOTOS = 8;
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

function scrubMeta(meta: Record<string, unknown> | null | undefined) {
  const out: Record<string, unknown> = { ...(meta || {}) };
  for (const k of Object.keys(out)) {
    if (/token|email|pin|photo|lyric|memory|name/i.test(k)) delete out[k];
  }
  return out;
}

async function audit(
  service: Service,
  input: {
    orderId?: string | null;
    draftId?: string | null;
    event: string;
    actor?: string;
    metadata?: Record<string, unknown>;
  },
) {
  await service.from("christmas_story_audit_events").insert({
    order_id: input.orderId || null,
    draft_id: input.draftId || null,
    event_name: input.event,
    actor_kind: input.actor || "system",
    metadata: scrubMeta(input.metadata),
  });
}

function buyerDto(order: Record<string, unknown>, recipientToken?: string | null) {
  return {
    id: order.id,
    status: order.status,
    productKey: order.product_key || STORY_PRODUCT_KEY,
    priceCents: order.amount_cents,
    currency: order.currency,
    paymentStatus: order.payment_status,
    checkoutMode: order.stripe_mode,
    content: order.content,
    recipientName: order.recipient_name,
    fromName: order.from_name,
    scheduleAt: order.schedule_at,
    scheduleTz: order.schedule_tz,
    approvedAt: order.approved_at,
    sentAt: order.sent_at,
    openedAt: order.opened_at,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    // Recipient plaintext only when freshly minted for buyer dashboard.
    recipientToken: recipientToken ?? null,
  };
}

async function loadOrderByBuyerToken(service: Service, token: string) {
  if (!token || token.length < 32) return null;
  const hash = await sha256Hex(token);
  const { data, error } = await service
    .from("christmas_story_orders")
    .select("*")
    .eq("buyer_access_token_hash", hash)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function loadOrderByIdForBuyer(service: Service, orderId: string, buyerToken: string) {
  if (!isUuid(orderId)) return null;
  const hash = await sha256Hex(buyerToken);
  const { data, error } = await service
    .from("christmas_story_orders")
    .select("*")
    .eq("id", orderId)
    .eq("buyer_access_token_hash", hash)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function loadRecipientGrant(service: Service, token: string) {
  if (!token || token.length < 32) return null;
  const hash = await sha256Hex(token);
  const { data, error } = await service
    .from("christmas_story_access_grants")
    .select("*")
    .eq("token_hash", hash)
    .eq("grant_kind", "recipient")
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function transition(
  service: Service,
  orderId: string,
  to: string,
  actor = "system",
  metadata: Record<string, unknown> = {},
) {
  const { data, error } = await service.rpc("christmas_story_transition_order", {
    p_order_id: orderId,
    p_to: to,
    p_actor: actor,
    p_metadata: scrubMeta(metadata),
  });
  if (error) throw error;
  return data as Record<string, unknown>;
}

function siteUrl() {
  return (
    asString(Deno.env.get("SITE_URL")) ||
    asString(Deno.env.get("PUBLIC_APP_URL")) ||
    "http://localhost:5173"
  ).replace(/\/$/, "");
}


async function requireStoryAdmin(req: Request): Promise<boolean> {
  const auth = req.headers.get("Authorization") || "";
  const jwt = auth.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) return false;
  const url = Deno.env.get("SUPABASE_URL") || "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false },
  });
  const { data: userData } = await userClient.auth.getUser();
  const email = asString(userData.user?.email).toLowerCase();
  if (!email) return false;
  const service = getServiceClient();
  const { data } = await service.from("admin_users").select("email").eq("email", email).maybeSingle();
  return Boolean(data?.email);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const body = await readJson<Body>(req);
    const action = asString(body.action);
    const service = getServiceClient();
    const ip = clientIp(req);

    if (!(await assertRateLimit(service as never, `story:${action}:${ip}`, 40, 60))) {
      return jsonResponse({ ok: false, code: "rate_limited" }, 429);
    }

    // -------- Drafts --------
    if (action === "saveDraft") {
      const existingToken = asString(body.buyer_access_token);
      const payload = (body.payload && typeof body.payload === "object"
        ? body.payload
        : {}) as Record<string, unknown>;
      // Never persist raw photo data URLs in draft payload at scale — paths only.
      const safePayload = { ...payload };
      delete safePayload.photoDataUrls;

      let buyerToken = existingToken;
      let tokenHash = existingToken ? await sha256Hex(existingToken) : "";
      if (!buyerToken || buyerToken.length < 32) {
        buyerToken = generatePublicToken();
        tokenHash = await sha256Hex(buyerToken);
      }

      const draftId = asString(body.draft_id);
      const email = asString(body.buyer_email).toLowerCase() || null;
      const row = {
        buyer_email: email,
        buyer_access_token_hash: tokenHash,
        occasion: asString(payload.occasion) || "christmas",
        copy_variant: asString(payload.copyVariant) || "emotion_story",
        payload: safePayload,
        photo_count: Math.min(MAX_PHOTOS, Number(body.photo_count) || 0),
        updated_at: new Date().toISOString(),
      };

      let draft: Record<string, unknown> | null = null;
      if (draftId && isUuid(draftId) && existingToken) {
        const { data, error } = await service
          .from("christmas_story_drafts")
          .update(row)
          .eq("id", draftId)
          .eq("buyer_access_token_hash", tokenHash)
          .is("deleted_at", null)
          .select("*")
          .maybeSingle();
        if (error) throw error;
        draft = data;
      }
      if (!draft) {
        const { data, error } = await service
          .from("christmas_story_drafts")
          .insert(row)
          .select("*")
          .single();
        if (error) throw error;
        draft = data;
      }

      await audit(service, {
        draftId: String(draft!.id),
        event: "draft_saved",
        actor: "buyer",
      });

      return jsonResponse({
        ok: true,
        draftId: draft!.id,
        buyerAccessToken: buyerToken,
        updatedAt: draft!.updated_at,
      });
    }

    if (action === "getDraft") {
      const token = asString(body.buyer_access_token);
      const draftId = asString(body.draft_id);
      if (!token || !isUuid(draftId)) {
        return jsonResponse({ ok: false, code: "invalid_request" }, 400);
      }
      const hash = await sha256Hex(token);
      const { data, error } = await service
        .from("christmas_story_drafts")
        .select("id,payload,photo_count,updated_at,occasion,copy_variant")
        .eq("id", draftId)
        .eq("buyer_access_token_hash", hash)
        .is("deleted_at", null)
        .maybeSingle();
      if (error) throw error;
      if (!data) return jsonResponse({ ok: false, code: "not_found" }, 404);
      return jsonResponse({ ok: true, draft: data });
    }

    // -------- Checkout (Stripe TEST) --------
    if (action === "createCheckout") {
      const creds = resolveStoryStripeTestCredentials();
      if (!creds.ok) {
        return jsonResponse({ ok: false, code: creds.code, message: creds.message }, 503);
      }

      const buyerToken = asString(body.buyer_access_token);
      const draftId = asString(body.draft_id);
      const email = asString(body.buyer_email).toLowerCase();
      const fromName = asString(body.from_name) || "Someone who loves you";
      const digitalConsent = body.digital_consent === true;
      if (!buyerToken || buyerToken.length < 32 || !email || !digitalConsent) {
        return jsonResponse({ ok: false, code: "invalid_request" }, 400);
      }
      if (asString(body.client_amount_cents) && Number(body.client_amount_cents) !== STORY_PRICE_CENTS) {
        return jsonResponse({ ok: false, code: "client_amount_rejected" }, 400);
      }

      const tokenHash = await sha256Hex(buyerToken);
      const idempotencyKey =
        asString(body.idempotency_key) || `story-checkout-${draftId || generatePublicToken()}`;

      // Idempotent: return existing pending/paid order for same key
      {
        const { data: existing } = await service
          .from("christmas_story_orders")
          .select("*")
          .eq("idempotency_key", idempotencyKey)
          .maybeSingle();
        if (existing?.stripe_checkout_session_id && existing.payment_status === "pending") {
          // Re-fetch hosted URL when possible; never claim PAID from session reuse alone.
          let checkoutUrl: string | null = null;
          const reuseCreds = resolveStoryStripeTestCredentials();
          if (reuseCreds.ok) {
            const session = await stripeTestGet(
              `checkout/sessions/${existing.stripe_checkout_session_id}`,
              reuseCreds.creds.secretKey,
            );
            if (session.ok) checkoutUrl = asString(session.json.url) || null;
          }
          return jsonResponse({
            ok: true,
            reused: true,
            orderId: existing.id,
            sessionId: existing.stripe_checkout_session_id,
            checkoutUrl,
            clientSecret: null,
            amountCents: STORY_PRICE_CENTS,
            checkoutMode: "test",
            paymentStatus: existing.payment_status,
            status: existing.status,
            message: "Existing CHECKOUT_PENDING session — not marked paid",
          });
        }
      }

      let draftPayload: Record<string, unknown> = {};
      let recipientName = asString(body.recipient_name);
      if (draftId && isUuid(draftId)) {
        const { data: draft } = await service
          .from("christmas_story_drafts")
          .select("*")
          .eq("id", draftId)
          .eq("buyer_access_token_hash", tokenHash)
          .is("deleted_at", null)
          .maybeSingle();
        if (draft?.payload && typeof draft.payload === "object") {
          draftPayload = draft.payload as Record<string, unknown>;
          recipientName = recipientName || asString(draftPayload.recipientName);
        }
      }

      const content = (body.content && typeof body.content === "object" ? body.content : null) as
        | Record<string, unknown>
        | null;

      const { data: order, error: orderErr } = await service
        .from("christmas_story_orders")
        .insert({
          draft_id: draftId && isUuid(draftId) ? draftId : null,
          product_key: STORY_PRODUCT_KEY,
          status: "CHECKOUT_PENDING",
          payment_status: "pending",
          amount_cents: STORY_PRICE_CENTS,
          currency: STORY_CURRENCY,
          buyer_email: email,
          buyer_access_token_hash: tokenHash,
          stripe_mode: "test",
          idempotency_key: idempotencyKey,
          recipient_name: recipientName || null,
          from_name: fromName,
          content,
          digital_consent_at: new Date().toISOString(),
          metadata: {
            product_family: "christmas_story",
            stripe_mode: "test",
            source: "christmas-story",
          },
        })
        .select("*")
        .single();
      if (orderErr) throw orderErr;

      const recipientPlain = generatePublicToken();
      const recipientHash = await sha256Hex(recipientPlain);
      await service.from("christmas_story_access_grants").insert({
        order_id: order.id,
        grant_kind: "recipient",
        token_hash: recipientHash,
        enabled: false, // enabled only after approval + send
        pin_hash: null,
      });

      const successUrl = `${siteUrl()}/christmas-story/order/${order.id}?checkout=success`;
      const cancelUrl = `${siteUrl()}/christmas-story/order/${order.id}?checkout=cancel`;

      // Hosted Stripe Checkout (customer-facing). Server amount is authoritative.
      // Never mark PAID here — only the isolated TEST webhook may fulfill payment.
      const params = new URLSearchParams();
      params.set("mode", "payment");
      params.set("customer_email", email);
      params.set("success_url", `${successUrl}&session_id={CHECKOUT_SESSION_ID}`);
      params.set("cancel_url", cancelUrl);
      params.set("client_reference_id", String(order.id));
      params.set("metadata[product_family]", "christmas_story");
      params.set("metadata[product_key]", STORY_PRODUCT_KEY);
      params.set("metadata[christmas_story_order_id]", String(order.id));
      params.set("metadata[stripe_mode]", "test");
      params.set("line_items[0][price_data][currency]", STORY_CURRENCY);
      params.set("line_items[0][price_data][unit_amount]", String(STORY_PRICE_CENTS));
      params.set("line_items[0][price_data][product_data][name]", "Our Christmas Story");
      params.set("line_items[0][quantity]", "1");
      params.set("expires_at", String(Math.floor(Date.now() / 1000) + 30 * 60));

      const stripe = await stripeTestFormPost(
        "checkout/sessions",
        creds.creds.secretKey,
        params,
        `story-checkout-${order.id}`,
      );
      if (!stripe.ok) {
        await service
          .from("christmas_story_orders")
          .update({ payment_status: "failed", status: "FAILED", failed_reason: "stripe_session_failed" })
          .eq("id", order.id);
        return jsonResponse({
          ok: false,
          code: "stripe_session_failed",
          message: asString((stripe.json.error as { message?: string } | undefined)?.message),
        }, 502);
      }

      const sessionId = asString(stripe.json.id);
      const checkoutUrl = asString(stripe.json.url);
      const clientSecret = asString(stripe.json.client_secret) || null;
      if (!checkoutUrl) {
        await service
          .from("christmas_story_orders")
          .update({ payment_status: "failed", status: "FAILED", failed_reason: "stripe_url_missing" })
          .eq("id", order.id);
        return jsonResponse({ ok: false, code: "stripe_url_missing" }, 502);
      }

      await service
        .from("christmas_story_orders")
        .update({ stripe_checkout_session_id: sessionId })
        .eq("id", order.id);

      await audit(service, {
        orderId: String(order.id),
        event: "checkout_started",
        actor: "buyer",
        metadata: { stripe_mode: "test", ui: "hosted" },
      });

      return jsonResponse({
        ok: true,
        orderId: order.id,
        sessionId,
        checkoutUrl,
        clientSecret,
        publishableKey: creds.creds.publishableKey,
        amountCents: STORY_PRICE_CENTS,
        currency: STORY_CURRENCY,
        recipientToken: recipientPlain,
        checkoutMode: "test",
        paymentStatus: "pending",
        status: "CHECKOUT_PENDING",
        killSwitch: !isStoryCheckoutEnabled() ? "on" : "off",
      });
    }

    // Sync Stripe TEST session status — never fulfills payment from the browser.
    if (action === "syncCheckoutStatus") {
      const order = await loadOrderByIdForBuyer(
        service,
        asString(body.order_id),
        asString(body.buyer_access_token),
      );
      if (!order) return jsonResponse({ ok: false, code: "not_found" }, 404);

      const sessionId = asString(order.stripe_checkout_session_id);
      if (!sessionId) {
        return jsonResponse({
          ok: true,
          order: buyerDto(order),
          stripeStatus: null,
          note: "no_session",
        });
      }

      const creds = resolveStoryStripeTestCredentials();
      if (!creds.ok) {
        // Kill-switch / missing secrets: return durable DB truth only.
        return jsonResponse({
          ok: true,
          order: buyerDto(order),
          stripeStatus: null,
          note: creds.code,
        });
      }

      const session = await stripeTestGet(`checkout/sessions/${sessionId}`, creds.creds.secretKey);
      if (!session.ok) {
        return jsonResponse({
          ok: false,
          code: "stripe_session_retrieve_failed",
          message: asString((session.json.error as { message?: string } | undefined)?.message),
        }, 502);
      }

      const stripeStatus = asString(session.json.status); // open | complete | expired
      const paymentStatus = asString(session.json.payment_status); // unpaid | paid | no_payment_required
      let next = order;

      if (stripeStatus === "expired" && order.payment_status === "pending") {
        const { data } = await service
          .from("christmas_story_orders")
          .update({
            payment_status: "expired",
            status: "FAILED",
            failed_reason: "checkout_expired",
            updated_at: new Date().toISOString(),
          })
          .eq("id", order.id)
          .select("*")
          .single();
        if (data) next = data;
        await audit(service, {
          orderId: String(order.id),
          event: "checkout_expired",
          actor: "buyer",
        });
      } else if (
        (stripeStatus === "open" || paymentStatus === "unpaid") &&
        asString(body.mark_cancelled) === "true" &&
        order.payment_status === "pending"
      ) {
        const { data } = await service
          .from("christmas_story_orders")
          .update({
            payment_status: "failed",
            status: "CANCELLED",
            failed_reason: "checkout_cancelled",
            updated_at: new Date().toISOString(),
          })
          .eq("id", order.id)
          .select("*")
          .single();
        if (data) next = data;
        await audit(service, {
          orderId: String(order.id),
          event: "checkout_cancelled",
          actor: "buyer",
        });
      }

      // Stripe may report paid while DB is still pending — browser sync never fulfills.
      // Only christmas-story-stripe-test-webhook fulfills payment.
      return jsonResponse({
        ok: true,
        order: buyerDto(next),
        stripeStatus,
        stripePaymentStatus: paymentStatus,
        paidLocally: next.payment_status === "paid",
        awaitsWebhook: paymentStatus === "paid" && next.payment_status !== "paid",
      });
    }

    // Guest email recovery — mint short-lived challenge (hash-at-rest).
    if (action === "requestBuyerRecovery") {
      const email = asString(body.buyer_email).toLowerCase();
      if (!email || !email.includes("@")) {
        return jsonResponse({ ok: false, code: "invalid_email" }, 400);
      }
      const { data: orders, error } = await service
        .from("christmas_story_orders")
        .select("id")
        .eq("buyer_email", email)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      if (!orders?.length) {
        // Do not leak whether email exists.
        return jsonResponse({ ok: true, sent: true });
      }

      const plain = generatePublicToken();
      const hash = await sha256Hex(plain);
      const emailHash = await sha256Hex(email);
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      await service.from("christmas_story_recovery_challenges").insert(
        orders.map((o) => ({
          email_hash: emailHash,
          token_hash: hash,
          order_id: o.id,
          expires_at: expiresAt,
        })),
      );
      await audit(service, {
        orderId: String(orders[0].id),
        event: "buyer_recovery_requested",
        actor: "buyer",
      });

      const returnToken =
        asString(Deno.env.get("CHRISTMAS_STORY_RECOVERY_RETURN_TOKEN")).toLowerCase() === "true";
      return jsonResponse({
        ok: true,
        sent: true,
        // Staging-only: return token when email provider is not wired.
        recoveryToken: returnToken ? plain : null,
        expiresAt,
      });
    }

    if (action === "redeemBuyerRecovery") {
      const recoveryToken = asString(body.recovery_token);
      if (!recoveryToken || recoveryToken.length < 32) {
        return jsonResponse({ ok: false, code: "invalid_token" }, 400);
      }
      const hash = await sha256Hex(recoveryToken);
      const { data: challenge, error } = await service
        .from("christmas_story_recovery_challenges")
        .select("*")
        .eq("token_hash", hash)
        .is("consumed_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!challenge) return jsonResponse({ ok: false, code: "invalid_token" }, 404);
      if (new Date(String(challenge.expires_at)).getTime() < Date.now()) {
        return jsonResponse({ ok: false, code: "access_expired" }, 403);
      }

      const { data: order } = await service
        .from("christmas_story_orders")
        .select("*")
        .eq("id", challenge.order_id)
        .is("deleted_at", null)
        .maybeSingle();
      if (!order) return jsonResponse({ ok: false, code: "not_found" }, 404);

      // Mint a fresh buyer access token and rotate hash (email-verified recovery).
      const buyerPlain = generatePublicToken();
      const buyerHash = await sha256Hex(buyerPlain);
      await service
        .from("christmas_story_orders")
        .update({ buyer_access_token_hash: buyerHash, updated_at: new Date().toISOString() })
        .eq("id", order.id);
      await service
        .from("christmas_story_recovery_challenges")
        .update({ consumed_at: new Date().toISOString() })
        .eq("token_hash", hash)
        .is("consumed_at", null);

      await audit(service, {
        orderId: String(order.id),
        event: "buyer_recovery_redeemed",
        actor: "buyer",
      });

      return jsonResponse({
        ok: true,
        buyerAccessToken: buyerPlain,
        order: buyerDto({ ...order, buyer_access_token_hash: buyerHash }),
      });
    }

    // -------- Buyer order --------
    if (action === "getBuyerOrder") {
      const orderId = asString(body.order_id);
      const buyerToken = asString(body.buyer_access_token);
      const order = await loadOrderByIdForBuyer(service, orderId, buyerToken);
      if (!order) return jsonResponse({ ok: false, code: "not_found" }, 404);
      return jsonResponse({ ok: true, order: buyerDto(order) });
    }

    if (action === "listBuyerOrders") {
      const buyerToken = asString(body.buyer_access_token);
      if (!buyerToken) return jsonResponse({ ok: false, code: "invalid_request" }, 400);
      const hash = await sha256Hex(buyerToken);
      const { data, error } = await service
        .from("christmas_story_orders")
        .select("id,status,payment_status,amount_cents,currency,recipient_name,created_at,updated_at,stripe_mode")
        .eq("buyer_access_token_hash", hash)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(40);
      if (error) throw error;
      return jsonResponse({ ok: true, orders: data || [] });
    }

    // Buyer preview — does NOT mark OPENED
    if (action === "buyerPreview") {
      const orderId = asString(body.order_id);
      const buyerToken = asString(body.buyer_access_token);
      const order = await loadOrderByIdForBuyer(service, orderId, buyerToken);
      if (!order) return jsonResponse({ ok: false, code: "not_found" }, 404);
      await audit(service, {
        orderId: String(order.id),
        event: "buyer_preview",
        actor: "buyer",
      });
      return jsonResponse({
        ok: true,
        preview: true,
        marksOpened: false,
        order: buyerDto(order),
      });
    }

    if (action === "approveOrder") {
      const order = await loadOrderByIdForBuyer(
        service,
        asString(body.order_id),
        asString(body.buyer_access_token),
      );
      if (!order) return jsonResponse({ ok: false, code: "not_found" }, 404);
      if (!assertStoryTransition(String(order.status), "APPROVED")) {
        return jsonResponse({ ok: false, code: "invalid_transition" }, 409);
      }
      const updated = await transition(service, String(order.id), "APPROVED", "buyer");
      // Move to READY_TO_SEND automatically after approve
      let ready = updated;
      if (assertStoryTransition("APPROVED", "READY_TO_SEND")) {
        ready = await transition(service, String(order.id), "READY_TO_SEND", "buyer");
      }
      return jsonResponse({ ok: true, order: buyerDto(ready) });
    }

    if (action === "markSent") {
      const order = await loadOrderByIdForBuyer(
        service,
        asString(body.order_id),
        asString(body.buyer_access_token),
      );
      if (!order) return jsonResponse({ ok: false, code: "not_found" }, 404);
      if (!assertStoryTransition(String(order.status), "SENT")) {
        return jsonResponse({ ok: false, code: "invalid_transition" }, 409);
      }
      // Enable recipient grant only now — no access before approval/send
      await service
        .from("christmas_story_access_grants")
        .update({ enabled: true, updated_at: new Date().toISOString() })
        .eq("order_id", order.id)
        .eq("grant_kind", "recipient")
        .is("revoked_at", null);
      const updated = await transition(service, String(order.id), "SENT", "buyer");
      return jsonResponse({ ok: true, order: buyerDto(updated) });
    }

    if (action === "scheduleDelivery") {
      const order = await loadOrderByIdForBuyer(
        service,
        asString(body.order_id),
        asString(body.buyer_access_token),
      );
      if (!order) return jsonResponse({ ok: false, code: "not_found" }, 404);
      const scheduleAt = asString(body.schedule_at) || null;
      const scheduleTz = asString(body.schedule_tz) || "UTC";
      const { data, error } = await service
        .from("christmas_story_orders")
        .update({ schedule_at: scheduleAt, schedule_tz: scheduleTz })
        .eq("id", order.id)
        .select("*")
        .single();
      if (error) throw error;
      await audit(service, {
        orderId: String(order.id),
        event: "schedule_updated",
        actor: "buyer",
        metadata: { has_schedule: Boolean(scheduleAt) },
      });
      return jsonResponse({ ok: true, order: buyerDto(data) });
    }

    if (action === "revokeRecipientAccess") {
      const order = await loadOrderByIdForBuyer(
        service,
        asString(body.order_id),
        asString(body.buyer_access_token),
      );
      if (!order) return jsonResponse({ ok: false, code: "not_found" }, 404);
      // Rotate hash so old links die
      const newHash = await sha256Hex(generatePublicToken());
      await service
        .from("christmas_story_access_grants")
        .update({
          enabled: false,
          revoked_at: new Date().toISOString(),
          token_hash: newHash,
        })
        .eq("order_id", order.id)
        .eq("grant_kind", "recipient");
      await audit(service, {
        orderId: String(order.id),
        event: "recipient_access_revoked",
        actor: "buyer",
      });
      return jsonResponse({ ok: true });
    }

    if (action === "rotateRecipientToken") {
      const order = await loadOrderByIdForBuyer(
        service,
        asString(body.order_id),
        asString(body.buyer_access_token),
      );
      if (!order) return jsonResponse({ ok: false, code: "not_found" }, 404);
      if (!["APPROVED", "READY_TO_SEND", "SENT"].includes(String(order.status))) {
        return jsonResponse({ ok: false, code: "not_ready" }, 409);
      }
      const plain = generatePublicToken();
      const hash = await sha256Hex(plain);
      await service
        .from("christmas_story_access_grants")
        .update({
          token_hash: hash,
          revoked_at: null,
          enabled: String(order.status) === "SENT",
          updated_at: new Date().toISOString(),
        })
        .eq("order_id", order.id)
        .eq("grant_kind", "recipient");
      return jsonResponse({ ok: true, recipientToken: plain });
    }

    // -------- Recipient gift (cross-device) --------
    if (action === "getRecipientGift") {
      const token = asString(body.recipient_token);
      const grant = await loadRecipientGrant(service, token);
      if (!grant) return jsonResponse({ ok: false, code: "invalid_token" }, 404);
      if (grant.revoked_at || !grant.enabled) {
        return jsonResponse({ ok: false, code: "access_revoked" }, 403);
      }
      if (grant.expires_at && new Date(String(grant.expires_at)).getTime() < Date.now()) {
        return jsonResponse({ ok: false, code: "access_expired" }, 403);
      }

      const { data: order, error } = await service
        .from("christmas_story_orders")
        .select("id,status,content,recipient_name,from_name,opened_at,sent_at,approved_at")
        .eq("id", grant.order_id)
        .is("deleted_at", null)
        .maybeSingle();
      if (error) throw error;
      if (!order) return jsonResponse({ ok: false, code: "not_found" }, 404);

      // No recipient access before send/approval path
      if (!["SENT", "OPENED"].includes(String(order.status))) {
        return jsonResponse({ ok: false, code: "not_delivered" }, 403);
      }

      const markOpened = body.mark_opened === true;
      if (markOpened && canMarkRecipientOpened(String(order.status))) {
        await transition(service, String(order.id), "OPENED", "recipient");
        await service
          .from("christmas_story_access_grants")
          .update({
            first_opened_at: grant.first_opened_at || new Date().toISOString(),
            last_opened_at: new Date().toISOString(),
            open_count: Number(grant.open_count || 0) + 1,
          })
          .eq("id", grant.id);
      }

      // Optional PIN check (design present; enforced when pin_hash set)
      if (grant.pin_hash) {
        const pin = asString(body.pin);
        if (!pin) return jsonResponse({ ok: false, code: "pin_required" }, 401);
        const pinHash = await sha256Hex(pin);
        if (pinHash !== grant.pin_hash) {
          return jsonResponse({ ok: false, code: "pin_invalid" }, 401);
        }
      }

      return jsonResponse({
        ok: true,
        gift: {
          orderId: order.id,
          status: order.status,
          content: order.content,
          recipientName: order.recipient_name,
          fromName: order.from_name,
        },
      });
    }

    // -------- Production jobs (manual song / future film) --------
    if (action === "enqueueGeneration") {
      const order = await loadOrderByIdForBuyer(
        service,
        asString(body.order_id),
        asString(body.buyer_access_token),
      );
      if (!order) return jsonResponse({ ok: false, code: "not_found" }, 404);
      if (!["PAID", "CONTENT_PENDING", "GENERATING", "RETRY", "REVIEW_REQUIRED"].includes(String(order.status))) {
        return jsonResponse({ ok: false, code: "invalid_status" }, 409);
      }
      if (String(order.status) === "PAID") {
        await transition(service, String(order.id), "CONTENT_PENDING", "system");
        await transition(service, String(order.id), "GENERATING", "system");
      } else if (String(order.status) === "CONTENT_PENDING") {
        await transition(service, String(order.id), "GENERATING", "system");
      }

      const jobs = [
        { job_type: "story", provider: "mock", status: "ready" },
        { job_type: "song", provider: "manual", status: "awaiting_manual" },
        { job_type: "film", provider: "ffmpeg", status: "queued" },
      ];
      const { data, error } = await service
        .from("christmas_story_jobs")
        .insert(jobs.map((j) => ({ ...j, order_id: order.id })))
        .select("*");
      if (error) throw error;

      // Mock path: mark review required when story ready (song still manual)
      await transition(service, String(order.id), "REVIEW_REQUIRED", "system");
      return jsonResponse({ ok: true, jobs: data });
    }

    if (action === "attachManualSong") {
      // Admin/service path: buyer token OR admin later. For MVP, buyer token after pay.
      const order = await loadOrderByIdForBuyer(
        service,
        asString(body.order_id),
        asString(body.buyer_access_token),
      );
      if (!order) return jsonResponse({ ok: false, code: "not_found" }, 404);
      const storagePath = asString(body.storage_path);
      if (!storagePath.startsWith(`${order.id}/`)) {
        return jsonResponse({ ok: false, code: "invalid_path" }, 400);
      }
      const { data: asset, error } = await service
        .from("christmas_story_assets")
        .insert({
          order_id: order.id,
          asset_kind: "song",
          storage_bucket: "christmas-story-generated",
          storage_path: storagePath,
          content_type: asString(body.content_type) || "audio/mpeg",
          metadata: { provider: "manual", commercial_rights: asString(body.commercial_rights) },
        })
        .select("*")
        .single();
      if (error) throw error;
      await service
        .from("christmas_story_jobs")
        .update({ status: "ready", result_asset_id: asset.id, provider: "manual" })
        .eq("order_id", order.id)
        .eq("job_type", "song");
      return jsonResponse({ ok: true, assetId: asset.id });
    }

    if (action === "createUploadUrl") {
      const buyerToken = asString(body.buyer_access_token);
      const orderId = asString(body.order_id);
      const order = orderId
        ? await loadOrderByIdForBuyer(service, orderId, buyerToken)
        : await loadOrderByBuyerToken(service, buyerToken);
      const draftId = asString(body.draft_id);
      if (!buyerToken) return jsonResponse({ ok: false, code: "invalid_request" }, 400);
      const contentType = asString(body.content_type) || "image/jpeg";
      if (!["image/jpeg", "image/png", "image/webp"].includes(contentType)) {
        return jsonResponse({ ok: false, code: "invalid_content_type" }, 400);
      }
      const byteSize = Number(body.byte_size) || 0;
      if (byteSize <= 0 || byteSize > MAX_PHOTO_BYTES) {
        return jsonResponse({ ok: false, code: "file_too_large" }, 400);
      }
      const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
      const owner = order?.id || draftId || "anonymous";
      const path = `${owner}/${generatePublicToken()}.${ext}`;
      const { data, error } = await service.storage
        .from("christmas-story-source")
        .createSignedUploadUrl(path);
      if (error) throw error;
      return jsonResponse({
        ok: true,
        bucket: "christmas-story-source",
        path,
        token: data?.token,
        signedUrl: data?.signedUrl,
        maxBytes: MAX_PHOTO_BYTES,
      });
    }

    if (action === "signMedia") {
      const buyerToken = asString(body.buyer_access_token);
      const recipientToken = asString(body.recipient_token);
      const assetId = asString(body.asset_id);
      if (!isUuid(assetId)) return jsonResponse({ ok: false, code: "invalid_request" }, 400);

      const { data: asset, error } = await service
        .from("christmas_story_assets")
        .select("*")
        .eq("id", assetId)
        .is("deleted_at", null)
        .maybeSingle();
      if (error) throw error;
      if (!asset) return jsonResponse({ ok: false, code: "not_found" }, 404);

      let allowed = false;
      if (buyerToken) {
        const order = await loadOrderByIdForBuyer(service, String(asset.order_id), buyerToken);
        allowed = Boolean(order);
      } else if (recipientToken) {
        const grant = await loadRecipientGrant(service, recipientToken);
        allowed =
          Boolean(grant?.enabled) &&
          !grant?.revoked_at &&
          String(grant?.order_id) === String(asset.order_id);
      }
      if (!allowed) return jsonResponse({ ok: false, code: "forbidden" }, 403);

      const signed = await service.storage
        .from(String(asset.storage_bucket))
        .createSignedUrl(String(asset.storage_path), SIGNED_TTL_SEC);
      return jsonResponse({
        ok: true,
        url: signed.data?.signedUrl || null,
        expiresIn: SIGNED_TTL_SEC,
      });
    }

    if (action === "requestDeletion") {
      const buyerToken = asString(body.buyer_access_token);
      const orderId = asString(body.order_id);
      if (!buyerToken) return jsonResponse({ ok: false, code: "invalid_request" }, 400);
      const hash = await sha256Hex(buyerToken);
      const { data, error } = await service
        .from("christmas_story_deletion_requests")
        .insert({
          order_id: isUuid(orderId) ? orderId : null,
          buyer_access_token_hash: hash,
          status: "pending",
        })
        .select("*")
        .single();
      if (error) throw error;

      if (isUuid(orderId)) {
        await service
          .from("christmas_story_orders")
          .update({ deleted_at: new Date().toISOString() })
          .eq("id", orderId)
          .eq("buyer_access_token_hash", hash);
        await service
          .from("christmas_story_access_grants")
          .update({ enabled: false, revoked_at: new Date().toISOString() })
          .eq("order_id", orderId);
      }

      await audit(service, {
        orderId: isUuid(orderId) ? orderId : null,
        event: "deletion_requested",
        actor: "buyer",
      });
      return jsonResponse({ ok: true, requestId: data.id });
    }

    // -------- Mission 02D media admin + buyer review --------
    function requireStoryAdmin(req: Request) {
      const expected = asString(Deno.env.get("CHRISTMAS_STORY_ADMIN_TOKEN"));
      if (!expected || expected.length < 24) {
        return { ok: false as const, code: "admin_token_unconfigured" };
      }
      const got = asString(req.headers.get("x-christmas-story-admin-token"));
      if (!got || got.length !== expected.length) {
        return { ok: false as const, code: "unauthorized_admin" };
      }
      // Constant-time-ish compare
      let diff = 0;
      for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ got.charCodeAt(i);
      if (diff !== 0) return { ok: false as const, code: "unauthorized_admin" };
      return { ok: true as const };
    }

    if (action === "adminListSongQueue") {
      const gate = requireStoryAdmin(req);
      if (!gate.ok) return jsonResponse({ ok: false, code: gate.code }, 401);
      const { data, error } = await service
        .from("christmas_story_jobs")
        .select("id,order_id,status,production_state,provider,metadata,created_at,updated_at,output_checksum")
        .eq("job_type", "song")
        .order("created_at", { ascending: true })
        .limit(100);
      if (error) throw error;
      // Strip any accidental photo payloads from briefs
      const jobs = (data || []).map((row) => {
        const meta = (row.metadata || {}) as Record<string, unknown>;
        const brief = (meta.brief || {}) as Record<string, unknown>;
        delete brief.photos;
        delete brief.photoDataUrls;
        delete brief.buyerEmail;
        return { ...row, metadata: { ...meta, brief } };
      });
      return jsonResponse({ ok: true, jobs });
    }

    if (action === "adminAdvanceSongState") {
      const gate = requireStoryAdmin(req);
      if (!gate.ok) return jsonResponse({ ok: false, code: gate.code }, 401);
      const jobId = asString(body.job_id);
      const to = asString(body.production_state);
      if (!isUuid(jobId) || !to) return jsonResponse({ ok: false, code: "invalid_request" }, 400);
      const { data: job, error } = await service
        .from("christmas_story_jobs")
        .select("*")
        .eq("id", jobId)
        .eq("job_type", "song")
        .maybeSingle();
      if (error) throw error;
      if (!job) return jsonResponse({ ok: false, code: "not_found" }, 404);
      const { data: updated, error: upErr } = await service
        .from("christmas_story_jobs")
        .update({
          production_state: to,
          status: to === "ready_for_buyer_review" || to === "approved" ? "ready" : job.status,
          metadata: {
            ...(job.metadata || {}),
            adminNote: asString(body.note).slice(0, 500),
            rightsDisclaimer:
              "AI-assisted generation does not by itself confer copyright ownership or commercial license.",
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId)
        .select("*")
        .single();
      if (upErr) throw upErr;
      await audit(service, {
        orderId: String(job.order_id),
        event: "song_state_advanced",
        actor: "admin",
        metadata: { to },
      });
      return jsonResponse({ ok: true, job: updated });
    }

    if (action === "requestMediaRevision") {
      const order = await loadOrderByIdForBuyer(
        service,
        asString(body.order_id),
        asString(body.buyer_access_token),
      );
      if (!order) return jsonResponse({ ok: false, code: "not_found" }, 404);
      if (!["REVIEW_REQUIRED", "APPROVED", "READY_TO_SEND"].includes(String(order.status))) {
        return jsonResponse({ ok: false, code: "invalid_status" }, 409);
      }
      const mediaKind = asString(body.media_kind);
      const reason = asString(body.reason).slice(0, 500);
      if (!["song", "film"].includes(mediaKind) || reason.length < 4) {
        return jsonResponse({ ok: false, code: "invalid_request" }, 400);
      }
      const { data, error } = await service
        .from("christmas_story_media_revisions")
        .insert({
          order_id: order.id,
          media_kind: mediaKind,
          reason,
          status: "open",
        })
        .select("*")
        .single();
      if (error) throw error;
      if (mediaKind === "song") {
        await service
          .from("christmas_story_jobs")
          .update({
            production_state: "revision_requested",
            status: "awaiting_manual",
            updated_at: new Date().toISOString(),
          })
          .eq("order_id", order.id)
          .eq("job_type", "song");
      }
      if (mediaKind === "film") {
        await service
          .from("christmas_story_jobs")
          .update({
            status: "queued",
            error_code: null,
            updated_at: new Date().toISOString(),
            metadata: { revision_reason: reason },
          })
          .eq("order_id", order.id)
          .eq("job_type", "film");
      }
      await audit(service, {
        orderId: String(order.id),
        event: "media_revision_requested",
        actor: "buyer",
        metadata: { media_kind: mediaKind },
      });
      return jsonResponse({ ok: true, revision: data });
    }

    if (action === "listOrderMediaJobs") {
      const order = await loadOrderByIdForBuyer(
        service,
        asString(body.order_id),
        asString(body.buyer_access_token),
      );
      if (!order) return jsonResponse({ ok: false, code: "not_found" }, 404);
      const { data, error } = await service
        .from("christmas_story_jobs")
        .select("id,job_type,status,production_state,provider,output_checksum,updated_at,metadata")
        .eq("order_id", order.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return jsonResponse({ ok: true, jobs: data || [] });
    }

    if (action === "health") {
      return jsonResponse({
        ok: true,
        product: STORY_PRODUCT_KEY,
        priceCents: STORY_PRICE_CENTS,
        checkoutEnabled: isStoryCheckoutEnabled(),
        stripeMode: isStoryCheckoutEnabled() ? "test_only" : "disabled",
        mediaWorker: "external_vps_or_local",
      });
    }

    return jsonResponse({ ok: false, code: "unknown_action" }, 400);
  } catch (err) {
    console.error("[christmas-story]", err instanceof Error ? err.message : "error");
    return jsonResponse({ ok: false, code: "internal_error" }, 500);
  }
});
