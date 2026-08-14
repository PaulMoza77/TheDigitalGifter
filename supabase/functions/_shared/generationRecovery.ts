import { detectImageMime } from "./imageValidation.ts";

export function reuseExistingPredictionId(predictionId: string | null | undefined): string | null {
  const id = String(predictionId || "").trim();
  return id ? id : null;
}

export function shouldCreateNewPrediction(status: string | null | undefined): boolean {
  const s = String(status || "").toLowerCase();
  return !s || s === "failed" || s === "canceled" || s === "cancelled";
}

export function generationStatusAfterWorkerError(): "failed" {
  return "failed";
}

export function resultStorageContentType(
  mime: "image/jpeg" | "image/png" | "image/webp" | null,
): { ok: true; mime: "image/jpeg" | "image/png" | "image/webp"; ext: "jpg" | "png" | "webp" } | { ok: false } {
  if (mime === "image/jpeg") return { ok: true, mime, ext: "jpg" };
  if (mime === "image/png") return { ok: true, mime, ext: "png" };
  if (mime === "image/webp") return { ok: true, mime, ext: "webp" };
  return { ok: false };
}

export function detectStillImageMime(
  bytes: Uint8Array,
): { ok: true; mime: "image/jpeg" | "image/png" | "image/webp"; ext: "jpg" | "png" | "webp" } | { ok: false } {
  return resultStorageContentType(detectImageMime(bytes));
}

export function isStillImageTemplate(args: {
  exists: boolean;
  active: boolean;
  type: string | null;
  prompt: string | null;
}): { ok: true; prompt: string } | { ok: false; error: string } {
  if (!args.exists) return { ok: false, error: "template_not_found" };
  if (!args.active) return { ok: false, error: "template_inactive" };
  const type = String(args.type || "image").toLowerCase();
  if (type === "video") return { ok: false, error: "template_not_still_image" };
  const prompt = String(args.prompt || "").trim();
  if (!prompt) return { ok: false, error: "template_prompt_missing" };
  return { ok: true, prompt };
}

/** Canonical templates.isactive column. Do not select is_active alongside it. */
export const TEMPLATE_ACTIVE_COLUMN = "isactive" as const;
