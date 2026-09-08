/**
 * Server-owned Send-a-Gift package composition (mirrors catalog + migration).
 * Client may select package_key only — never quantities, prices, or service keys.
 */

export const SEND_A_GIFT_PRODUCT_KEY = "christmas_send_a_gift" as const;
export const SEND_A_GIFT_FUNNEL = "christmas_send_a_gift" as const;

export const SEND_A_GIFT_PACKAGE_KEYS = ["starter", "classic", "premium"] as const;
export type SendAGiftPackageKey = (typeof SEND_A_GIFT_PACKAGE_KEYS)[number];

export type SendAGiftEntitlementDef = {
  serviceKey: string;
  quantity: number;
};

export type SendAGiftPackageComposition = {
  packageKey: SendAGiftPackageKey;
  packageName: string;
  description: string;
  priceCents: number;
  purchasable: boolean;
  entitlements: SendAGiftEntitlementDef[];
  features: string[];
};

export const SEND_A_GIFT_PACKAGES: Record<SendAGiftPackageKey, SendAGiftPackageComposition> = {
  starter: {
    packageKey: "starter",
    packageName: "Starter Gift",
    description: "Small prepaid creative bundle. Live price pending founder activation.",
    priceCents: 0,
    purchasable: false,
    entitlements: [{ serviceKey: "christmas_photo", quantity: 1 }],
    features: ["1 Christmas portrait credit"],
  },
  classic: {
    packageKey: "classic",
    packageName: "Christmas Gift",
    description: "Balanced portrait + Santa video bundle. Live price pending founder activation.",
    priceCents: 0,
    purchasable: false,
    entitlements: [
      { serviceKey: "christmas_photo", quantity: 1 },
      { serviceKey: "christmas_santa_video", quantity: 1 },
    ],
    features: ["1 Christmas portrait credit", "1 Santa video credit"],
  },
  premium: {
    packageKey: "premium",
    packageName: "Premium Gift",
    description: "Richer multi-service prepaid bundle. Live price pending founder activation.",
    priceCents: 0,
    purchasable: false,
    entitlements: [
      { serviceKey: "christmas_photo", quantity: 2 },
      { serviceKey: "christmas_santa_video", quantity: 1 },
      { serviceKey: "christmas_card", quantity: 1 },
    ],
    features: ["2 Christmas portrait credits", "1 Santa video credit", "1 Christmas card credit"],
  },
};

export function isSendAGiftPackageKey(value: unknown): value is SendAGiftPackageKey {
  return typeof value === "string" && (SEND_A_GIFT_PACKAGE_KEYS as readonly string[]).includes(value);
}

export function resolveSendAGiftPackage(packageKey: unknown): SendAGiftPackageComposition | null {
  if (!isSendAGiftPackageKey(packageKey)) return null;
  return SEND_A_GIFT_PACKAGES[packageKey];
}

export function assertServerOwnedCheckoutInput(input: {
  productKey?: unknown;
  packageKey?: unknown;
  clientAmountCents?: unknown;
  clientCurrency?: unknown;
  clientEntitlements?: unknown;
}): { ok: true; package: SendAGiftPackageComposition } | { ok: false; reason: string } {
  if (input.productKey !== SEND_A_GIFT_PRODUCT_KEY) {
    return { ok: false, reason: "wrong_product" };
  }
  const pkg = resolveSendAGiftPackage(input.packageKey);
  if (!pkg) return { ok: false, reason: "invalid_package" };

  if (input.clientAmountCents != null && Number(input.clientAmountCents) !== pkg.priceCents) {
    return { ok: false, reason: "client_price_override_rejected" };
  }
  if (input.clientCurrency != null && String(input.clientCurrency).toLowerCase() !== "usd") {
    return { ok: false, reason: "client_currency_override_rejected" };
  }
  if (input.clientEntitlements != null) {
    return { ok: false, reason: "client_entitlement_override_rejected" };
  }
  if (pkg.purchasable !== true || pkg.priceCents <= 0) {
    return { ok: false, reason: "not_purchasable" };
  }
  return { ok: true, package: pkg };
}

export function giftSharePath(shareToken: string): string {
  return `/gift/${encodeURIComponent(shareToken)}`;
}

export const SEND_A_GIFT_SERVICE_ROUTES: Record<string, string> = {
  christmas_photo: "/christmas/photo-generator",
  christmas_santa_video: "/christmas/santa-video",
  christmas_card: "/christmas/cards",
};
