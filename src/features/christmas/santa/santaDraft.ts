import type { SantaLanguage } from "./santaTypes";
import type { SantaRecipientType } from "./santaCopy";

export const SANTA_DRAFT_KEY = "tdg.christmas.santa.v1";

export type SantaUiStep =
  | "landing"
  | "recipient"
  | "name"
  | "age"
  | "achievement"
  | "wish"
  | "detail"
  | "language"
  | "preview"
  | "confirm"
  | "offer"
  | "checkout"
  | "progress"
  | "result"
  | "error";

export type SantaDraft = {
  step: SantaUiStep;
  recipientType: SantaRecipientType;
  childFirstName: string;
  nameFromHandoff: boolean;
  language: SantaLanguage;
  age: string;
  somethingGood: string;
  hobbyOrInterest: string;
  christmasWish: string;
  customFact: string;
  senderName: string;
  templateKey: string;
  voiceKey: string;
  guardianConsent: boolean;
  email: string;
  orderId: string | null;
  publicToken: string | null;
  lastError: string | null;
};

export function emptySantaDraft(): SantaDraft {
  return {
    step: "landing",
    recipientType: "child",
    childFirstName: "",
    nameFromHandoff: false,
    language: "en",
    age: "",
    somethingGood: "",
    hobbyOrInterest: "",
    christmasWish: "",
    customFact: "",
    senderName: "",
    templateKey: "classic_santa",
    voiceKey: "warm",
    guardianConsent: false,
    email: "",
    orderId: null,
    publicToken: null,
    lastError: null,
  };
}

export function readSantaDraft(): SantaDraft {
  try {
    const raw = sessionStorage.getItem(SANTA_DRAFT_KEY);
    if (!raw) return emptySantaDraft();
    const parsed = JSON.parse(raw) as Partial<SantaDraft>;
    // Migrate legacy step names from the previous form UI
    let step = parsed.step || "landing";
    if (step === ("intro" as SantaUiStep)) step = "landing";
    if (step === ("form" as SantaUiStep)) step = "name";
    if (step === ("review" as SantaUiStep)) step = "preview";
    return { ...emptySantaDraft(), ...parsed, step };
  } catch {
    return emptySantaDraft();
  }
}

export function writeSantaDraft(draft: SantaDraft) {
  try {
    sessionStorage.setItem(SANTA_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* ignore */
  }
}

/** Funnel progress for guided personalization only (excludes landing/checkout/result). */
export function santaFunnelProgress(step: SantaUiStep, nameKnown: boolean): {
  current: number;
  total: number;
} | null {
  const sequence: SantaUiStep[] = nameKnown
    ? ["age", "achievement", "wish", "detail", "language", "preview", "confirm"]
    : ["recipient", "name", "age", "achievement", "wish", "detail", "language", "preview", "confirm"];
  const idx = sequence.indexOf(step);
  if (idx < 0) return null;
  return { current: idx + 1, total: sequence.length };
}
