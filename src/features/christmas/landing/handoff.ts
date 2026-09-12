/** Cross-page handoff from the Christmas landing into product flows. */

export const SANTA_HANDOFF_KEY = "tdg.christmas.santa.handoff.v1";
export const SANTA_ROUTE = "/christmas/santa-video";

export const GIFT_FINDER_RECIPIENTS = [
  "mom",
  "dad",
  "wife",
  "husband",
  "girlfriend",
  "boyfriend",
  "partner",
  "daughter",
  "son",
  "teen",
  "child",
  "grandma",
  "grandpa",
  "friend",
  "coworker",
  "teacher",
  "other",
] as const;
export type GiftFinderRecipient = (typeof GIFT_FINDER_RECIPIENTS)[number];

export const GIFT_FINDER_LANDING_RECIPIENTS = ["mom", "dad", "partner", "friend", "child"] as const;

export const PORTRAIT_VERTICALS = ["family", "couples", "pets"] as const;
export type PortraitVertical = (typeof PORTRAIT_VERTICALS)[number];

export const CARD_THEMES = ["elegant", "family", "romantic", "funny"] as const;
export type CardTheme = (typeof CARD_THEMES)[number];

export const CARD_THEME_TO_STYLE: Record<CardTheme, string> = {
  elegant: "elegant_gold",
  family: "cozy_christmas",
  romantic: "romantic_christmas",
  funny: "playful_christmas",
};

export const MESSAGE_RECIPIENTS = ["mom", "dad", "partner", "friend"] as const;
export const MESSAGE_TONES = ["heartfelt", "funny", "warm"] as const;

export function sanitizeKidName(raw: string): string {
  return String(raw || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 40);
}

/**
 * Unicode-safe first names: letters + marks, spaces, hyphens, apostrophes.
 * Rejects empty, oversized, and control characters.
 */
export function isLikelyKidName(name: string): boolean {
  if (!name || name.length < 1 || name.length > 40) return false;
  if (/[\u0000-\u001F\u007F]/.test(name)) return false;
  return /^[\p{L}\p{M}][\p{L}\p{M}'’\-\s]*$/u.test(name);
}

export function writeSantaNameHandoff(childFirstName: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      SANTA_HANDOFF_KEY,
      JSON.stringify({ childFirstName, ts: Date.now() }),
    );
  } catch {
    /* private mode */
  }
}

export function readSantaNameHandoff(): string {
  if (typeof window === "undefined") return "";
  try {
    const raw = window.sessionStorage.getItem(SANTA_HANDOFF_KEY);
    if (!raw) return "";
    const parsed = JSON.parse(raw) as { childFirstName?: string };
    return sanitizeKidName(parsed.childFirstName || "");
  } catch {
    return "";
  }
}

export function consumeSantaNameHandoff(): string {
  const name = readSantaNameHandoff();
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.removeItem(SANTA_HANDOFF_KEY);
    } catch {
      /* ignore */
    }
  }
  return name;
}

/**
 * Prefer sessionStorage handoff — do not put the child's name in the URL
 * (avoids referrer / analytics leakage). Optional name query remains readable
 * on the Santa page for deep links, but the landing CTA no longer emits it.
 */
export function santaExperienceUrl(_childFirstName?: string): string {
  return SANTA_ROUTE;
}

export function giftFinderUrl(recipient: GiftFinderRecipient): string {
  return `/christmas/gift-finder?recipient=${encodeURIComponent(recipient)}`;
}

export function portraitUrl(vertical: PortraitVertical): string {
  if (vertical === "family") return "/christmas/family";
  if (vertical === "couples") return "/christmas/couples";
  return "/christmas/pets";
}

export function cardsUrl(theme: CardTheme): string {
  return `/christmas/cards?theme=${encodeURIComponent(theme)}`;
}

export function messagesUrl(recipient: string, tone: string): string {
  const params = new URLSearchParams();
  params.set("for", recipient);
  params.set("tone", tone);
  return `/christmas/messages?${params.toString()}`;
}

export function parseGiftRecipient(value: string | null): GiftFinderRecipient | null {
  if (!value) return null;
  const key = value === "kids" ? "child" : value === "grandparent" ? "grandma" : value;
  return (GIFT_FINDER_RECIPIENTS as readonly string[]).includes(key)
    ? (key as GiftFinderRecipient)
    : null;
}

export function parseCardTheme(value: string | null): CardTheme | null {
  if (!value) return null;
  return (CARD_THEMES as readonly string[]).includes(value) ? (value as CardTheme) : null;
}
