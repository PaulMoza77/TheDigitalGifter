/** Canonical post-payment return URL for pet Checkout Sessions (V1 custom + V2 hosted + V3 custom). */

export const PET_ORDER_RETURN_SESSION_PLACEHOLDER = "{CHECKOUT_SESSION_ID}";

export function buildPetOrderReturnUrl(
  publicToken: string,
  origin: string = typeof window !== "undefined" ? window.location.origin : "https://www.thedigitalgifter.com",
): string {
  const token = String(publicToken || "").trim();
  if (!token) {
    throw new Error("buildPetOrderReturnUrl requires a public order token");
  }
  const base = String(origin || "").replace(/\/$/, "") || "https://www.thedigitalgifter.com";
  return `${base}/pet/order?token=${encodeURIComponent(token)}&session_id=${PET_ORDER_RETURN_SESSION_PLACEHOLDER}`;
}

/** True when a confirm()/client return URL is bare `/pet/order` with no order token. */
export function isTokenlessPetOrderReturnUrl(url: string | null | undefined): boolean {
  const raw = String(url || "").trim();
  if (!raw) return true;
  try {
    const parsed = new URL(raw, "https://www.thedigitalgifter.com");
    if (!parsed.pathname.replace(/\/$/, "").endsWith("/pet/order")) return false;
    return !String(parsed.searchParams.get("token") || "").trim();
  } catch {
    return /\/pet\/order\/?(?:\?|$)/i.test(raw) && !/[?&]token=/i.test(raw);
  }
}

export function assertTokenizedPetOrderReturnUrl(url: string): string {
  if (isTokenlessPetOrderReturnUrl(url)) {
    throw new Error("Pet checkout return URL must include the order token");
  }
  if (!url.includes(PET_ORDER_RETURN_SESSION_PLACEHOLDER) && !/[?&]session_id=/.test(url)) {
    throw new Error("Pet checkout return URL must include session_id={CHECKOUT_SESSION_ID}");
  }
  return url;
}
