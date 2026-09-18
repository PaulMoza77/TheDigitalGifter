import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LibraryVideo } from "../../../src/features/admin-library/catalog";
import { findLibraryPhoto } from "../../../src/features/admin-library/libraryMerge";
import { evaluateSourcePhoto, probeImageBuffer } from "../../../src/features/admin-library/mediaSpec";
import type { HiggsfieldTransport } from "./client";
import { TDG_LIBRARY_BUCKET, uploadLibraryObject } from "./storage";

const IMAGE_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export function contentTypeForFilename(filename: string): string {
  const lower = filename.toLowerCase();
  const ext = lower.slice(lower.lastIndexOf("."));
  return IMAGE_TYPES[ext] || "image/jpeg";
}

export type ResolvedPhoto = LibraryVideo & {
  storageBucket?: string | null;
  storagePath?: string | null;
};

export async function resolveLibraryPhoto(
  service: SupabaseClient,
  photoId: string,
): Promise<ResolvedPhoto> {
  const staticPhoto = findLibraryPhoto(photoId);
  if (staticPhoto) return staticPhoto;
  const { data, error } = await service
    .from("tdg_library_items")
    .select("*")
    .eq("catalog_id", photoId)
    .eq("kind", "photo")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`Unknown TDG Library photo: ${photoId}`);
  const rec = data as Record<string, unknown>;
  return {
    id: String(rec.catalog_id),
    title: String(rec.title || rec.catalog_id),
    description: String(rec.description || ""),
    src: "",
    filename: String(rec.filename || "photo.jpg"),
    category: "christmas_reels",
    kind: "photo",
    storageBucket: String(rec.storage_bucket || TDG_LIBRARY_BUCKET),
    storagePath: String(rec.storage_path || ""),
  };
}

export async function readResolvedPhotoBytes(
  service: SupabaseClient,
  photo: ResolvedPhoto,
): Promise<{ bytes: Uint8Array; contentType: string }> {
  if (photo.storageBucket && photo.storagePath) {
    const { data, error } = await service.storage.from(photo.storageBucket).download(photo.storagePath);
    if (error || !data) throw new Error(`Could not read private library photo ${photo.id}`);
    return { bytes: new Uint8Array(await data.arrayBuffer()), contentType: contentTypeForFilename(photo.filename) };
  }
  const relative = photo.src.replace(/^\//, "");
  const candidates = [join(process.cwd(), "public", relative), join(process.cwd(), "dist", relative)];
  for (const path of candidates) {
    try {
      const bytes = await fs.readFile(path);
      return { bytes, contentType: contentTypeForFilename(photo.filename) };
    } catch {
      /* next */
    }
  }
  const origin = String(process.env.TDG_PUBLIC_ORIGIN || process.env.VITE_APP_URL || "https://www.thedigitalgifter.com").replace(
    /\/$/,
    "",
  );
  if (!photo.src.startsWith("/")) throw new Error(`Could not load library photo ${photo.id}`);
  const res = await fetch(`${origin}${photo.src}`);
  if (!res.ok) throw new Error(`Could not load library photo ${photo.id} (${res.status})`);
  return { bytes: new Uint8Array(await res.arrayBuffer()), contentType: contentTypeForFilename(photo.filename) };
}

export async function preparePhotoForHiggsfield(
  service: SupabaseClient,
  transport: HiggsfieldTransport,
  photoId: string,
): Promise<{ photo: ResolvedPhoto; imageUrl: string; width: number; height: number; notes: string[] }> {
  const photo = await resolveLibraryPhoto(service, photoId);
  const { bytes, contentType } = await readResolvedPhotoBytes(service, photo);
  const probe = probeImageBuffer(bytes);
  const check = evaluateSourcePhoto(probe);
  if (photo.id.includes("upscaled") || /UPSCALED/i.test(photo.description || "")) {
    check.notes.push(
      "Source is an upscaled copy, not native 1080p. Generated MP4 size is still verified after import; this prep does not prove result resolution.",
    );
  }
  // Estimate may proceed with an explicit nonconforming still. Paid submit stays blocked.
  // Private library objects are not on a durable public URL. Upload to Higgsfield input storage.
  const mustUpload = Boolean(photo.storagePath);
  const origin = String(process.env.TDG_PUBLIC_ORIGIN || process.env.VITE_APP_URL || "").replace(/\/$/, "");
  const publicOk = /^https:\/\//i.test(origin) && !/localhost|127\.0\.0\.1/i.test(origin) && photo.src.startsWith("/");
  let imageUrl: string;
  if (mustUpload || !publicOk) {
    const upload = await transport.createUploadUrl(contentType);
    await transport.putUpload(upload.upload_url, bytes, upload.upload_headers);
    imageUrl = upload.public_url;
  } else {
    imageUrl = `${origin}${photo.src}`;
  }
  return { photo, imageUrl, width: probe.width, height: probe.height, notes: check.notes };
}

export async function registerLibraryStillFile(
  service: SupabaseClient,
  input: {
    catalogId: string;
    title: string;
    description: string;
    filename: string;
    bytes: Uint8Array;
    sourcePhotoId?: string | null;
  },
): Promise<{ photoId: string; width: number; height: number; storagePath: string }> {
  const probe = probeImageBuffer(input.bytes);
  const storagePath = `photos/${input.catalogId}/${input.filename}`;
  await uploadLibraryObject(storagePath, input.bytes, contentTypeForFilename(input.filename));
  const { error } = await service.from("tdg_library_items").upsert(
    {
      catalog_id: input.catalogId,
      title: input.title,
      description: input.description,
      filename: input.filename,
      category: "christmas_reels",
      kind: "photo",
      storage_bucket: TDG_LIBRARY_BUCKET,
      storage_path: storagePath,
      source_photo_id: input.sourcePhotoId || null,
      effective_width: probe.width,
      effective_height: probe.height,
      spec_ok: evaluateSourcePhoto(probe).ok,
      spec_notes: evaluateSourcePhoto(probe).notes.concat(
        /UPSCALED/i.test(input.description)
          ? ["Registered as an upscaled still. Output MP4 spec is verified separately after import."]
          : [],
      ),
      requested_params: {
        kind: "library_still",
        native_source: input.sourcePhotoId || null,
      },
      created_by: "script",
    },
    { onConflict: "catalog_id" },
  );
  if (error) throw error;
  return { photoId: input.catalogId, width: probe.width, height: probe.height, storagePath };
}

export async function listSelectablePhotos(service: SupabaseClient): Promise<Array<{ id: string; title: string; filename: string; src: string; source: "static" | "library" }>> {
  const { libraryPhotos } = await import("../../../src/features/admin-library/libraryMerge");
  const staticItems = libraryPhotos().map((p) => ({
    id: p.id,
    title: p.title,
    filename: p.filename,
    src: p.src,
    source: "static" as const,
  }));
  const { data, error } = await service.from("tdg_library_items").select("catalog_id,title,filename,kind").eq("kind", "photo").order("created_at", { ascending: false }).limit(200);
  if (error) throw error;
  const uploaded = (data || []).map((row) => {
    const rec = row as Record<string, unknown>;
    return {
      id: String(rec.catalog_id),
      title: String(rec.title || rec.catalog_id),
      filename: String(rec.filename || "photo.jpg"),
      src: "",
      source: "library" as const,
    };
  });
  const seen = new Set(uploaded.map((item) => item.id));
  return [...uploaded, ...staticItems.filter((item) => !seen.has(item.id))];
}

export function commandKey(input: {
  photoId: string;
  prompt: string;
  modelKey: string;
  durationSeconds: number;
  resolution: string;
  audio: boolean;
  clientKey?: string | null;
}): string {
  if (input.clientKey && input.clientKey.trim()) return input.clientKey.trim();
  const material = [
    input.photoId,
    input.prompt.trim(),
    input.modelKey,
    String(input.durationSeconds),
    input.resolution,
    input.audio ? "audio" : "silent",
  ].join("\n");
  return createHash("sha256").update(material).digest("hex");
}
