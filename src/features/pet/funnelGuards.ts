import {
  PET_CURRENCY,
  PET_PHOTO_CONTENT_TYPES,
  PET_PHOTO_MAX_BYTES,
  PET_PRICE_CENTS,
  PET_PRODUCT_SKU,
} from "./types";
import {
  canReleaseDelivery as canReleaseDeliveryWithVideos,
  rejectClientPriceTampering as rejectClientPriceAgainstOffer,
} from "./videoGuards";

export const PAID_STATUSES = [
  "paid",
  "generating",
  "awaiting_qc",
  "selecting_video_scenes",
  "generating_videos",
  "awaiting_video_qc",
  "complete",
  "partial_failure",
] as const;

export function serverOwnedAmount() {
  return { amountCents: PET_PRICE_CENTS, currency: PET_CURRENCY, sku: PET_PRODUCT_SKU };
}

export function rejectClientPriceTampering(input: {
  amountCents?: unknown;
  currency?: unknown;
  sku?: unknown;
}): { ok: true } | { ok: false; code: "INVALID_REQUEST"; message: string } {
  return rejectClientPriceAgainstOffer(input, PET_PRICE_CENTS);
}

export function assertUploadAllowed(
  contentType: string,
  byteSize: number,
): { ok: true } | { ok: false; code: "INVALID_REQUEST"; message: string } {
  if (!PET_PHOTO_CONTENT_TYPES.includes(contentType as (typeof PET_PHOTO_CONTENT_TYPES)[number])) {
    return { ok: false, code: "INVALID_REQUEST", message: "Photo must be JPEG, PNG, or WebP." };
  }
  if (!Number.isFinite(byteSize) || byteSize <= 0 || byteSize > PET_PHOTO_MAX_BYTES) {
    return { ok: false, code: "INVALID_REQUEST", message: "Photo must be 15 MB or smaller." };
  }
  return { ok: true };
}

export function tokenEnumerationRejected(token: string): boolean {
  const value = String(token || "").trim();
  if (!value) return true;
  if (value.length < 32) return true;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function canStartGeneration(input: {
  paidAt: string | null;
  status: string;
}): { ok: true } | { ok: false; code: "PAYMENT_REQUIRED" | "INVALID_REQUEST"; message: string } {
  if (!input.paidAt && !PAID_STATUSES.includes(input.status as (typeof PAID_STATUSES)[number])) {
    return { ok: false, code: "PAYMENT_REQUIRED", message: "Unpaid orders cannot generate." };
  }
  if (input.status === "refunded") {
    return { ok: false, code: "INVALID_REQUEST", message: "Refunded orders cannot generate." };
  }
  return { ok: true };
}

export function stripeFulfillmentDecision(input: {
  eventType: string;
  productType?: string;
  sku?: string;
  mode?: string;
  paymentStatus?: string;
}): { fulfill: boolean; reason: string } {
  const isPet = input.sku === PET_PRODUCT_SKU || input.productType === "pet_secret_life";
  if (!isPet) return { fulfill: false, reason: "not_pet" };
  if (input.eventType === "invoice.paid") return { fulfill: false, reason: "invoice_ignored" };
  if (input.eventType === "checkout.session.async_payment_succeeded") {
    return { fulfill: true, reason: "paid_session" };
  }
  if (input.eventType === "checkout.session.completed") {
    const paid = input.paymentStatus === "paid" || input.paymentStatus === "no_payment_required";
    if (!paid) return { fulfill: false, reason: "unpaid" };
    if (input.mode && input.mode !== "payment") return { fulfill: false, reason: "unpaid" };
    return { fulfill: true, reason: "paid_session" };
  }
  return { fulfill: false, reason: "not_pet" };
}

export function replicateCallbackShouldApply(input: {
  alreadyProcessed: boolean;
  currentSceneStatus: string;
}): { apply: boolean; reason: string } {
  if (input.alreadyProcessed) return { apply: false, reason: "duplicate_callback" };
  if (input.currentSceneStatus === "succeeded" || input.currentSceneStatus === "ready") {
    return { apply: false, reason: "already_succeeded" };
  }
  return { apply: true, reason: "apply" };
}

export function retryTargets<T extends { status: string; sceneKey?: string; scene_key?: string }>(
  scenes: T[],
  selectedKey?: string,
): T[] {
  return scenes.filter((scene) => {
    const key = scene.sceneKey || scene.scene_key;
    if (scene.status !== "failed") return false;
    if (selectedKey && key !== selectedKey) return false;
    return true;
  });
}

export function deliveryAllowed(input: {
  orderStatus: string;
  qcStatus?: string | null;
  completedAt?: string | null;
}): boolean {
  return ![
    "draft",
    "awaiting_upload",
    "awaiting_payment",
    "failed",
    "refunded",
    "canceled",
  ].includes(input.orderStatus);
}

export function normalizeAccountEmail(email: string | null | undefined): string {
  return String(email || "").trim().toLowerCase();
}

export function accountOwnsPetOrder(input: {
  accountEmail: string | null | undefined;
  orderEmailNormalized: string | null | undefined;
}): boolean {
  const account = normalizeAccountEmail(input.accountEmail);
  const order = normalizeAccountEmail(input.orderEmailNormalized);
  return Boolean(account.includes("@") && order.includes("@") && account === order);
}

export function metaPurchaseShouldEmit(input: {
  alreadySentAt: string | null;
  eventId: string;
  requestedEventId?: string;
}): boolean {
  if (input.alreadySentAt) return false;
  if (input.requestedEventId && input.requestedEventId !== input.eventId) return false;
  return true;
}

export function isAdminAuthorized(input: { callerIsAdmin: boolean; mutation: boolean }): boolean {
  if (input.mutation) return input.callerIsAdmin;
  return input.callerIsAdmin;
}

export function customerCannotEnumerateByUuid(token: string, orderId: string): boolean {
  return token !== orderId && tokenEnumerationRejected(orderId);
}

export function stripeCheckoutIdempotencyKey(orderId: string, issuedCount = 0): string {
  if (issuedCount <= 0) return `pet-checkout-${orderId}`;
  return `pet-checkout-${orderId}-${issuedCount}`;
}

export type StripeCheckoutSessionView = {
  id: string;
  status?: string | null;
  url?: string | null;
  client_secret?: string | null;
  expires_at?: number | null;
  payment_status?: string | null;
};

export function sessionIsExpired(session: StripeCheckoutSessionView | null): boolean {
  if (!session) return false;
  if (session.status === "expired") return true;
  if (session.expires_at && session.expires_at * 1000 <= Date.now()) return true;
  return false;
}

export function sessionIsPaymentProcessing(session: StripeCheckoutSessionView | null): boolean {
  if (!session) return false;
  const status = String(session.status || "");
  const payment = String(session.payment_status || "");
  if (status === "complete") return true;
  if (payment === "paid" || payment === "no_payment_required") return true;
  return false;
}

export function shouldReuseCheckoutSession(session: StripeCheckoutSessionView | null): boolean {
  if (!session?.id || !session.url) return false;
  if (sessionIsPaymentProcessing(session)) return false;
  if (sessionIsExpired(session)) return false;
  if (session.status && session.status !== "open") return false;
  return true;
}

export function isOnPageCheckoutUi(uiMode?: string | null): boolean {
  return uiMode === "embedded" || uiMode === "custom";
}

export function decideCheckoutSessionAction(input: {
  existingSession: StripeCheckoutSessionView | null;
  orderId: string;
  issuedCount: number;
  uiMode?: "hosted" | "embedded" | "custom";
}):
  | { action: "reuse"; sessionId: string; checkoutUrl: string }
  | { action: "create"; idempotencyKey: string; expectedSessionId: string | null }
  | { action: "payment_processing"; sessionId: string } {
  const canReuseHosted =
    !isOnPageCheckoutUi(input.uiMode) &&
    input.existingSession &&
    shouldReuseCheckoutSession(input.existingSession);
  if (canReuseHosted && input.existingSession) {
    return {
      action: "reuse",
      sessionId: input.existingSession.id,
      checkoutUrl: String(input.existingSession.url),
    };
  }
  if (input.existingSession && sessionIsPaymentProcessing(input.existingSession)) {
    return { action: "payment_processing", sessionId: input.existingSession.id };
  }
  const replacing = Boolean(input.existingSession);
  return {
    action: "create",
    idempotencyKey: stripeCheckoutIdempotencyKey(
      input.orderId,
      replacing ? Math.max(input.issuedCount, 1) : input.issuedCount,
    ),
    expectedSessionId: input.existingSession?.id ?? null,
  };
}

export function attachCheckoutSessionCas(input: {
  storedSessionId: string | null;
  incomingSessionId: string;
  expectedSessionId: string | null;
}): { storedSessionId: string; attached: boolean } {
  const stored = input.storedSessionId;
  const incoming = input.incomingSessionId;
  const expected = input.expectedSessionId;
  const canWrite =
    stored == null || stored === incoming || (expected != null && stored === expected);
  if (canWrite) {
    return { storedSessionId: incoming, attached: true };
  }
  return { storedSessionId: stored, attached: false };
}

export function matchedOpenCheckoutResponse(session: {
  id?: string | null;
  url?: string | null;
  status?: string | null;
  expires_at?: number | null;
  payment_status?: string | null;
} | null): { ok: true; sessionId: string; checkoutUrl: string } | { ok: false; reason: "conflict" } {
  const sessionId = String(session?.id || "").trim();
  const checkoutUrl = String(session?.url || "").trim();
  if (!sessionId || !checkoutUrl) return { ok: false, reason: "conflict" };
  if (
    !shouldReuseCheckoutSession({
      id: sessionId,
      url: checkoutUrl,
      status: session?.status,
      expires_at: session?.expires_at,
      payment_status: session?.payment_status,
    })
  ) {
    return { ok: false, reason: "conflict" };
  }
  if (checkoutUrl.includes("cs_") && !checkoutUrl.includes(sessionId)) {
    return { ok: false, reason: "conflict" };
  }
  return { ok: true, sessionId, checkoutUrl };
}

export function publishableKeyMatchesClientSecret(
  publishableKey: string | null | undefined,
  clientSecret: string | null | undefined,
): boolean {
  const pk = String(publishableKey || "").trim();
  const secret = String(clientSecret || "").trim();
  if (!pk.startsWith("pk_") || !secret.startsWith("cs_")) return false;
  if (secret.startsWith("cs_live_")) return pk.startsWith("pk_live_");
  if (secret.startsWith("cs_test_")) return pk.startsWith("pk_test_");
  return true;
}

export function isValidEmbeddedClientSecret(
  clientSecret: string | null | undefined,
  sessionId?: string | null,
): boolean {
  const secret = String(clientSecret || "").trim();
  if (!secret) return false;
  if (!/^cs_(live|test)_/.test(secret)) return false;
  if (!secret.includes("_secret_")) return false;
  const sid = String(sessionId || "").trim();
  if (sid && secret === sid) return false;
  return true;
}

export function sanitizeStripeCheckoutCustomerError(message?: string | null): string {
  const raw = String(message || "").trim();
  if (!raw) return "Enter your full card details before paying.";
  if (/cancel(ed)?|aborted|dismiss/i.test(raw)) return "";
  if (/incomplete|empty|invalid.*card|card number|expir|cvc|security code|payment details/i.test(raw)) {
    return "Enter your full card details before paying.";
  }
  if (/declined|insufficient|do not honor|not permitted|lost card|stolen card/i.test(raw)) {
    return "Your card was declined. Try another card or contact your bank.";
  }
  if (/no such checkout\.session|checkout\.session.*expired|session.*expired/i.test(raw)) {
    return "This payment session expired. Tap Retry secure payment.";
  }
  if (/publishable key|api key/i.test(raw)) {
    return "We couldn't load secure payment. Please try again.";
  }
  return "We couldn't complete payment. Please try again.";
}

export function stripeCheckoutInitCustomerError(message?: string | null): string {
  const raw = String(message || "").trim();
  if (/no such checkout\.session|checkout\.session.*expired|session.*expired/i.test(raw)) {
    return "This payment session expired. Tap Retry secure payment.";
  }
  if (/publishable key|api key|basil|initcheckout/i.test(raw)) {
    return "We couldn't load secure payment. Please try again.";
  }
  return "We couldn't load secure payment. Please try again.";
}

export function matchedEmbeddedCheckoutResponse(session: {
  id?: string | null;
  client_secret?: string | null;
  status?: string | null;
  expires_at?: number | null;
  payment_status?: string | null;
} | null): { ok: true; sessionId: string; clientSecret: string } | { ok: false; reason: "conflict" } {
  const sessionId = String(session?.id || "").trim();
  const clientSecret = String(session?.client_secret || "").trim();
  if (!sessionId || !isValidEmbeddedClientSecret(clientSecret, sessionId)) {
    return { ok: false, reason: "conflict" };
  }
  if (
    sessionIsPaymentProcessing({
      id: sessionId,
      status: session?.status,
      expires_at: session?.expires_at,
      payment_status: session?.payment_status,
    })
  ) {
    return { ok: false, reason: "conflict" };
  }
  if (
    sessionIsExpired({
      id: sessionId,
      status: session?.status,
      expires_at: session?.expires_at,
      payment_status: session?.payment_status,
    })
  ) {
    return { ok: false, reason: "conflict" };
  }
  if (session?.status && session.status !== "open") return { ok: false, reason: "conflict" };
  return { ok: true, sessionId, clientSecret };
}

export function fulfillmentAcceptsIssuedSession(input: {
  orderId: string;
  metadataOrderId: string;
  paidSessionId: string;
  issuedSessionIds: string[];
}): boolean {
  if (input.orderId !== input.metadataOrderId) return false;
  if (!input.paidSessionId) return false;
  return input.issuedSessionIds.includes(input.paidSessionId);
}

export function applyPetPaymentEvent(input: {
  alreadyPaid: boolean;
  orderId: string;
  metadataOrderId: string;
  paidSessionId: string;
  issuedSessionIds: string[];
}): { alreadyPaid: boolean; fulfilledThisEvent: boolean } {
  if (!fulfillmentAcceptsIssuedSession(input)) {
    return { alreadyPaid: input.alreadyPaid, fulfilledThisEvent: false };
  }
  if (input.alreadyPaid) {
    return { alreadyPaid: true, fulfilledThisEvent: false };
  }
  return { alreadyPaid: true, fulfilledThisEvent: true };
}

export function canReleaseDelivery(input: {
  paidAt: string | null;
  orderStatus: string;
  scenes: Array<{ status: string; qcStatus?: string | null }>;
  clips?: Array<{ status: string; qcStatus?: string | null }>;
}): { ok: true } | { ok: false; message: string } {
  return canReleaseDeliveryWithVideos(input);
}

export function mapOrderStatusForCustomer(status: string): string {
  if (status === "generating") return "processing";
  if (status === "awaiting_qc" || status === "awaiting_video_qc") return "complete";
  return status;
}

export function kontextProInput(prompt: string, inputImage: string) {
  return {
    prompt,
    input_image: inputImage,
    aspect_ratio: "match_input_image" as const,
    output_format: "jpg" as const,
    prompt_upsampling: false,
    safety_tolerance: 2,
  };
}

export function applyPredictionCreateFailure(input: {
  scenes: Array<{ sceneKey: string; status: string; lastError: string | null }>;
  failedSceneKey: string;
  error: string;
}): Array<{ sceneKey: string; status: string; lastError: string | null }> {
  return input.scenes.map((scene) =>
    scene.sceneKey === input.failedSceneKey
      ? { ...scene, status: "failed", lastError: input.error }
      : scene,
  );
}

export function generationBatchState(
  scenes: Array<{ status: string }>,
): "generating" | "awaiting_qc" | "partial_failure" | "failed" {
  const total = scenes.length;
  const terminal = scenes.filter((scene) => ["succeeded", "failed", "ready"].includes(scene.status));
  if (terminal.length < total) return "generating";
  const succeeded = scenes.filter((scene) => ["succeeded", "ready"].includes(scene.status)).length;
  const failed = scenes.filter((scene) => scene.status === "failed").length;
  if (succeeded === 0) return "failed";
  if (failed > 0) return "partial_failure";
  return "awaiting_qc";
}

export function orderLastErrorAfterImageGeneration(input: {
  batchStatus: ReturnType<typeof generationBatchState> | "held";
  currentLastError: string | null;
}): string | null {
  if (input.batchStatus === "awaiting_qc") return null;
  return input.currentLastError;
}

export function requirePetTokenEncryptionKey(
  getEnv: (name: string) => string | undefined = (name) =>
    typeof process !== "undefined" ? process.env[name] : undefined,
): string {
  const value = String(getEnv("PET_TOKEN_ENCRYPTION_KEY") ?? "").trim();
  if (value.length < 32) {
    throw new Error("PET_TOKEN_ENCRYPTION_KEY is required");
  }
  return value;
}
