import { MEMORIES_DRAFT_KEY } from "./config";
import { emptyMemoriesDraft, type MemoriesDraft } from "./types";

export function loadMemoriesDraft(): MemoriesDraft {
  try {
    const raw = localStorage.getItem(MEMORIES_DRAFT_KEY);
    if (!raw) return emptyMemoriesDraft();
    const parsed = JSON.parse(raw) as Partial<MemoriesDraft>;
    return {
      ...emptyMemoriesDraft(),
      ...parsed,
      uploads: Array.isArray(parsed.uploads) ? parsed.uploads : [],
    };
  } catch {
    return emptyMemoriesDraft();
  }
}

export function saveMemoriesDraft(draft: MemoriesDraft) {
  try {
    const serializable: MemoriesDraft = {
      ...draft,
      uploads: draft.uploads.map((u) => ({
        ...u,
        // Keep small previews only; drop huge data URLs if needed
        previewDataUrl:
          u.previewDataUrl && u.previewDataUrl.length > 400_000 ? undefined : u.previewDataUrl,
      })),
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(MEMORIES_DRAFT_KEY, JSON.stringify(serializable));
  } catch {
    /* ignore quota */
  }
}

export function clearMemoriesDraft() {
  try {
    localStorage.removeItem(MEMORIES_DRAFT_KEY);
  } catch {
    /* ignore */
  }
}
