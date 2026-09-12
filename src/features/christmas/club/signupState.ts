import {
  CHRISTMAS_CLUB_CONFIG,
  CHRISTMAS_CLUB_JOINED_STORAGE_KEY,
} from "./config";
import type { ChristmasClubSignupMethod } from "./signupContract";

export type ChristmasClubJoinedState = {
  year: number;
  method: ChristmasClubSignupMethod;
  joinedAt: string;
};

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readClubJoinedState(
  year: number = CHRISTMAS_CLUB_CONFIG.campaignYear,
): ChristmasClubJoinedState | null {
  if (!canUseStorage()) return null;
  try {
    const raw = window.localStorage.getItem(CHRISTMAS_CLUB_JOINED_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ChristmasClubJoinedState>;
    if (parsed.year !== year) return null;
    if (parsed.method !== "email" && parsed.method !== "google") return null;
    return {
      year,
      method: parsed.method,
      joinedAt: typeof parsed.joinedAt === "string" ? parsed.joinedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function writeClubJoinedState(state: ChristmasClubJoinedState): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(CHRISTMAS_CLUB_JOINED_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* private mode */
  }
}

export function markClubJoined(method: ChristmasClubSignupMethod, year = CHRISTMAS_CLUB_CONFIG.campaignYear) {
  writeClubJoinedState({
    year,
    method,
    joinedAt: new Date().toISOString(),
  });
}
