import {
  SUPPORT_CATEGORIES,
  SUPPORT_EMAIL_MAX,
  SUPPORT_MESSAGE_MAX,
  SUPPORT_MESSAGE_MIN,
  SUPPORT_SUBJECT_MAX,
  SUPPORT_SUBJECT_MIN,
  type SupportCategory,
  type SupportFormErrors,
  type SupportFormValues,
} from "./types";

const EMAIL_RE = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
const SAFE_CATEGORY_IDS = new Set<string>(SUPPORT_CATEGORIES.map((item) => item.id));
const UNSAFE_QUERY_KEYS = ["token", "publicToken", "email", "orderId", "order_id", "pet_order_id"];

export function isSupportCategory(value: string | null | undefined): value is SupportCategory {
  return Boolean(value && SAFE_CATEGORY_IDS.has(value));
}

export function parseSupportCategory(value: string | null | undefined): SupportCategory | "" {
  return isSupportCategory(value) ? value : "";
}

export function inferSupportCategoryFromPath(pathname: string): SupportCategory | "" {
  if (pathname.startsWith("/pet")) return "pet_order";
  if (pathname.startsWith("/account")) return "account";
  if (pathname.startsWith("/generator")) return "generation";
  return "";
}

export function sanitizeSupportPagePath(value: string | null | undefined): string {
  const raw = String(value || "").trim();
  if (!raw) return "/support";

  let path = raw.split("?")[0]?.split("#")[0] || "";
  if (/^https?:\/\//i.test(path)) {
    try {
      path = new URL(path).pathname;
    } catch {
      return "/support";
    }
  }

  if (!path.startsWith("/")) return "/support";
  if (/token=|publicToken|@/i.test(path)) return "/support";
  return path.slice(0, 180);
}

export function supportFormPath(input?: {
  category?: string | null;
  pathname?: string;
}): string {
  const category =
    parseSupportCategory(input?.category) ||
    inferSupportCategoryFromPath(input?.pathname || "");
  if (!category) return "/support";
  return `/support?category=${encodeURIComponent(category)}`;
}

export function supportUrlContainsSecrets(href: string): boolean {
  try {
    const url = new URL(href, "https://www.thedigitalgifter.com");
    return UNSAFE_QUERY_KEYS.some((key) => url.searchParams.has(key));
  } catch {
    return /[?&](token|publicToken|email|orderId)=/i.test(href);
  }
}

export function validateSupportEmail(value: string): string | null {
  const email = value.trim();
  if (!email) return "Enter your email so we can reply.";
  if (email.length > SUPPORT_EMAIL_MAX || !EMAIL_RE.test(email)) {
    return "Enter a valid email address.";
  }
  return null;
}

export function validateSupportForm(values: SupportFormValues): SupportFormErrors {
  const errors: SupportFormErrors = {};
  const emailError = validateSupportEmail(values.email);
  if (emailError) errors.email = emailError;
  if (!isSupportCategory(values.category)) errors.category = "Choose a category.";

  const subject = values.subject.trim();
  if (subject.length < SUPPORT_SUBJECT_MIN) errors.subject = "Add a short subject.";
  else if (subject.length > SUPPORT_SUBJECT_MAX) {
    errors.subject = `Keep the subject under ${SUPPORT_SUBJECT_MAX} characters.`;
  }

  const message = values.message.trim();
  if (message.length < SUPPORT_MESSAGE_MIN) {
    errors.message = "Tell us a bit more so we can help.";
  } else if (message.length > SUPPORT_MESSAGE_MAX) {
    errors.message = `Keep the message under ${SUPPORT_MESSAGE_MAX} characters.`;
  }

  return errors;
}

export function isHoneypotFilled(value: string): boolean {
  return value.trim().length > 0;
}

export function publicSupportErrorMessage(error: unknown): string {
  const raw =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message || "")
      : error instanceof Error
        ? error.message
        : "";
  const lowered = raw.toLowerCase();
  if (lowered.includes("too many tickets")) {
    return "Please wait a few minutes before sending another ticket.";
  }
  if (lowered.includes("valid email")) return "Enter a valid email address.";
  if (lowered.includes("category")) return "Choose a category.";
  if (lowered.includes("subject")) return "Add a short subject.";
  if (lowered.includes("message")) return "Tell us a bit more so we can help.";
  return "We could not send your ticket. Please try again.";
}
