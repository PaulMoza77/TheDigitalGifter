// src/lib/uploadFileToStorage.ts
import { supabase } from "@/lib/supabase";

type UploadResult = {
  path: string;
  publicUrl: string;
};

function safeName(name: string) {
  return name
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "");
}

export async function uploadFileToStorage(
  file: File,
  opts?: {
    bucket?: string; // default: "uploads"
    folder?: string; // default: "uploads"
    upsert?: boolean; // default: false
    makePublicUrl?: boolean; // default: true
  }
): Promise<UploadResult> {
  const bucket = opts?.bucket ?? "uploads";
  const folder = opts?.folder ?? "uploads";
  const upsert = opts?.upsert ?? false;
  const makePublicUrl = opts?.makePublicUrl ?? true;

  const ext =
    file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : "";
  const filename = safeName(file.name || `file.${ext || "bin"}`);
  const path = `${folder}/${Date.now()}-${filename}`;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      upsert,
      contentType: file.type || "application/octet-stream",
    });

  if (uploadError) throw uploadError;

  if (!makePublicUrl) {
    return { path, publicUrl: "" };
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  const publicUrl = data.publicUrl;

  if (!publicUrl) {
    throw new Error("Could not generate public URL for uploaded file.");
  }

  return { path, publicUrl };
}