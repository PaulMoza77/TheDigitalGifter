/** Explicit V3 traffic classes for production-trustworthy analytics. */
export const V3_TRAFFIC_CLASSES = [
  "internal_test",
  "paid_meta",
  "external_other",
  "unattributed",
] as const;

export type V3TrafficClass = (typeof V3_TRAFFIC_CLASSES)[number];

export type V3TrafficClassificationInput = {
  isInternalTest?: boolean;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  campaignId?: string | null;
  adsetId?: string | null;
  adId?: string | null;
  creativeId?: string | null;
  /** Landing carried fbclid (first-party flag only; fbclid itself is not stored). */
  hasMetaClick?: boolean;
  fbc?: string | null;
  /** Meta browser/pixel cookie — diagnostic only; never proves paid acquisition alone. */
  fbp?: string | null;
  referrerHost?: string | null;
};

const META_SOURCES = new Set([
  "facebook",
  "fb",
  "instagram",
  "ig",
  "an",
  "msg",
  "meta",
  "paid_social",
]);

const PAID_MEDIUMS = new Set(["cpc", "paid", "paid_social", "paidsocial", "ppc"]);

const META_REFERRER_HOSTS = new Set([
  "facebook.com",
  "www.facebook.com",
  "m.facebook.com",
  "l.facebook.com",
  "lm.facebook.com",
  "instagram.com",
  "www.instagram.com",
  "l.instagram.com",
]);

function hasText(value: string | null | undefined): boolean {
  return Boolean(String(value || "").trim());
}

/** Valid `_fbc` cookie prefix (Meta click cookie). */
export function isValidMetaFbc(fbc: string | null | undefined): boolean {
  const raw = String(fbc || "").trim();
  return raw.startsWith("fb.") && raw.includes(".");
}

/**
 * Paid Meta requires at least one reliable paid-click / campaign signal.
 * `fbp` alone is never sufficient.
 */
export function hasReliablePaidMetaSignal(input: V3TrafficClassificationInput): boolean {
  if (input.hasMetaClick) return true;
  if (isValidMetaFbc(input.fbc)) return true;
  if (hasText(input.campaignId) || hasText(input.adId) || hasText(input.adsetId) || hasText(input.creativeId)) {
    return true;
  }
  const source = String(input.utmSource || "").trim().toLowerCase();
  const medium = String(input.utmMedium || "").trim().toLowerCase();
  if (META_SOURCES.has(source) && (PAID_MEDIUMS.has(medium) || hasText(input.utmCampaign))) {
    return true;
  }
  if (PAID_MEDIUMS.has(medium) && hasText(input.utmCampaign)) {
    return true;
  }
  return false;
}

export function classifyV3Traffic(input: V3TrafficClassificationInput): V3TrafficClass {
  if (input.isInternalTest) return "internal_test";
  if (hasReliablePaidMetaSignal(input)) return "paid_meta";

  const source = String(input.utmSource || "").trim().toLowerCase();
  const referrer = String(input.referrerHost || "").trim().toLowerCase();
  const referrerIsMeta = META_REFERRER_HOSTS.has(referrer) || referrer.endsWith(".facebook.com");

  if (source || referrer) return "external_other";
  if (referrerIsMeta) return "external_other";
  if (META_SOURCES.has(source)) return "external_other";

  return "unattributed";
}

export function v3TrafficClassLabel(value: V3TrafficClass): string {
  switch (value) {
    case "internal_test":
      return "Internal test";
    case "paid_meta":
      return "Paid Meta";
    case "external_other":
      return "External / organic";
    case "unattributed":
      return "Unattributed";
  }
}
