import type { SantaLanguage } from "./santaTypes";
import type { SantaRecipientType } from "./santaCopy";

export const SANTA_DRAFT_KEY = "tdg.christmas.santa.v1";

export type SantaUiStep =
  | "landing"
  | "recipient"
  | "name"
  | "age"
  | "achievement"
  | "interest"
  | "wish"
  | "sender"
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
    // Migrate legacy step names from previous UIs
    let step = (parsed.step || "landing") as SantaUiStep;
    if ((step as string) === "intro") step = "landing";
    if ((step as string) === "form") step = "name";
    if ((step as string) === "review") step = "preview";
    if (step === "detail") step = "interest";
    if (step === "language") step = "preview";
    if (step === "recipient") step = "name";
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

/** Core personalization questions shown as progress dots (excludes preview/checkout). */
export function santaQuestionSteps(nameKnown: boolean): SantaUiStep[] {
  return nameKnown
    ? ["age", "achievement", "interest", "wish", "sender"]
    : ["name", "age", "achievement", "interest", "wish", "sender"];
}

/** Funnel progress for guided personalization only. */
export function santaFunnelProgress(
  step: SantaUiStep,
  nameKnown: boolean,
): { current: number; total: number } | null {
  const questions = santaQuestionSteps(nameKnown);
  const qIdx = questions.indexOf(step);
  if (qIdx >= 0) {
    return { current: qIdx + 1, total: questions.length };
  }

  // Preview / confirm still report completion of question phase
  if (step === "preview" || step === "confirm" || step === "offer") {
    return { current: questions.length, total: questions.length };
  }
  return null;
}
