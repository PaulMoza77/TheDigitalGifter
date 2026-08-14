export function requireAccessTokenSecret(secret: string | undefined | null): string {
  const value = String(secret || "").trim();
  if (!value) throw new Error("ACCESS_TOKEN_SECRET is required");
  return value;
}

export function configuredAppOrigin(siteUrl: string | undefined | null): string {
  const raw = String(siteUrl || "").trim();
  if (!raw) throw new Error("SITE_URL is not configured");
  return new URL(raw).origin;
}

export function parseAllowedOrigins(
  siteUrl: string | undefined | null,
  extraCsv: string | undefined | null,
): Set<string> {
  const allowed = new Set<string>();
  allowed.add(configuredAppOrigin(siteUrl));
  for (const part of String(extraCsv || "").split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    try {
      allowed.add(new URL(trimmed).origin);
    } catch {
      allowed.add(trimmed.replace(/\/+$/g, ""));
    }
  }
  return allowed;
}

export function isAllowlistedOrigin(
  origin: string,
  siteUrl: string | undefined | null,
  extraCsv: string | undefined | null,
): boolean {
  try {
    return parseAllowedOrigins(siteUrl, extraCsv).has(new URL(origin).origin);
  } catch {
    return false;
  }
}

export function checkoutReturnUrls(
  origin: string,
  args: { orderId: string; generationId: string; redeemCode: string },
) {
  const success = new URL("/funnel/result", origin);
  success.searchParams.set("order_id", args.orderId);
  success.searchParams.set("generation_id", args.generationId);
  success.searchParams.set("rc", args.redeemCode);
  const cancel = new URL("/funnel/payment", origin);
  cancel.searchParams.set("canceled", "1");
  return { successUrl: success.toString(), cancelUrl: cancel.toString() };
}

export function resultEmailHref(origin: string, orderId: string, accessToken: string): string {
  return `${origin}/funnel/result?order_id=${encodeURIComponent(orderId)}#t=${encodeURIComponent(accessToken)}`;
}

export function randomRedeemCode(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
