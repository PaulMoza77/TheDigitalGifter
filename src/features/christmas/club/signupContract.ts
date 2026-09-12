import { CHRISTMAS_CLUB_CONFIG, CHRISTMAS_CLUB_MAX_BODY_BYTES } from "./config";
import { isValidClubEmail, normalizeClubEmail } from "./email";

export const CHRISTMAS_CLUB_SIGNUP_METHODS = ["email", "google"] as const;
export type ChristmasClubSignupMethod = (typeof CHRISTMAS_CLUB_SIGNUP_METHODS)[number];

export type ChristmasClubSignupPayload = {
  email?: string | null;
  signup_method?: string | null;
  source?: string | null;
  campaign_key?: string | null;
  campaign_year?: number | null;
  locale?: string | null;
  landing_path?: string | null;
  funnel_session_id?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
  affiliate_ref?: string | null;
};

export type ValidatedChristmasClubSignup = {
  email: string | null;
  signupMethod: ChristmasClubSignupMethod;
  source: string;
  campaignKey: string;
  campaignYear: number;
  locale: string;
  landingPath: string | null;
  funnelSessionId: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  affiliateRef: string | null;
};

export type ChristmasClubSignupRejectReason =
  | "malformed_json"
  | "invalid_email"
  | "email_required"
  | "invalid_method"
  | "invalid_year"
  | "payload_too_large"
  | "oversized_field";

export class ChristmasClubSignupError extends Error {
  constructor(
    public readonly reason: ChristmasClubSignupRejectReason,
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ChristmasClubSignupError";
  }
}

function clipText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/[<>]/.test(trimmed) || /[\u0000-\u001F]/.test(trimmed)) return null;
  return trimmed.slice(0, max);
}

export function validateChristmasClubSignupPayload(
  raw: unknown,
  opts?: { authenticatedEmail?: string | null },
): ValidatedChristmasClubSignup {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ChristmasClubSignupError("malformed_json", 400, "Invalid payload");
  }
  const body = raw as ChristmasClubSignupPayload;

  const methodRaw = String(body.signup_method || "email").trim().toLowerCase();
  if (methodRaw !== "email" && methodRaw !== "google") {
    throw new ChristmasClubSignupError("invalid_method", 400, "Invalid signup method");
  }
  const signupMethod = methodRaw as ChristmasClubSignupMethod;

  const authenticatedEmail = opts?.authenticatedEmail
    ? normalizeClubEmail(opts.authenticatedEmail)
    : "";
  const clientEmail = normalizeClubEmail(body.email);
  const email = authenticatedEmail || clientEmail;

  if (!email) {
    throw new ChristmasClubSignupError("email_required", 400, "Email is required");
  }
  if (!isValidClubEmail(email)) {
    throw new ChristmasClubSignupError("invalid_email", 400, "Please enter a valid email.");
  }

  let campaignYear: number = CHRISTMAS_CLUB_CONFIG.campaignYear;
  if (body.campaign_year != null && body.campaign_year !== ("" as unknown)) {
    const year = Number(body.campaign_year);
    if (!Number.isInteger(year) || year < 2024 || year > 2100) {
      throw new ChristmasClubSignupError("invalid_year", 400, "Invalid campaign year");
    }
    campaignYear = year;
  }

  return {
    email,
    signupMethod,
    source: clipText(body.source, 80) || CHRISTMAS_CLUB_CONFIG.source,
    campaignKey: clipText(body.campaign_key, 80) || CHRISTMAS_CLUB_CONFIG.campaignKey,
    campaignYear,
    locale: clipText(body.locale, 16) || "en",
    landingPath: clipText(body.landing_path, 160),
    funnelSessionId: clipText(body.funnel_session_id, 80),
    utmSource: clipText(body.utm_source, 120),
    utmMedium: clipText(body.utm_medium, 120),
    utmCampaign: clipText(body.utm_campaign, 120),
    utmContent: clipText(body.utm_content, 120),
    utmTerm: clipText(body.utm_term, 120),
    affiliateRef: clipText(body.affiliate_ref, 120),
  };
}

function utf8ByteLength(value: string): number {
  if (typeof Buffer !== "undefined") return Buffer.byteLength(value, "utf8");
  return new TextEncoder().encode(value).length;
}

export function assertClubSignupBodySize(encoded: string): void {
  if (utf8ByteLength(encoded) > CHRISTMAS_CLUB_MAX_BODY_BYTES) {
    throw new ChristmasClubSignupError("payload_too_large", 413, "Payload too large");
  }
}

export function isUniqueViolationStatus(status: number, bodyText: string): boolean {
  if (status === 409) return true;
  const lower = bodyText.toLowerCase();
  return (
    status === 23505 ||
    lower.includes("duplicate key") ||
    lower.includes("unique constraint") ||
    lower.includes("christmas_club_signups_email_year")
  );
}

export function isMissingRelationStatus(status: number, bodyText: string): boolean {
  const lower = bodyText.toLowerCase();
  return (
    status === 404 ||
    lower.includes("pgrst205") ||
    lower.includes("does not exist") ||
    lower.includes("schema cache")
  );
}

export type ChristmasClubSignupRow = {
  email: string;
  user_id: string | null;
  signup_method: ChristmasClubSignupMethod;
  source: string;
  campaign_key: string;
  campaign_year: number;
  locale: string;
  landing_path: string | null;
  funnel_session_id: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  affiliate_ref: string | null;
  status: "joined";
};

export function clubSignupRowFromValidated(
  validated: ValidatedChristmasClubSignup,
  userId: string | null,
): ChristmasClubSignupRow {
  return {
    email: validated.email!,
    user_id: userId,
    signup_method: validated.signupMethod,
    source: validated.source,
    campaign_key: validated.campaignKey,
    campaign_year: validated.campaignYear,
    locale: validated.locale,
    landing_path: validated.landingPath,
    funnel_session_id: validated.funnelSessionId,
    utm_source: validated.utmSource,
    utm_medium: validated.utmMedium,
    utm_campaign: validated.utmCampaign,
    utm_content: validated.utmContent,
    utm_term: validated.utmTerm,
    affiliate_ref: validated.affiliateRef,
    status: "joined",
  };
}
