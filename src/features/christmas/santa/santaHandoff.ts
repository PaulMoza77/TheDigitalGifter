/**
 * Homepage → Santa Video name handoff.
 * Stores only first-name (session-scoped). Never send this value to analytics.
 * Compatible with the Christmas landing handoff key + ?name= query.
 */

import {
  SANTA_HANDOFF_KEY as LANDING_SANTA_HANDOFF_KEY,
  consumeSantaNameHandoff as consumeLandingSantaHandoff,
  readSantaNameHandoff as readLandingSantaHandoff,
} from "../landing/handoff";

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
    // Keep landing key in sync so either reader works during transition.
    sessionStorage.setItem(
      LANDING_SANTA_HANDOFF_KEY,
      JSON.stringify({ childFirstName: normalized, ts: Date.now() }),
    );
  } catch {
    /* ignore quota / private mode */
  }
  return payload;
}

export function readSantaNameHandoff(): SantaNameHandoff | null {
  try {
    const raw = sessionStorage.getItem(SANTA_NAME_HANDOFF_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SantaNameHandoff>;
      const firstName = normalizeSantaFirstName(parsed.firstName);
      if (firstName) {
        const savedAt = Number(parsed.savedAt || 0);
        if (!savedAt || Date.now() - savedAt <= MAX_AGE_MS) {
          return {
            firstName,
            source:
              parsed.source === "query" || parsed.source === "manual" ? parsed.source : "christmas_hub",
            savedAt: savedAt || Date.now(),
          };
        }
      }
    }
  } catch {
    /* fall through to landing key */
  }

  const landingName = normalizeSantaFirstName(readLandingSantaHandoff());
  if (!landingName) return null;
  return { firstName: landingName, source: "christmas_hub", savedAt: Date.now() };
}

export function clearSantaNameHandoff() {
  try {
    sessionStorage.removeItem(SANTA_NAME_HANDOFF_KEY);
  } catch {
    /* ignore */
  }
  consumeLandingSantaHandoff();
}

/** Prefer query ?name= then session handoff. Clears consumed landing handoff. */
export function resolveIncomingSantaName(searchParams: URLSearchParams): {
  firstName: string;
  source: SantaNameHandoff["source"];
} | null {
  const fromQuery = normalizeSantaFirstName(
    searchParams.get("name") ||
      searchParams.get("for") ||
      searchParams.get("child") ||
      searchParams.get("kid"),
  );
  if (fromQuery) {
    writeSantaNameHandoff(fromQuery, "query");
    return { firstName: fromQuery, source: "query" };
  }
  const handoff = readSantaNameHandoff();
  if (handoff) {
    // Prefer durable local key; drop landing-only payload after successful read.
    try {
      sessionStorage.removeItem(LANDING_SANTA_HANDOFF_KEY);
    } catch {
      /* ignore */
    }
    return { firstName: handoff.firstName, source: handoff.source };
  }
  return null;
}
