export const PET_FUNNEL_SESSION_KEY = "tdg.funnel.session.v1";

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

function readId(storage: Storage | undefined): string | null {
  if (!storage) return null;
  try {
    const value = storage.getItem(PET_FUNNEL_SESSION_KEY);
    return value && UUID_RE.test(value) ? value : null;
  } catch {
    return null;
  }
}

function writeId(storage: Storage | undefined, id: string) {
  if (!storage) return;
  try {
    storage.setItem(PET_FUNNEL_SESSION_KEY, id);
  } catch {
    /* private mode */
  }
}

export function getPetFunnelSessionId(): string {
  if (typeof window === "undefined") return randomUuid();
  try {
    const existing = readId(window.sessionStorage) || readId(window.localStorage);
    if (existing) {
      writeId(window.sessionStorage, existing);
      writeId(window.localStorage, existing);
      return existing;
    }
    const created = randomUuid();
    writeId(window.sessionStorage, created);
    writeId(window.localStorage, created);
    return created;
  } catch {
    return randomUuid();
  }
}

export function inferDeviceType(userAgent?: string): "mobile" | "tablet" | "desktop" {
  const ua = (userAgent || (typeof navigator !== "undefined" ? navigator.userAgent : "")).toLowerCase();
  if (!ua) return "desktop";
  if (/ipad|tablet|playbook|silk/.test(ua)) return "tablet";
  if (/mobile|iphone|ipod|android.+mobile|windows phone/.test(ua)) return "mobile";
  if (/android/.test(ua) && !/mobile/.test(ua)) return "tablet";
  return "desktop";
}
