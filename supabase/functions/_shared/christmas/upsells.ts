/**
 * Server-owned suite portrait AOV keys (CHRISTMAS-039).
 * Prices are never hardcoded here — they come from christmas_packages.
 */

export const PORTRAIT_AOV_PRODUCT_KEYS = [
  "christmas_photo",
  "christmas_family",
  "christmas_couple",
  "christmas_pet",
] as const;

export const PORTRAIT_AOV_PACKAGE_KEYS = ["extra_images", "extra_styles", "video"] as const;

export const CHRISTMAS_V2_PACK_KEYS = ["starter", "magic", "ultimate"] as const;

export const CHRISTMAS_UPSELL_PRODUCT_TYPE = "christmas_upsell";

export type PortraitAovPackageKey = (typeof PORTRAIT_AOV_PACKAGE_KEYS)[number];

export function isPortraitAovProductKey(value: string): boolean {
  return (PORTRAIT_AOV_PRODUCT_KEYS as readonly string[]).includes(value);
}

export function isPortraitAovPackageKey(value: string): value is PortraitAovPackageKey {
  return (PORTRAIT_AOV_PACKAGE_KEYS as readonly string[]).includes(value);
}

export function isChristmasV2PackKey(value: string): boolean {
  return (CHRISTMAS_V2_PACK_KEYS as readonly string[]).includes(value);
}

export function extraCountFromPackageMetadata(
  metadata: Record<string, unknown> | null | undefined,
  packageKey: PortraitAovPackageKey,
): number {
  const raw = metadata?.extra_count;
  const n = typeof raw === "number" ? Math.round(raw) : Number(raw);
  if (Number.isFinite(n) && n > 0 && n <= 8) return n;
  if (packageKey === "video") return 1;
  return 2;
}

export function isChristmasUpsellMetadata(metadata: Record<string, unknown>): boolean {
  return String(metadata.product_type || "").trim() === CHRISTMAS_UPSELL_PRODUCT_TYPE;
}
