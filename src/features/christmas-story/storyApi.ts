/**
 * Christmas Story durable API client (Mission 02C).
 * When the durable API is enabled, server authorization is authoritative:
 * denials and failures must never be papered over with fake local success.
 */

import { supabase } from "@/lib/supabase";
import type { StoryGiftContent, StoryGiftDraft, StoryOrder } from "./types";
import { STORY_PRICE_CENTS } from "./types";

const BUYER_TOKEN_KEY = "tdg.christmas-story.buyer-access.v1";
const DRAFT_ID_KEY = "tdg.christmas-story.draft-id.v1";
const RECIPIENT_TOKEN_KEY = "tdg.christmas-story.recipient-token.v1";

export function isStoryApiEnabled(): boolean {
  const flag = String(import.meta.env.VITE_CHRISTMAS_STORY_API_ENABLED || "")
    .trim()
    .toLowerCase();
  return flag === "true" || flag === "1" || flag === "on";
}

export function readBuyerAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(BUYER_TOKEN_KEY);
}

export function writeBuyerAccessToken(token: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(BUYER_TOKEN_KEY, token);
}

export function readDraftId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(DRAFT_ID_KEY);
}

export function writeDraftId(id: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(DRAFT_ID_KEY, id);
}

export function readRecipientToken(orderId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(RECIPIENT_TOKEN_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    return map[orderId] || null;
  } catch {
    return null;
  }
}

export function writeRecipientToken(orderId: string, token: string) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(RECIPIENT_TOKEN_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    map[orderId] = token;
    localStorage.setItem(RECIPIENT_TOKEN_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

async function storyAction<T>(
  action: string,
  body: Record<string, unknown> = {},
): Promise<{ ok: true; data: T } | { ok: false; code: string; message?: string }> {
  const { data, error } = await supabase.functions.invoke("christmas-story", {
    body: { action, ...body },
  });
  if (error) {
    return { ok: false, code: "invoke_failed", message: error.message };
  }
  const payload = (data || {}) as Record<string, unknown>;
  if (payload.ok === false) {
    return {
      ok: false,
      code: String(payload.code || "error"),
      message: payload.message ? String(payload.message) : undefined,
    };
  }
  return { ok: true, data: payload as T };
}

export function mapServerOrderToStoryOrder(
  remote: Record<string, unknown>,
  fallback?: Partial<StoryOrder>,
): StoryOrder {
  const status = String(remote.status || fallback?.status || "CHECKOUT_PENDING") as StoryOrder["status"];
  return {
    id: String(remote.id || fallback?.id || ""),
    status,
    productKey: "our_christmas_story",
    priceCents: Number(remote.priceCents ?? remote.amount_cents ?? STORY_PRICE_CENTS),
    currency: "usd",
    draft: fallback?.draft || ({} as StoryOrder["draft"]),
    content: (remote.content as StoryOrder["content"]) ?? fallback?.content ?? null,
    recipientToken:
      (remote.recipientToken as string) ||
      fallback?.recipientToken ||
      readRecipientToken(String(remote.id || "")) ||
      "",
    pin: fallback?.pin ?? null,
    checkoutMode: (String(remote.checkoutMode || remote.stripe_mode || "test") as StoryOrder["checkoutMode"]),
    costs: fallback?.costs || {
      paymentProcessingCents: 0,
      aiTextCents: 0,
      songCents: 0,
      videoCents: 0,
      storageCents: 0,
      retriesCents: 0,
      supportCents: 0,
    },
    createdAt: String(remote.createdAt || remote.created_at || fallback?.createdAt || new Date().toISOString()),
    updatedAt: String(remote.updatedAt || remote.updated_at || new Date().toISOString()),
    approvedAt: (remote.approvedAt || remote.approved_at || fallback?.approvedAt || null) as string | null,
    sentAt: (remote.sentAt || remote.sent_at || fallback?.sentAt || null) as string | null,
    openedAt: (remote.openedAt || remote.opened_at || fallback?.openedAt || null) as string | null,
  };
}

export async function syncDraftToServer(draft: StoryGiftDraft): Promise<{
  ok: boolean;
  draftId?: string;
  buyerAccessToken?: string;
  code?: string;
}> {
  if (!isStoryApiEnabled()) return { ok: false, code: "api_disabled" };
  const res = await storyAction<{
    draftId: string;
    buyerAccessToken: string;
  }>("saveDraft", {
    draft_id: readDraftId(),
    buyer_access_token: readBuyerAccessToken(),
    buyer_email: draft.buyerEmail || null,
    photo_count: draft.photoDataUrls?.length || 0,
    payload: {
      ...draft,
      photoDataUrls: undefined,
    },
  });
  if (!res.ok) return { ok: false, code: res.code };
  writeDraftId(res.data.draftId);
  writeBuyerAccessToken(res.data.buyerAccessToken);
  return {
    ok: true,
    draftId: res.data.draftId,
    buyerAccessToken: res.data.buyerAccessToken,
  };
}

export async function createStoryCheckout(input: {
  draft: StoryGiftDraft;
  content: StoryGiftContent | null;
  fromName?: string;
}): Promise<
  | {
      ok: true;
      orderId: string;
      checkoutUrl: string | null;
      clientSecret: string | null;
      publishableKey: string | null;
      recipientToken: string | null;
      amountCents: number;
      checkoutMode: string;
      paymentStatus: string;
      status: string;
    }
  | { ok: false; code: string; message?: string }
> {
  if (!isStoryApiEnabled()) {
    return { ok: false, code: "api_disabled" };
  }
  const synced = await syncDraftToServer(input.draft);
  if (!synced.ok) {
    return { ok: false, code: synced.code || "draft_sync_failed" };
  }
  const res = await storyAction<{
    orderId: string;
    checkoutUrl: string | null;
    clientSecret: string | null;
    publishableKey: string | null;
    recipientToken: string;
    amountCents: number;
    checkoutMode: string;
    paymentStatus: string;
    status: string;
  }>("createCheckout", {
    draft_id: readDraftId(),
    buyer_access_token: readBuyerAccessToken(),
    buyer_email: input.draft.buyerEmail,
    recipient_name: input.draft.recipientName,
    from_name: input.fromName || "You",
    digital_consent: input.draft.digitalConsent === true,
    content: input.content,
    client_amount_cents: STORY_PRICE_CENTS,
    idempotency_key: `story-${readDraftId() || "anon"}-${input.draft.buyerEmail}`,
  });
  if (!res.ok) return res;
  if (res.data.recipientToken) {
    writeRecipientToken(res.data.orderId, res.data.recipientToken);
  }
  return {
    ok: true,
    orderId: res.data.orderId,
    checkoutUrl: res.data.checkoutUrl || null,
    clientSecret: res.data.clientSecret,
    publishableKey: res.data.publishableKey,
    recipientToken: res.data.recipientToken,
    amountCents: res.data.amountCents,
    checkoutMode: res.data.checkoutMode,
    paymentStatus: res.data.paymentStatus || "pending",
    status: res.data.status || "CHECKOUT_PENDING",
  };
}

export async function fetchBuyerOrder(orderId: string) {
  const token = readBuyerAccessToken();
  if (!token) return { ok: false as const, code: "no_buyer_token" };
  return storyAction<{ order: Record<string, unknown> }>("getBuyerOrder", {
    order_id: orderId,
    buyer_access_token: token,
  });
}

export async function syncCheckoutStatus(orderId: string, opts?: { markCancelled?: boolean }) {
  const token = readBuyerAccessToken();
  if (!token) return { ok: false as const, code: "no_buyer_token" };
  return storyAction<{
    order: Record<string, unknown>;
    stripeStatus: string | null;
    stripePaymentStatus?: string;
    paidLocally: boolean;
    awaitsWebhook?: boolean;
  }>("syncCheckoutStatus", {
    order_id: orderId,
    buyer_access_token: token,
    mark_cancelled: opts?.markCancelled === true ? "true" : undefined,
  });
}

export async function requestBuyerRecovery(email: string) {
  return storyAction<{
    sent: true;
    recoveryToken: string | null;
    expiresAt?: string;
  }>("requestBuyerRecovery", { buyer_email: email });
}

export async function redeemBuyerRecovery(recoveryToken: string) {
  const res = await storyAction<{
    buyerAccessToken: string;
    order: Record<string, unknown>;
  }>("redeemBuyerRecovery", { recovery_token: recoveryToken });
  if (res.ok && res.data.buyerAccessToken) {
    writeBuyerAccessToken(res.data.buyerAccessToken);
  }
  return res;
}

export async function buyerPreviewOrder(orderId: string) {
  const token = readBuyerAccessToken();
  if (!token) return { ok: false as const, code: "no_buyer_token" };
  return storyAction<{
    preview: true;
    marksOpened: false;
    order: Record<string, unknown>;
  }>("buyerPreview", {
    order_id: orderId,
    buyer_access_token: token,
  });
}

export async function approveBuyerOrder(orderId: string) {
  const token = readBuyerAccessToken();
  if (!token) return { ok: false as const, code: "no_buyer_token" };
  return storyAction<{ order: Record<string, unknown> }>("approveOrder", {
    order_id: orderId,
    buyer_access_token: token,
  });
}

export async function markBuyerOrderSent(orderId: string) {
  const token = readBuyerAccessToken();
  if (!token) return { ok: false as const, code: "no_buyer_token" };
  return storyAction<{ order: Record<string, unknown> }>("markSent", {
    order_id: orderId,
    buyer_access_token: token,
  });
}

export async function scheduleBuyerOrder(
  orderId: string,
  scheduleAt: string | null,
  scheduleTz: string,
) {
  const token = readBuyerAccessToken();
  if (!token) return { ok: false as const, code: "no_buyer_token" };
  return storyAction<{ order: Record<string, unknown> }>("scheduleDelivery", {
    order_id: orderId,
    buyer_access_token: token,
    schedule_at: scheduleAt,
    schedule_tz: scheduleTz,
  });
}

export async function fetchRecipientGift(recipientToken: string, opts?: { markOpened?: boolean; pin?: string }) {
  return storyAction<{
    gift: {
      orderId: string;
      status: string;
      content: StoryGiftContent | null;
      recipientName: string | null;
      fromName: string | null;
    };
  }>("getRecipientGift", {
    recipient_token: recipientToken,
    mark_opened: opts?.markOpened === true,
    pin: opts?.pin || null,
  });
}

export async function storyHealth() {
  return storyAction<{
    checkoutEnabled: boolean;
    stripeMode: string;
    priceCents: number;
  }>("health");
}

export async function listOrderMediaJobs(orderId: string) {
  const token = readBuyerAccessToken();
  if (!token) return { ok: false as const, code: "no_buyer_token" };
  return storyAction<{ jobs: Array<Record<string, unknown>> }>("listOrderMediaJobs", {
    order_id: orderId,
    buyer_access_token: token,
  });
}

export async function requestMediaRevision(
  orderId: string,
  mediaKind: "song" | "film",
  reason: string,
) {
  const token = readBuyerAccessToken();
  if (!token) return { ok: false as const, code: "no_buyer_token" };
  return storyAction<{ revision: Record<string, unknown> }>("requestMediaRevision", {
    order_id: orderId,
    buyer_access_token: token,
    media_kind: mediaKind,
    reason,
  });
}
