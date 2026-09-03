/**
 * Santa Video V1 — personalization validation, consent, templates, script guards.
 * Shared by client tests and mirrored conceptually in Edge (Deno copies key logic).
 */

export const SANTA_LANGUAGES = ["en", "ro"] as const;
export type SantaLanguage = (typeof SANTA_LANGUAGES)[number];

export const SANTA_TEMPLATE_KEYS = [
  "classic_santa",
  "santa_workshop",
  "santa_fireplace",
  "north_pole",
  "funny_santa",
  "magical_santa",
] as const;
export type SantaTemplateKey = (typeof SANTA_TEMPLATE_KEYS)[number];

/** V1 ships one reliable working template; others are reserved keys. */
export const SANTA_V1_ENABLED_TEMPLATES: SantaTemplateKey[] = ["classic_santa"];

export const SANTA_CONSENT_VERSION = "santa_v1_2026_09";
export const SANTA_CONSENT_LABEL =
  "I am the parent/guardian or have permission to create this personalized video.";

export type SantaPersonalizationInput = {
  childFirstName: string;
  language: string;
  age?: number | null;
  somethingGood?: string | null;
  hobbyOrInterest?: string | null;
  christmasWish?: string | null;
  customFact?: string | null;
  senderName?: string | null;
  templateKey?: string | null;
  guardianConsent: boolean;
};

export type SantaPersonalization = {
  childFirstName: string;
  language: SantaLanguage;
  age: number | null;
  somethingGood: string | null;
  hobbyOrInterest: string | null;
  christmasWish: string | null;
  customFact: string | null;
  senderName: string | null;
  templateKey: SantaTemplateKey;
  guardianConsent: true;
  consentVersion: typeof SANTA_CONSENT_VERSION;
};

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i,
  /system\s*prompt/i,
  /you\s+are\s+not\s+santa/i,
  /\bDAN\b/,
  /<\/?(script|system|prompt)>/i,
  /\[\[?\s*SYSTEM/i,
];

const UNSAFE_PATTERNS = [
  /\b(kill|murder|suicide|porn|sex|nude|rape|terrorist)\b/i,
  /\b(hate\s+speech|slur)\b/i,
];

function clip(value: unknown, max: number): string | null {
  if (value == null) return null;
  const s = String(value).trim().replace(/\s+/g, " ");
  if (!s) return null;
  return s.slice(0, max);
}

export function isSantaLanguage(value: string): value is SantaLanguage {
  return (SANTA_LANGUAGES as readonly string[]).includes(value);
}

export function isSantaTemplateKey(value: string): value is SantaTemplateKey {
  return (SANTA_TEMPLATE_KEYS as readonly string[]).includes(value);
}

export function assertSafeSantaText(
  value: string | null,
  field: string,
): { ok: true } | { ok: false; code: string; message: string } {
  if (!value) return { ok: true };
  for (const re of INJECTION_PATTERNS) {
    if (re.test(value)) {
      return { ok: false, code: "prompt_injection", message: `${field} contains disallowed instructions.` };
    }
  }
  for (const re of UNSAFE_PATTERNS) {
    if (re.test(value)) {
      return { ok: false, code: "unsafe_content", message: `${field} is not appropriate for a children’s Santa video.` };
    }
  }
  return { ok: true };
}

export function validateSantaPersonalization(
  input: SantaPersonalizationInput,
):
  | { ok: true; value: SantaPersonalization }
  | { ok: false; code: string; message: string } {
  if (!input.guardianConsent) {
    return {
      ok: false,
      code: "consent_required",
      message: "Parent/guardian permission is required.",
    };
  }
  const name = clip(input.childFirstName, 40);
  if (!name || name.length < 1) {
    return { ok: false, code: "name_required", message: "Child’s first name is required." };
  }
  if (!/^[A-Za-zÀ-ÿăâîșțĂÂÎȘȚ' -]+$/u.test(name)) {
    return {
      ok: false,
      code: "name_invalid",
      message: "Use a simple first name (letters only).",
    };
  }
  const language = String(input.language || "").trim().toLowerCase();
  if (!isSantaLanguage(language)) {
    return { ok: false, code: "invalid_language", message: "Choose English or Romanian." };
  }
  const templateRaw = String(input.templateKey || "classic_santa").trim();
  if (!isSantaTemplateKey(templateRaw)) {
    return { ok: false, code: "invalid_template", message: "Unknown Santa style." };
  }
  if (!SANTA_V1_ENABLED_TEMPLATES.includes(templateRaw)) {
    return {
      ok: false,
      code: "template_unavailable",
      message: "That Santa style is not available yet.",
    };
  }

  let age: number | null = null;
  if (input.age != null && input.age !== ("" as unknown)) {
    const n = Number(input.age);
    if (!Number.isFinite(n) || n < 1 || n > 17) {
      return { ok: false, code: "invalid_age", message: "Age must be between 1 and 17 if provided." };
    }
    age = Math.round(n);
  }

  const somethingGood = clip(input.somethingGood, 120);
  const hobbyOrInterest = clip(input.hobbyOrInterest, 80);
  const christmasWish = clip(input.christmasWish, 120);
  const customFact = clip(input.customFact, 120);
  const senderName = clip(input.senderName, 60);

  for (const [field, val] of [
    ["something_good", somethingGood],
    ["hobby", hobbyOrInterest],
    ["wish", christmasWish],
    ["custom_fact", customFact],
    ["sender", senderName],
  ] as const) {
    const check = assertSafeSantaText(val, field);
    if (!check.ok) return check;
  }

  return {
    ok: true,
    value: {
      childFirstName: name,
      language,
      age,
      somethingGood,
      hobbyOrInterest,
      christmasWish,
      customFact,
      senderName,
      templateKey: templateRaw,
      guardianConsent: true,
      consentVersion: SANTA_CONSENT_VERSION,
    },
  };
}

/** Analytics-safe dimensions only — never free-text child details. */
export function santaAnalyticsDimensions(input: {
  language: string;
  templateKey: string;
  packageKey?: string | null;
  hasAge?: boolean;
  hasWish?: boolean;
  hasHobby?: boolean;
}) {
  return {
    language: input.language,
    template_key: input.templateKey,
    package_key: input.packageKey || "basic",
    has_age: Boolean(input.hasAge),
    has_wish: Boolean(input.hasWish),
    has_hobby: Boolean(input.hasHobby),
  };
}

export function estimateScriptDurationSeconds(wordCount: number): number {
  // ~140 wpm speaking pace for warm Santa delivery
  const seconds = Math.round((wordCount / 140) * 60);
  return Math.min(70, Math.max(20, seconds));
}

export const SANTA_PRODUCT_KEY = "christmas_santa_video" as const;
export const SANTA_DEFAULT_PACKAGE = "basic" as const;
export const SANTA_ROUTE = "/christmas/santa-video" as const;

export const SANTA_JOB_STATUSES = [
  "draft",
  "queued",
  "script_ready",
  "audio_queued",
  "audio_ready",
  "video_queued",
  "video_processing",
  "rendering",
  "completed",
  "failed",
] as const;

export type SantaJobStatus = (typeof SANTA_JOB_STATUSES)[number];

export function santaProgressCopy(status: SantaJobStatus): string {
  switch (status) {
    case "queued":
    case "draft":
      return "Payment confirmed";
    case "script_ready":
    case "audio_queued":
      return "Preparing Santa’s message";
    case "audio_ready":
    case "video_queued":
      return "Recording Santa’s voice";
    case "video_processing":
    case "rendering":
      return "Creating your video";
    case "completed":
      return "Finishing the magic";
    case "failed":
      return "Something went wrong — your payment is safe";
    default:
      return "Working on your Santa video";
  }
}
