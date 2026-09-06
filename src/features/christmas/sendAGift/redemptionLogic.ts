/**
 * Pure helpers for Send-a-Gift activation / redemption invariants (unit-testable).
 */

export type EntitlementState = {
  serviceKey: string;
  quantityTotal: number;
  quantityUsed: number;
};

export type GiftState = {
  status: "pending_activation" | "active" | "disabled" | "exhausted";
  entitlements: EntitlementState[];
  redemptions: Set<string>;
};

export function activateGiftOnce(
  existing: GiftState | null,
  entitlements: EntitlementState[],
): { gift: GiftState; created: boolean } {
  if (existing) {
    return { gift: existing, created: false };
  }
  return {
    created: true,
    gift: {
      status: "active",
      entitlements: entitlements.map((e) => ({ ...e, quantityUsed: 0 })),
      redemptions: new Set(),
    },
  };
}

export function redeemOnce(
  gift: GiftState,
  serviceKey: string,
  redemptionKey: string,
): { ok: true; gift: GiftState; status: "redeemed" | "already_redeemed" } | { ok: false; reason: string } {
  if (gift.redemptions.has(redemptionKey)) {
    return { ok: true, status: "already_redeemed", gift };
  }
  if (gift.status === "disabled") return { ok: false, reason: "gift_disabled" };
  if (gift.status !== "active" && gift.status !== "exhausted") {
    return { ok: false, reason: "gift_not_active" };
  }

  const ent = gift.entitlements.find((e) => e.serviceKey === serviceKey);
  if (!ent) return { ok: false, reason: "entitlement_not_in_gift" };
  if (ent.quantityUsed >= ent.quantityTotal) {
    return { ok: false, reason: "entitlement_exhausted" };
  }

  const nextEntitlements = gift.entitlements.map((e) =>
    e.serviceKey === serviceKey ? { ...e, quantityUsed: e.quantityUsed + 1 } : e,
  );
  const nextRedemptions = new Set(gift.redemptions);
  nextRedemptions.add(redemptionKey);
  const remaining = nextEntitlements.reduce((sum, e) => sum + (e.quantityTotal - e.quantityUsed), 0);

  return {
    ok: true,
    status: "redeemed",
    gift: {
      status: remaining <= 0 ? "exhausted" : "active",
      entitlements: nextEntitlements,
      redemptions: nextRedemptions,
    },
  };
}

export function crossGiftBlocked(
  giftA: GiftState,
  giftBTokenHash: string,
  giftATokenHash: string,
): boolean {
  return giftATokenHash !== giftBTokenHash;
}
