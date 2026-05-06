import { supabase } from "@/lib/supabase";
import type { MainCategory, TemplateDbRow } from "./types";

export const COLLECTION_BUCKET = "occasion-collections";

export function norm(value: unknown): string {
  return String(value ?? "").trim();
}

export function normalizeSlug(value: unknown): string {
  const raw = norm(value).toLowerCase();

  if (!raw) return "";

  if (raw === "newborn" || raw === "new-born" || raw === "new_born") {
    return "new_born";
  }

  if (raw === "valentines-day") return "valentines_day";
  if (raw === "mothers-day") return "mothers_day";
  if (raw === "fathers-day") return "fathers_day";
  if (raw === "new-years-eve") return "new_years_eve";
  if (raw === "baby-reveal") return "baby_reveal";
  if (raw === "thank-you") return "thank_you";
  if (raw === "name-cards") return "name_cards";
  if (raw === "bible-verses") return "bible_verses";
  if (raw === "pet-loss") return "pet_loss";

  return raw
    .replace(/[’']/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function normalizeMainCategory(value: unknown): MainCategory {
  const raw = norm(value).toLowerCase();

  if (raw === "personal") return "personal";
  if (raw === "spiritual") return "spiritual";
  if (raw === "pets") return "pets";

  return "occasions";
}

export function labelForMainCategory(category: unknown): string {
  const normalized = normalizeMainCategory(category);

  if (normalized === "personal") return "Personal";
  if (normalized === "spiritual") return "Spiritual";
  if (normalized === "pets") return "Pets";

  return "Occasions";
}

export function formatLabel(value: unknown): string {
  const raw = norm(value);

  if (!raw) return "";

  return raw
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace(/\bNew Years Eve\b/g, "New Year’s Eve")
    .replace(/\bValentines Day\b/g, "Valentine’s Day")
    .replace(/\bMothers Day\b/g, "Mother’s Day")
    .replace(/\bFathers Day\b/g, "Father’s Day");
}

export function makeStyleIdFromTitle(title: string): string {
  return norm(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

export function getTemplatePreviewUrl(row: TemplateDbRow): string | null {
  return (
    row.preview_url ||
    row.previewurl ||
    row.thumbnail_url ||
    row.thumbnailurl ||
    row.preview_image_url ||
    null
  );
}

export function extractInvokeErrorMessage(error: unknown): string {
  const err = error as {
    context?: { status?: number; body?: unknown };
    status?: number;
    body?: unknown;
    message?: string;
  };

  const status = err?.context?.status ?? err?.status;
  const body = err?.context?.body ?? err?.body;

  let bodyMessage = "";

  if (typeof body === "string") {
    bodyMessage = body;
  } else if (body && typeof body === "object") {
    const bodyRecord = body as Record<string, unknown>;
    bodyMessage = norm(bodyRecord.error || bodyRecord.message);
  }

  const message = bodyMessage || err?.message || "Request failed";

  return `${status ? `(${status}) ` : ""}${message}`;
}

function safeFileExt(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() || "jpg";
  return ext && ext.length <= 6 ? ext : "jpg";
}

function randomId(): string {
  return Math.random().toString(16).slice(2, 10);
}

export async function uploadCollectionImage(file: File, slug: string): Promise<string> {
  const ext = safeFileExt(file.name);
  const cleanSlug = normalizeSlug(slug) || "collection";
  const path = `${cleanSlug}/${Date.now()}-${randomId()}.${ext}`;

  const { error } = await supabase.storage
    .from(COLLECTION_BUCKET)
    .upload(path, file, {
      upsert: false,
      cacheControl: "3600",
      contentType: file.type || "image/jpeg",
    });

  if (error) throw error;

  const { data } = supabase.storage.from(COLLECTION_BUCKET).getPublicUrl(path);

  return data.publicUrl;
}