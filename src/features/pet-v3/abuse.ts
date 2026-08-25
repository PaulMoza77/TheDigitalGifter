import { PET_V3_MAX_FREE_PREVIEWS_PER_SESSION } from "./types";

const SESSION_COUNT_KEY = "tdg.petFunnelV3.previewCount.v1";

export function readSessionPreviewCount(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.sessionStorage.getItem(SESSION_COUNT_KEY);
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

export function incrementSessionPreviewCount(): number {
  const next = readSessionPreviewCount() + 1;
  try {
    window.sessionStorage.setItem(SESSION_COUNT_KEY, String(next));
  } catch {
    /* private mode */
  }
  return next;
}

export function sessionAllowsAnotherPreview(): boolean {
  return readSessionPreviewCount() < PET_V3_MAX_FREE_PREVIEWS_PER_SESSION;
}

export function remainingSessionPreviews(): number {
  return Math.max(0, PET_V3_MAX_FREE_PREVIEWS_PER_SESSION - readSessionPreviewCount());
}
