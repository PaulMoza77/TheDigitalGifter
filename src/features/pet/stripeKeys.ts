export type StripeKeyMode = "live" | "test";

export function stripePublishableKeyMode(publishableKey: string): StripeKeyMode | null {
  if (publishableKey.startsWith("pk_live_")) return "live";
  if (publishableKey.startsWith("pk_test_")) return "test";
  return null;
}

export function stripeSecretKeyMode(stripeKey: string): StripeKeyMode | null {
  if (stripeKey.startsWith("sk_live_")) return "live";
  if (stripeKey.startsWith("sk_test_")) return "test";
  return null;
}

export function publishableKeyMatchesSecretMode(publishableKey: string, stripeKey: string): boolean {
  const pkMode = stripePublishableKeyMode(publishableKey);
  const skMode = stripeSecretKeyMode(stripeKey);
  if (!pkMode || !skMode) return false;
  return pkMode === skMode;
}

export function stripeKeysShareAccount(publishableKey: string, stripeKey: string): boolean {
  if (!publishableKeyMatchesSecretMode(publishableKey, stripeKey)) return false;
  const pkFp = stripeKeyAccountFingerprint(publishableKey);
  const skFp = stripeKeyAccountFingerprint(stripeKey);
  if (!pkFp || !skFp) return false;
  return pkFp === skFp;
}

/** Shared account prefix embedded in standard Stripe pk/sk keys (safe to log). */
export function stripeKeyAccountFingerprint(key: string): string | null {
  const trimmed = String(key || "").trim();
  const match = trimmed.match(/^(?:pk|sk)_(live|test)_([A-Za-z0-9]{8,})/);
  if (!match) return null;
  return `${match[1]}:${match[2].slice(0, 16)}`;
}

export function publishableKeyFingerprint(publishableKey: string): string | null {
  return stripeKeyAccountFingerprint(publishableKey);
}
