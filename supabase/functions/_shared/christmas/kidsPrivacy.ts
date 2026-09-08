/**
 * Kids Christmas privacy contract — Deno mirror of src/features/christmas/kids/kidsPrivacy.ts.
 * Keep fields and windows in lockstep. Tests assert both files share the same constants.
 */

export const KIDS_PRODUCT_KEY = "christmas_kids" as const;
export const KIDS_PACKAGE_KEY = "single" as const;
export const KIDS_ROUTE = "/christmas/kids" as const;

export const KIDS_CONSENT_VERSION = "kids_v1_2026_09";
export const KIDS_CONSENT_LABEL =
  "I am the parent/guardian, or I have permission, to upload this child’s photo and create a private Christmas portrait.";

export const KIDS_RETENTION = {
  unpaidSourceDays: 7,
  paidSourceDays: 30,
  paidResultDays: 90,
  consentAuditMonths: 24,
} as const;

export const KIDS_VISIBILITY = "private" as const;

export type KidsRetentionKind = "unpaid_source" | "paid_source" | "paid_result";

export function isKidsProductKey(productKey: string): boolean {
  return String(productKey || "").trim() === KIDS_PRODUCT_KEY;
}

export function validateKidsConsent(input: {
  guardianConsent: boolean;
  consentVersion?: string | null;
}):
  | {
      ok: true;
      consentVersion: typeof KIDS_CONSENT_VERSION;
      visibility: typeof KIDS_VISIBILITY;
      publicGallery: false;
    }
  | { ok: false; code: "consent_required"; message: string } {
  if (!input.guardianConsent) {
    return {
      ok: false,
      code: "consent_required",
      message: "Parent/guardian permission is required before uploading a child’s photo.",
    };
  }
  void input.consentVersion;
  return {
    ok: true,
    consentVersion: KIDS_CONSENT_VERSION,
    visibility: KIDS_VISIBILITY,
    publicGallery: false,
  };
}

export function kidsRetentionDays(kind: KidsRetentionKind): number {
  if (kind === "unpaid_source") return KIDS_RETENTION.unpaidSourceDays;
  if (kind === "paid_source") return KIDS_RETENTION.paidSourceDays;
  return KIDS_RETENTION.paidResultDays;
}

export function kidsRetentionDeleteAfter(
  kind: KidsRetentionKind,
  from: Date = new Date(),
): Date {
  return new Date(from.getTime() + kidsRetentionDays(kind) * 86_400_000);
}

export function kidsMediaAccessPolicy() {
  return {
    visibility: KIDS_VISIBILITY,
    publicGallery: false,
    noindex: true,
    tokenRequired: true,
    shareUrlForbidden: true,
    sitemapExcluded: true,
  } as const;
}
