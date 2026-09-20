import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { IngestError } from "./ingest";
import { extractYoutubeId } from "../../../src/features/clip-factory/ingest/adapters/youtube";
import { importYoutubeAuthorized } from "./providers";

function run(bin: string, args: string[], timeoutMs: number): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new IngestError("network", `${bin} timed out while importing YouTube media.`));
    }, timeoutMs);
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
      if (stdout.length > 500_000) stdout = stdout.slice(-200_000);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
      if (stderr.length > 80_000) stderr = stderr.slice(-40_000);
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code: code ?? 1 });
    });
  });
}

export function youtubeYtdlpBin(): string | null {
  if (String(process.env.CLIP_FACTORY_DISABLE_YTDLP || "").trim() === "1") return null;
  const candidates = [
    process.env.CLIP_FACTORY_YTDLP_BIN,
    "yt-dlp",
    "/usr/bin/yt-dlp",
    "/usr/local/bin/yt-dlp",
  ].filter(Boolean) as string[];
  for (const bin of candidates) {
    if (bin === "yt-dlp") return bin;
    if (existsSync(bin)) return bin;
  }
  return "yt-dlp";
}

function youtubeImportBlockedMessage(detail: string): string {
  return `YouTube blocked automatic media download (${detail}). Official YouTube APIs only return title/thumbnail, not the video file. Upload the original MP4 you have rights to use, or choose it from Library.`;
}

export async function importYoutubeWithYtdlp(url: string, dest: string): Promise<{ contentType: string; bytes: number }> {
  const id = extractYoutubeId(url);
  if (!id) throw new IngestError("invalid_url", "That YouTube URL is missing a video id.");
  const bin = youtubeYtdlpBin();
  if (!bin) {
    throw new IngestError(
      "import_unavailable",
      "Automatic YouTube import is disabled. Upload the original video file instead.",
    );
  }
  const watch = `https://www.youtube.com/watch?v=${id}`;
  try {
    const result = await run(
      bin,
      [
        "--no-playlist",
        "--no-warnings",
        "--newline",
        "-f",
        "bv*[height<=1080]+ba/b[height<=1080]/b",
        "--merge-output-format",
        "mp4",
        "-o",
        dest,
        "--force-overwrites",
        watch,
      ],
      12 * 60_000,
    );
    if (result.code !== 0) {
      const err = `${result.stderr} ${result.stdout}`.slice(-1200);
      if (/private|login_required|sign in/i.test(err)) {
        throw new IngestError("source_auth_required", youtubeImportBlockedMessage("login or private video"));
      }
      if (/unavailable|removed|copyright/i.test(err)) {
        throw new IngestError("video_unavailable", "Video is unavailable.");
      }
      throw new IngestError("import_unavailable", youtubeImportBlockedMessage(err.replace(/\s+/g, " ").slice(0, 220)));
    }
  } catch (error) {
    if (error instanceof IngestError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    if (/ENOENT|not found/i.test(message)) {
      throw new IngestError(
        "import_unavailable",
        "yt-dlp is not installed on this origin, so YouTube files cannot be imported automatically. Upload the original video.",
      );
    }
    throw new IngestError("import_unavailable", youtubeImportBlockedMessage(message.slice(0, 220)));
  }
  const { promises: fs } = await import("node:fs");
  const stat = await fs.stat(dest).catch(() => null);
  if (!stat?.size) {
    throw new IngestError("import_unavailable", youtubeImportBlockedMessage("empty download"));
  }
  return { contentType: "video/mp4", bytes: stat.size };
}

export async function importYoutubeMedia(url: string, dest: string): Promise<{ contentType: string; bytes: number }> {
  const authorized = String(process.env.CLIP_FACTORY_YOUTUBE_IMPORT_URL || "").trim();
  if (authorized) {
    try {
      return await importYoutubeAuthorized(url, dest);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(
        JSON.stringify({
          source: "clip-factory",
          event: "authorized_youtube_import_failed",
          message: message.slice(0, 300),
        }),
      );
    }
  }
  return importYoutubeWithYtdlp(url, dest);
}
