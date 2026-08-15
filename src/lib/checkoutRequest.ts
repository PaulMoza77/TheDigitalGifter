const CHECKOUT_REQUEST_PREFIX = "tdg.checkoutRequest.";

export function checkoutRequestStorageKey(uploadId: string): string {
  return `${CHECKOUT_REQUEST_PREFIX}${uploadId}`;
}

export function readCheckoutRequestId(uploadId: string): string {
  if (typeof sessionStorage === "undefined" || !uploadId) return "";
  return String(sessionStorage.getItem(checkoutRequestStorageKey(uploadId)) || "").trim();
}

export function storeCheckoutRequestId(uploadId: string, requestId: string): void {
  if (typeof sessionStorage === "undefined" || !uploadId || !requestId) return;
  sessionStorage.setItem(checkoutRequestStorageKey(uploadId), requestId);
}

export function readOrCreateCheckoutRequestId(
  uploadId: string,
  createId: () => string = () => crypto.randomUUID(),
): string {
  const existing = readCheckoutRequestId(uploadId);
  if (existing) return existing;
  const created = String(createId() || "").trim();
  if (created) storeCheckoutRequestId(uploadId, created);
  return created;
}
