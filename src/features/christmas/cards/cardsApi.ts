/** Client API for Christmas Cards + Message Generator. */

const FUNNEL_NAME = "christmas-cards-messages-funnel";
const FUNNEL_URL = `${String(import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "")}/functions/v1/${FUNNEL_NAME}`;

export const MESSAGE_GUEST_KEY = "tdg.christmas.message.guest.v1";
export const MESSAGE_SESSION_KEY = "tdg.christmas.message.session.v1";
export const MESSAGE_TO_CARD_KEY = "tdg.christmas.message.handoff.v1";
export const MESSAGE_HANDOFF_KEY = MESSAGE_TO_CARD_KEY;
export const CARD_OWNER_KEY = "tdg.christmas.card.owner.v1";
export const CARD_DRAFT_KEY = "tdg.christmas.card.draft.v1";

export type MessageResult = {
  id: string;
  result_key: string;
  text: string;
  tone_key: string;
  length_key: string;
  recipient_key: string;
  language: string;
  tone?: string;
  length?: string;
  recipient_category?: string;
};

export type GeneratedMessage = MessageResult;

export type MessageToCardHandoff = {
  text: string;
  language: string;
  sessionId?: string;
  resultId?: string;
  resultKey?: string;
  guestToken?: string | null;
  savedAt?: number;
};

export type CardOwnerRecovery = { projectId: string; ownerToken: string };

export type CardDraft = {
  message: string;
  styleKey: string;
  layoutKey: string;
  recipientName?: string;
  fromName?: string;
  messageSource: "manual" | "message_generator";
  messageResultId?: string | null;
  messageResultKey?: string | null;
  messageSessionId?: string | null;
  locale?: string;
};

async function headers(authBearer?: string | null): Promise<Record<string, string>> {
  const anon = String(import.meta.env.VITE_SUPABASE_ANON_KEY || "");
  return {
    "Content-Type": "application/json",
    apikey: anon,
    Authorization: `Bearer ${authBearer || anon}`,
  };
}

export async function cardsMessagesFunnel<T = Record<string, unknown>>(
  body: Record<string, unknown>,
  authBearer?: string | null,
): Promise<T> {
  const res = await fetch(FUNNEL_URL, {
    method: "POST",
    headers: await headers(authBearer),
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || `cards_messages_funnel_${res.status}`);
  return data;
}

export const cardsFunnel = cardsMessagesFunnel;

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function getOrCreateMessageGuestToken(): string {
  try {
    const existing = localStorage.getItem(MESSAGE_GUEST_KEY);
    if (existing && existing.length >= 32) return existing;
    const token = randomToken();
    localStorage.setItem(MESSAGE_GUEST_KEY, token);
    return token;
  } catch {
    return randomToken();
  }
}

export function writeMessageToCardHandoff(value: MessageToCardHandoff) {
  try {
    const payload: MessageToCardHandoff = {
      ...value,
      resultId: value.resultId || value.resultKey || "",
      resultKey: value.resultKey || value.resultId || "",
      guestToken: value.guestToken ?? getOrCreateMessageGuestToken(),
      savedAt: value.savedAt || Date.now(),
    };
    sessionStorage.setItem(MESSAGE_TO_CARD_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

export const writeMessageToCard = writeMessageToCardHandoff;

export function readMessageToCardHandoff(): MessageToCardHandoff | null {
  try {
    const raw = sessionStorage.getItem(MESSAGE_TO_CARD_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MessageToCardHandoff & Record<string, unknown>;
    if (!parsed?.text) return null;
    if (parsed.savedAt && Date.now() - Number(parsed.savedAt) > 2 * 60 * 60 * 1000) return null;
    return {
      text: String(parsed.text),
      language: String(parsed.language || "en"),
      sessionId: parsed.sessionId ? String(parsed.sessionId) : undefined,
      resultId: String(parsed.resultId || parsed.resultKey || ""),
      resultKey: String(parsed.resultKey || parsed.resultId || ""),
      guestToken: parsed.guestToken == null ? null : String(parsed.guestToken),
      savedAt: Number(parsed.savedAt || Date.now()),
    };
  } catch {
    return null;
  }
}

export const readMessageToCard = readMessageToCardHandoff;
export const readMessageHandoff = readMessageToCardHandoff;

export function clearMessageToCardHandoff() {
  try {
    sessionStorage.removeItem(MESSAGE_TO_CARD_KEY);
  } catch {
    /* ignore */
  }
}

export const clearMessageHandoff = clearMessageToCardHandoff;

export function writeCardOwner(value: CardOwnerRecovery | null) {
  try {
    if (!value) localStorage.removeItem(CARD_OWNER_KEY);
    else localStorage.setItem(CARD_OWNER_KEY, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export function readCardOwner(): CardOwnerRecovery | null {
  try {
    const raw = localStorage.getItem(CARD_OWNER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CardOwnerRecovery & {
      project_id?: string;
      owner_token?: string;
    };
    const projectId = parsed.projectId || parsed.project_id;
    const ownerToken = parsed.ownerToken || parsed.owner_token;
    if (!projectId || !ownerToken) return null;
    return { projectId, ownerToken };
  } catch {
    return null;
  }
}

export function writeCardDraft(draft: CardDraft | null) {
  try {
    if (!draft) localStorage.removeItem(CARD_DRAFT_KEY);
    else localStorage.setItem(CARD_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* ignore */
  }
}

export function readCardDraft(): CardDraft | null {
  try {
    const raw = localStorage.getItem(CARD_DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CardDraft;
  } catch {
    return null;
  }
}

export function escapeCardText(value: string): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
