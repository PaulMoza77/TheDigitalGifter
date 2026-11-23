/** Browser-safe Stripe policy mirrors for unit tests (Edge enforces the real gates). */

export function resolveStoryStripeMode(input: {
  checkoutEnabled: boolean;
  modeEnv: string;
}): "test" | "disabled" {
  if (!input.checkoutEnabled) return "disabled";
  if (input.modeEnv.toLowerCase() === "test") return "test";
  // LIVE refused in Mission 02B
  return "disabled";
}

export function assertTestSecretKey(key: string): boolean {
  return key.startsWith("sk_test_") && !key.startsWith("sk_live_");
}

export function isStoryTestMetadata(meta: Record<string, unknown>): boolean {
  return (
    String(meta.product_family || "").toLowerCase() === "christmas_story" &&
    String(meta.stripe_mode || "").toLowerCase() === "test"
  );
}
