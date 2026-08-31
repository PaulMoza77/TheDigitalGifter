import { CHRISTMAS_V2_DRAFT_KEY } from "./config";
import { emptyChristmasDraft, type ChristmasV2Draft } from "./types";

let photoFile: File | null = null;
let photoObjectUrl: string | null = null;

export function setChristmasPhotoFile(file: File | null) {
  if (photoObjectUrl) {
    URL.revokeObjectURL(photoObjectUrl);
    photoObjectUrl = null;
  }
  photoFile = file;
  if (file) photoObjectUrl = URL.createObjectURL(file);
}

export function getChristmasPhotoFile(): File | null {
  return photoFile;
}

export function getChristmasPhotoObjectUrl(): string | null {
  return photoObjectUrl;
}

export function loadChristmasDraft(): ChristmasV2Draft {
  try {
    const raw = localStorage.getItem(CHRISTMAS_V2_DRAFT_KEY);
    if (!raw) return emptyChristmasDraft();
    const parsed = JSON.parse(raw) as Partial<ChristmasV2Draft>;
    return { ...emptyChristmasDraft(), ...parsed };
  } catch {
    return emptyChristmasDraft();
  }
}

export function saveChristmasDraft(draft: ChristmasV2Draft) {
  try {
    localStorage.setItem(
      CHRISTMAS_V2_DRAFT_KEY,
      JSON.stringify({ ...draft, updatedAt: new Date().toISOString() }),
    );
  } catch {
    /* ignore quota */
  }
}

export function clearChristmasDraft() {
  try {
    localStorage.removeItem(CHRISTMAS_V2_DRAFT_KEY);
  } catch {
    /* ignore */
  }
  setChristmasPhotoFile(null);
}
