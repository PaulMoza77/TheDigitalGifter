/**
 * Client-side message validation helpers (mirrors server rules for unit tests).
 */

import {
  LENGTHS,
  MESSAGE_LENGTHS,
  RECIPIENTS,
  TONES,
  labelFor,
  type LocaleCode,
} from "./taxonomy";

const RECIPIENT_KEYS = new Set(RECIPIENTS.map((r) => r.key));
const TONE_KEYS = new Set(TONES.map((t) => t.key));
const LENGTH_KEYS = new Set(LENGTHS.map((l) => l.key));

const INJECTION_RE =
  /\b(ignore (all |previous |prior )?instructions|system prompt|reveal (the )?prompt|jailbreak)\b/i;
const UNSAFE_RE =
  /\b(kill|murder|rape|suicide|self[- ]?harm|bomb|weapon|child porn|csam|humiliate)\b/i;

export type MessageInputClient = {
  locale: LocaleCode;
  recipientKey: string;
  toneKey: string;
  lengthKey: string;
  customDetail?: string;
};

export type CuratedMessageClient = {
  result_key: string;
  text: string;
  tone_key: string;
  length_key: string;
  recipient_key: string;
  language: LocaleCode;
};

export function validateMessageInputClient(
  input: MessageInputClient,
): { ok: true } | { ok: false; error: string } {
  if (!RECIPIENT_KEYS.has(input.recipientKey as never)) return { ok: false, error: "invalid_recipient" };
  if (!TONE_KEYS.has(input.toneKey as never)) return { ok: false, error: "invalid_tone" };
  if (!LENGTH_KEYS.has(input.lengthKey as never)) return { ok: false, error: "invalid_length" };
  const custom = String(input.customDetail || "").trim().slice(0, 200);
  if (INJECTION_RE.test(custom) || UNSAFE_RE.test(custom)) return { ok: false, error: "unsafe_input" };
  return { ok: true };
}

export function hasRomanianDiacritics(text: string): boolean {
  return /[ăâîșțĂÂÎȘȚ]/.test(text);
}

/** Lightweight curated samples for client QA (server owns production catalog). */
export function curatedMessagesClient(input: MessageInputClient): CuratedMessageClient[] {
  const locale: LocaleCode = input.locale === "ro" ? "ro" : "en";
  const who = labelFor(RECIPIENTS, input.recipientKey, locale);
  const max = MESSAGE_LENGTHS.find((l) => l.key === input.lengthKey)?.maxChars ?? 280;
  const texts =
    locale === "ro"
      ? [
          `Crăciun fericit, ${who}! Îți doresc căldură, liniște și zile pline de bunătate.`,
          `Dragă ${who}, mulțumesc pentru iubirea care face din fiecare Crăciun un acasă.`,
          `Mă gândesc la tine de sărbători cu recunoștință și speranță.`,
        ]
      : [
          `Merry Christmas, ${who}! Wishing you warmth, rest, and kindness this season.`,
          `Dear ${who}, thank you for the love that makes Christmas feel like home.`,
          `Thinking of you this Christmas with gratitude and hope.`,
        ];
  return texts.map((text, idx) => ({
    result_key: `c${idx + 1}`,
    text: text.slice(0, max + 40),
    tone_key: input.toneKey,
    length_key: input.lengthKey,
    recipient_key: input.recipientKey,
    language: locale,
  }));
}
