const FORBIDDEN_METADATA_KEYS = [
  "email",
  "em",
  "name",
  "names",
  "child_first_name",
  "wishlist",
  "wishlists",
  "recipe",
  "recipes",
  "photo",
  "photo_url",
  "source_path",
  "token",
  "public_token",
  "publicToken",
  "guest_token",
  "authorization",
];

const FORBIDDEN_SUBSTRINGS = [
  "wishlist",
  "recipe",
  "photo_url",
  "public_token",
  "guest_token",
];

export function sanitizePlannerAnalyticsMetadata(
  raw: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    const lower = key.toLowerCase();
    if (FORBIDDEN_METADATA_KEYS.includes(lower)) continue;
    if (FORBIDDEN_SUBSTRINGS.some((part) => lower.includes(part))) continue;
    if (typeof value === "string") {
      if (value.includes("@") || /https?:\/\//i.test(value)) continue;
      out[key] = value.slice(0, 80);
      continue;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      out[key] = value;
      continue;
    }
    if (Array.isArray(value) && value.every((item) => typeof item === "string" && item.length < 40)) {
      out[key] = value.slice(0, 12);
    }
  }
  return out;
}

export function plannerPurchaseEventId(orderId: string): string {
  return `xmas_planner_purchase_${orderId}`;
}
