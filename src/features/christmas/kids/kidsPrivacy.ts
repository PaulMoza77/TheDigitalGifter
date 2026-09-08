/**
 * Kids Christmas privacy contract — consent, private-by-default ACL, retention.
 * Source of truth for client tests; mirrored in supabase/functions/_shared/christmas/kidsPrivacy.ts.
 *
 * Not legal advice. Policy decided for V1 launch of /christmas/kids.
 */

export const KIDS_PRODUCT_KEY = "christmas_kids" as const;
export const KIDS_PACKAGE_KEY = "single" as const;
export const KIDS_ROUTE = "/christmas/kids" as const;

export const KIDS_CONSENT_VERSION = "kids_v1_2026_09";
export const KIDS_CONSENT_LABEL =
  "I am the parent/guardian, or I have permission, to upload this child’s photo and create a private Christmas portrait.";

/** Decided V1 retention windows for child-face media (shorter than Santa video 365d). */
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

/** Analytics-safe dimensions only — never child names or free-text. */
export function kidsAnalyticsDimensions(input: {
  styleKey?: string | null;
  packageKey?: string | null;
  hasConsent?: boolean;
}) {
  return {
    product_key: KIDS_PRODUCT_KEY,
    package_key: input.packageKey || KIDS_PACKAGE_KEY,
    style_key: input.styleKey || null,
    consent_version: KIDS_CONSENT_VERSION,
    visibility: KIDS_VISIBILITY,
    public_gallery: false,
    has_consent: Boolean(input.hasConsent),
  };
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

export function kidsOrderMustStayPrivate(productKey: string, visibility: string | null): boolean {
  if (!isKidsProductKey(productKey)) return true;
  return String(visibility || KIDS_VISIBILITY) === KIDS_VISIBILITY;
}
