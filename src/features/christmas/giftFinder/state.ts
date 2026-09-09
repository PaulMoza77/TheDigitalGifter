/** Session persistence for Gift Finder wizard answers (client-only). */

export const FINDER_ANSWERS_KEY = "tdg.christmas.gift_finder.answers.v2";

export type FinderAnswersState = {
  step: number;
  recipient: string;
  age: string;
  interests: string[];
  customInterest: string;
  personalities: string[];
  budget: string;
  personalDetail: string;
};

export function readFinderAnswers(): FinderAnswersState | null {
  try {
    const raw = sessionStorage.getItem(FINDER_ANSWERS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as FinderAnswersState;
  } catch {
    return null;
  }
}

export function writeFinderAnswers(value: FinderAnswersState | null) {
  try {
    if (!value) sessionStorage.removeItem(FINDER_ANSWERS_KEY);
    else sessionStorage.setItem(FINDER_ANSWERS_KEY, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}
