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
  campaignId?: string | null;
  adId?: string | null;
  hasMetaClick?: boolean;
  fbc?: string | null;
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

const META_MEDIUMS = new Set(["cpc", "paid", "paid_social", "paidsocial"]);

export function classifyV3Traffic(input: V3TrafficClassificationInput): V3TrafficClass {
  if (input.isInternalTest) return "internal_test";
  const source = String(input.utmSource || "").trim().toLowerCase();
  const medium = String(input.utmMedium || "").trim().toLowerCase();
  if (
    Boolean(input.campaignId?.trim()) ||
    Boolean(input.adId?.trim()) ||
    input.hasMetaClick ||
    Boolean(input.fbc?.trim()) ||
    Boolean(input.fbp?.trim()) ||
    META_SOURCES.has(source) ||
    META_MEDIUMS.has(medium)
  ) {
    return "paid_meta";
  }
  if (source || String(input.referrerHost || "").trim()) {
    return "external_other";
  }
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
