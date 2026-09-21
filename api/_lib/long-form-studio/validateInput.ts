import { MUSIC_MOODS, STYLE_PRESETS, type StylePreset } from "../../../src/features/long-form-studio/types";
import { LIBRARY_VIDEOS } from "../../../src/features/admin-library/catalog";

export function shortDurationAllowed(): boolean {
  return process.env.VITEST === "true" || process.env.LONG_FORM_ALLOW_SHORT === "1";
}

export function assertCreatePayload(input: {
  sceneIds: string[];
  mood: string;
  style: string;
  durationSeconds: number;
}): { sceneIds: string[]; mood: string; style: StylePreset; durationSeconds: number } {
  const sceneIds = [...new Set(input.sceneIds.map((id) => String(id).trim()).filter(Boolean))];
  if (!sceneIds.length) throw Object.assign(new Error("Choose a scene from the Library."), { status: 400 });
  if (sceneIds.length > 8) throw Object.assign(new Error("Use at most eight scenes."), { status: 400 });
  for (const id of sceneIds) {
    if (!LIBRARY_VIDEOS.some((item) => item.id === id)) {
      throw Object.assign(new Error("That scene is not in the Library."), { status: 400 });
    }
  }
  if (!MUSIC_MOODS.includes(input.mood as (typeof MUSIC_MOODS)[number])) {
    throw Object.assign(new Error("Choose a music mood."), { status: 400 });
  }
  if (!STYLE_PRESETS.includes(input.style as StylePreset)) {
    throw Object.assign(new Error("Choose a style."), { status: 400 });
  }
  const duration = Number(input.durationSeconds);
  const allowed = duration === 3600 || (duration === 12 && shortDurationAllowed());
  if (!allowed) {
    throw Object.assign(new Error("Only the 1 hour length is available until longer times are validated."), { status: 400 });
  }
  return { sceneIds, mood: input.mood, style: input.style as StylePreset, durationSeconds: duration };
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
