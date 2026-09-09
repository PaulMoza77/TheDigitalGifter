/**
 * Cards V1 harden contract (TDG-CHRISTMAS-GAP-CARDS-HARDEN-011).
 * Does not restart CHRISTMAS-028. Hosted share / print / paid packs stay out.
 */

import { CARD_LAYOUT_KEYS, CARD_STYLE_KEYS, type CardLayoutKey } from "./cardStyles";
import { sanitizeCardPlainText } from "./cardRenderer";
import { MAX_CARD_MESSAGE_CHARS } from "./taxonomy";

export type SanitizedCardDraft = {
  message: string;
  styleKey: string;
  layoutKey: CardLayoutKey;
  recipientName?: string;
  fromName?: string;
  messageSource: "manual" | "message_generator";
  messageResultId?: string | null;
  messageResultKey?: string | null;
  messageSessionId?: string | null;
  locale?: string;
};

/** Card PNG create stays available when the funnel is down. */
export const CARD_LOCAL_FIRST_PNG = true;

/** 20 creates / hour / user|guest|IP — abuse cap, not a paid quota. */
export const CARD_CREATE_RATE_LIMIT = 20;
export const CARD_CREATE_RATE_WINDOW_SECONDS = 3600;

/** Funnel actions that would create an unpaid public gallery or hosted share page. */
export const CARD_BLOCKED_PUBLIC_ACTIONS = [
  "listCards",
  "listPublicCards",
  "listCardGallery",
  "listUnpaidGallery",
  "getPublicCard",
  "getHostedShare",
  "createHostedShare",
  "publishCard",
  "publishCardGallery",
] as const;

export type CardBlockedPublicAction = (typeof CARD_BLOCKED_PUBLIC_ACTIONS)[number];

export function isBlockedCardPublicAction(action: string): action is CardBlockedPublicAction {
  return (CARD_BLOCKED_PUBLIC_ACTIONS as readonly string[]).includes(action);
}

export function localCardProjectRef(projectId?: string | null): string {
  const raw = String(projectId || "local").replace(/[^a-zA-Z0-9_-]/g, "");
  return raw.slice(0, 8) || "local";
}

export function sanitizeCardDraft(raw: unknown): SanitizedCardDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const draft = raw as Partial<SanitizedCardDraft> & Record<string, unknown>;
  const styleKey =
    typeof draft.styleKey === "string" && CARD_STYLE_KEYS.has(draft.styleKey as never)
      ? draft.styleKey
      : "classic_christmas";
  const layoutKey: CardLayoutKey = CARD_LAYOUT_KEYS.has(draft.layoutKey as never)
    ? (draft.layoutKey as CardLayoutKey)
    : "square";
  const messageSource = draft.messageSource === "message_generator" ? "message_generator" : "manual";
  return {
    message: sanitizeCardPlainText(String(draft.message || "")).slice(0, MAX_CARD_MESSAGE_CHARS),
    styleKey,
    layoutKey,
    recipientName: sanitizeCardPlainText(String(draft.recipientName || "")).slice(0, 80),
    fromName: sanitizeCardPlainText(String(draft.fromName || "")).slice(0, 80),
    messageSource,
    messageResultId: draft.messageResultId ? String(draft.messageResultId) : null,
    messageResultKey: draft.messageResultKey ? String(draft.messageResultKey) : null,
    messageSessionId: draft.messageSessionId ? String(draft.messageSessionId) : null,
    locale: draft.locale === "ro" ? "ro" : "en",
  };
}

export const CARD_V1_DEFERRED = {
  hostedSharePage: "out_of_011",
  printFulfillment: "non_goal",
  paidPacks: "out_of_011",
  checkoutActivation: "founder_gate",
  unpaidPublicGallery: "prohibited",
  seoFactory: "out_of_011",
  extraLocales: "out_of_011",
  retentionCron: "deferred_until_policy",
  multiPagePrintSurfaces: "out_of_011",
  publicRenderedStorage: "out_of_v1",
} as const;
