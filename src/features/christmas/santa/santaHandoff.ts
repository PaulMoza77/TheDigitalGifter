/**
 * Homepage → Santa Video name handoff.
 * Stores only first-name (session-scoped). Never send this value to analytics.
 */

export const SANTA_NAME_HANDOFF_KEY = "tdg.christmas.santa.name.handoff.v1";

export type SantaNameHandoff = {
  firstName: string;
  source: "christmas_hub" | "query" | "manual";
  savedAt: number;
};

const NAME_RE = /^[A-Za-zÀ-ÿăâîșțĂÂÎȘȚ' -]+$/u;
const MAX_AGE_MS = 2 * 60 * 60 * 1000;

export function normalizeSantaFirstName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.trim().replace(/\s+/g, " ").slice(0, 40);
  if (!name || name.length < 1) return null;
  if (!NAME_RE.test(name)) return null;
  return name;
}

export function writeSantaNameHandoff(
  firstName: string,
  source: SantaNameHandoff["source"] = "christmas_hub",
): SantaNameHandoff | null {
  const normalized = normalizeSantaFirstName(firstName);
  if (!normalized) return null;
  const payload: SantaNameHandoff = {
    firstName: normalized,
    source,
    savedAt: Date.now(),
  };
  try {
    sessionStorage.setItem(SANTA_NAME_HANDOFF_KEY, JSON.stringify(payload));
  } catch {
    /* ignore quota / private mode */
  }
  return payload;
}

export function readSantaNameHandoff(): SantaNameHandoff | null {
  try {
    const raw = sessionStorage.getItem(SANTA_NAME_HANDOFF_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SantaNameHandoff>;
    const firstName = normalizeSantaFirstName(parsed.firstName);
    if (!firstName) return null;
    const savedAt = Number(parsed.savedAt || 0);
    if (savedAt && Date.now() - savedAt > MAX_AGE_MS) {
      clearSantaNameHandoff();
      return null;
    }
    return {
      firstName,
      source: parsed.source === "query" || parsed.source === "manual" ? parsed.source : "christmas_hub",
      savedAt: savedAt || Date.now(),
    };
  } catch {
    return null;
  }
}

export function clearSantaNameHandoff() {
  try {
    sessionStorage.removeItem(SANTA_NAME_HANDOFF_KEY);
  } catch {
    /* ignore */
  }
}

/** Prefer query ?name= then session handoff. Does not clear handoff. */
export function resolveIncomingSantaName(searchParams: URLSearchParams): {
  firstName: string;
  source: SantaNameHandoff["source"];
} | null {
  const fromQuery = normalizeSantaFirstName(searchParams.get("name") || searchParams.get("for"));
  if (fromQuery) {
    writeSantaNameHandoff(fromQuery, "query");
    return { firstName: fromQuery, source: "query" };
  }
  const handoff = readSantaNameHandoff();
  if (handoff) return { firstName: handoff.firstName, source: handoff.source };
  return null;
}
