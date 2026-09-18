import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { LIBRARY_VIDEOS } from "../../../src/features/admin-library/catalog";
import { concatMp4s, probeMp4, TDG_LIBRARY_BUCKET, uploadLibraryObject } from "./storage";

async function resolveClipFile(service: SupabaseClient, clipId: string, destDir: string): Promise<string> {
  const staticItem = LIBRARY_VIDEOS.find((item) => item.id === clipId && item.kind !== "photo");
  if (staticItem) {
    const relative = staticItem.src.replace(/^\//, "");
    const candidates = [join(process.cwd(), "public", relative), join(process.cwd(), "dist", relative)];
    for (const path of candidates) {
      try {
        await fs.access(path);
        return path;
      } catch {
        /* next */
      }
    }
    const origin = String(process.env.TDG_PUBLIC_ORIGIN || process.env.VITE_APP_URL || "https://www.thedigitalgifter.com").replace(
      /\/$/,
      "",
    );
    const res = await fetch(`${origin}${staticItem.src}`);
    if (!res.ok) throw new Error(`Could not load clip ${clipId}`);
    const dest = join(destDir, `${clipId}.mp4`);
    await fs.writeFile(dest, Buffer.from(await res.arrayBuffer()));
    return dest;
  }
  const { data, error } = await service.from("tdg_library_items").select("*").eq("catalog_id", clipId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`Unknown library clip: ${clipId}`);
  const rec = data as { storage_bucket: string; storage_path: string };
  const { data: file, error: dlErr } = await service.storage.from(rec.storage_bucket).download(rec.storage_path);
  if (dlErr || !file) throw new Error(`Could not download ${clipId}`);
  const dest = join(destDir, `${clipId}.mp4`);
  await fs.writeFile(dest, Buffer.from(await file.arrayBuffer()));
  return dest;
}

export async function composeLibraryReel(input: {
  service: SupabaseClient;
  clipIds: string[];
  title?: string;
  createdBy: string | null;
}): Promise<{ catalogId: string; storagePath: string; durationSeconds: number | null; width: number | null; height: number | null }> {
  if (input.clipIds.length < 2) throw new Error("Select at least two library clips to assemble a Reel");
  const dir = await fs.mkdtemp(join(tmpdir(), "tdg-reel-"));
  try {
    const files: string[] = [];
    for (const id of input.clipIds) {
      files.push(await resolveClipFile(input.service, id, dir));
    }
    const output = join(dir, "reel.mp4");
    await concatMp4s(files, output);
    const bytes = await fs.readFile(output);
    const probe = await probeMp4(bytes);
    const catalogId = `reel-hf-${Date.now()}`;
    const filename = `${catalogId}.mp4`;
    const storagePath = `reels/${catalogId}/${filename}`;
    await uploadLibraryObject(storagePath, bytes, "video/mp4");
    const { error } = await input.service.from("tdg_library_items").insert({
      catalog_id: catalogId,
      title: input.title?.trim() || `Assembled Reel (${input.clipIds.length} clips)`,
      description: `ffmpeg concat of ${input.clipIds.join(", ")}. Same montage style as existing Christmas Reels (hard cuts, no audio).`,
      filename,
      category: "christmas_reels",
      kind: "reel",
      duration_seconds: probe.durationSeconds,
      storage_bucket: TDG_LIBRARY_BUCKET,
      storage_path: storagePath,
      requested_params: { clip_ids: input.clipIds },
      submitted_params: { tool: "ffmpeg", mode: "concat" },
      effective_duration_seconds: probe.durationSeconds,
      effective_width: probe.width,
      effective_height: probe.height,
      created_by: input.createdBy,
    });
    if (error) throw error;
    return {
      catalogId,
      storagePath,
      durationSeconds: probe.durationSeconds,
      width: probe.width,
      height: probe.height,
    };
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}
