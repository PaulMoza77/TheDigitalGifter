import { spawn } from "node:child_process";
import { createWriteStream, promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { getServiceClient } from "../christmas/supabaseClient";
import { isFtypMp4 } from "../../../src/features/admin-library/mediaSpec";

export const TDG_LIBRARY_BUCKET = "tdg-library";
export const TDG_LIBRARY_SIGNED_SECONDS = 60 * 60 * 24;

export type ProbeResult = {
  durationSeconds: number;
  width: number;
  height: number;
  codec: string | null;
};

export async function downloadBinary(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download_failed:${res.status}`);
  const type = res.headers.get("content-type") || "";
  if (type.includes("text/html")) throw new Error("download_failed:html");
  return new Uint8Array(await res.arrayBuffer());
}

function run(cmd: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
      if (stderr.length > 4000) stderr = stderr.slice(-4000);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${cmd}_exit_${code}:${stderr.slice(0, 400)}`));
    });
  });
}

export async function probeMp4(bytes: Uint8Array): Promise<ProbeResult> {
  if (!isFtypMp4(bytes)) {
    throw new Error("Downloaded file is not a readable MP4 (missing ftyp). Import not verified.");
  }
  const dir = await fs.mkdtemp(join(tmpdir(), "tdg-lib-"));
  const file = join(dir, "clip.mp4");
  try {
    await fs.writeFile(file, bytes);
    const { stdout } = await run("ffprobe", [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=width,height,codec_name",
      "-show_entries",
      "format=duration,format_name",
      "-of",
      "json",
      file,
    ]);
    const data = JSON.parse(stdout) as {
      streams?: Array<{ width?: number; height?: number; codec_name?: string }>;
      format?: { duration?: string; format_name?: string };
    };
    const stream = data.streams?.[0];
    if (!stream?.width || !stream?.height) {
      throw new Error("ffprobe did not return video width/height. Import not verified.");
    }
    const duration = data.format?.duration ? Number(data.format.duration) : NaN;
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new Error("ffprobe did not return a positive duration. Import not verified.");
    }
    const formatName = String(data.format?.format_name || "");
    if (formatName && !formatName.includes("mp4") && !formatName.includes("mov") && !formatName.includes("ism")) {
      throw new Error(`ffprobe format ${formatName} is not MP4. Import not verified.`);
    }
    return {
      durationSeconds: duration,
      width: stream.width,
      height: stream.height,
      codec: stream.codec_name ?? null,
    };
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

export async function uploadLibraryObject(path: string, bytes: Uint8Array, contentType: string): Promise<void> {
  const service = getServiceClient();
  const { error } = await service.storage.from(TDG_LIBRARY_BUCKET).upload(path, bytes, {
    contentType,
    upsert: true,
  });
  if (error) throw new Error(`tdg_library_upload_failed:${error.message}`);
}

export async function signedLibraryUrl(path: string): Promise<string | null> {
  const service = getServiceClient();
  const { data, error } = await service.storage.from(TDG_LIBRARY_BUCKET).createSignedUrl(path, TDG_LIBRARY_SIGNED_SECONDS);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export async function downloadToFile(url: string, dest: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`download_failed:${res.status}`);
  const nodeStream = Readable.fromWeb(res.body as import("node:stream/web").ReadableStream);
  await pipeline(nodeStream, createWriteStream(dest));
}

export function ffmpegConcatArgs(listFile: string, output: string): string[] {
  return [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    listFile,
    "-c:v",
    "libx264",
    "-profile:v",
    "high",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    "-an",
    output,
  ];
}

export async function concatMp4s(paths: string[], output: string): Promise<void> {
  const dir = await fs.mkdtemp(join(tmpdir(), "tdg-concat-"));
  const listFile = join(dir, "list.txt");
  const list = paths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n");
  await fs.writeFile(listFile, list);
  try {
    await run("ffmpeg", ffmpegConcatArgs(listFile, output));
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

export { run as runMediaCommand };
