import { PET_V4_SESSION_KEY, PET_V4_VISITOR_KEY } from "./types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function randomUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const r = (Math.random() * 16) | 0;
    const v = char === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function readId(storage: Storage | undefined, key: string): string | null {
  if (!storage) return null;
  try {
    const value = storage.getItem(key);
    return value && UUID_RE.test(value) ? value : null;
  } catch {
    return null;
  }
}

function writeId(storage: Storage | undefined, key: string, id: string) {
  if (!storage) return;
  try {
    storage.setItem(key, id);
  } catch {
    /* private mode */
  }
}

/** Isolated from V1/V2/V3 session keys. */
export function getPetV4SessionId(): string {
  if (typeof window === "undefined") return randomUuid();
  try {
    const existing = readId(window.sessionStorage, PET_V4_SESSION_KEY) || readId(window.localStorage, PET_V4_SESSION_KEY);
    if (existing) {
      writeId(window.sessionStorage, PET_V4_SESSION_KEY, existing);
      writeId(window.localStorage, PET_V4_SESSION_KEY, existing);
      return existing;
    }
    const created = randomUuid();
    writeId(window.sessionStorage, PET_V4_SESSION_KEY, created);
    writeId(window.localStorage, PET_V4_SESSION_KEY, created);
    return created;
  } catch {
    return randomUuid();
  }
}

/** Anonymous visitor id (localStorage only) — never PII. */
export function getPetV4VisitorId(): string {
  if (typeof window === "undefined") return randomUuid();
  try {
    const existing = readId(window.localStorage, PET_V4_VISITOR_KEY);
    if (existing) return existing;
    const created = randomUuid();
    writeId(window.localStorage, PET_V4_VISITOR_KEY, created);
    return created;
  } catch {
    return randomUuid();
  }
}

/** Anonymized short id for journey explorer (no PII). */
export function anonymizeSessionShort(sessionId: string): string {
  return String(sessionId || "")
    .replace(/-/g, "")
    .slice(0, 4)
    .toUpperCase();
}
