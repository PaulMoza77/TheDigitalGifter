import { accessFromGrants } from "./entitlements";
import { featuresForPackage } from "./entitlements";
import type { PlannerFeatureKey } from "./types";

export type SimulatedGrant = {
  orderId: string;
  featureKey: PlannerFeatureKey;
  seasonYear: number;
  status: "active" | "revoked" | "expired";
  userId: string | null;
  email: string | null;
  expiresAt?: string | null;
};

export function applyOrderGrant(existing: SimulatedGrant[], next: SimulatedGrant): SimulatedGrant[] {
  const dup = existing.find(
    (g) => g.orderId === next.orderId && g.featureKey === next.featureKey && g.seasonYear === next.seasonYear,
  );
  if (dup) return existing;
  return [...existing, next];
}

export function grantsForPaidOrder(input: {
  orderId: string;
  productKey: string;
  packageKey: string;
  seasonYear: number;
  userId: string | null;
  email: string | null;
  paymentStatus: string;
  refunded?: boolean;
}): SimulatedGrant[] {
  if (input.paymentStatus !== "paid" || input.refunded) return [];
  return featuresForPackage(input.productKey, input.packageKey).map((featureKey) => ({
    orderId: input.orderId,
    featureKey,
    seasonYear: input.seasonYear,
    status: "active" as const,
    userId: input.userId,
    email: input.email,
  }));
}

export function revokeOrder(grants: SimulatedGrant[], orderId: string): SimulatedGrant[] {
  return grants.map((g) => (g.orderId === orderId && g.status === "active" ? { ...g, status: "revoked" as const } : g));
}

export function claimGrants(input: {
  grants: SimulatedGrant[];
  actorUserId: string;
  actorEmail: string;
  verified: boolean;
  orders: Array<{ orderId: string; userId: string | null; email: string }>;
}): { grants: SimulatedGrant[]; claimedOrderIds: string[] } {
  if (!input.verified) return { grants: input.grants, claimedOrderIds: [] };
  const allowed = new Set(
    input.orders
      .filter((o) => o.email === input.actorEmail && (o.userId == null || o.userId === input.actorUserId))
      .map((o) => o.orderId),
  );
  return {
    claimedOrderIds: [...allowed],
    grants: input.grants.map((g) =>
      allowed.has(g.orderId) && !g.userId && g.email === input.actorEmail
        ? { ...g, userId: input.actorUserId }
        : g,
    ),
  };
}

export function accessForSeason(grants: SimulatedGrant[], userId: string, seasonYear: number, now = new Date()) {
  const keys = grants
    .filter((g) => {
      if (g.status !== "active") return false;
      if (g.seasonYear !== seasonYear) return false;
      if (g.userId !== userId) return false;
      if (g.expiresAt && new Date(g.expiresAt).getTime() <= now.getTime()) return false;
      return true;
    })
    .map((g) => g.featureKey);
  return accessFromGrants({ grantKeys: keys, seasonYear });
}
