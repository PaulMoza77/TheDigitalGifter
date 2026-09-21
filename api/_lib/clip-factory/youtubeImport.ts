import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { IngestError } from "./ingest";
import { extractYoutubeId } from "../../../src/features/clip-factory/ingest/adapters/youtube";
import { USER_SOURCE_IMPORT_FAILED, youtubeProviderChain } from "../../../src/features/clip-factory/ingest/providerConfig";
import { importYoutubeAuthorized } from "./providers";
import { sourceDomain } from "./storageIo";

export type IngestAttempt = {
  provider: string;
  ok: boolean;
  durationMs: number;
  errorCode?: string;
  providerError?: string;
};

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

function logAttempt(event: string, extra: Record<string, unknown>) {
  console.log(JSON.stringify({ source: "clip-factory", event, ...extra }));
}

function mapYtdlpFailure(combined: string): IngestError {
  const err = combined.replace(/\s+/g, " ");
  if (/sign in to confirm|not a bot|cookies-from-browser/i.test(err)) {
    return new IngestError("import_unavailable", USER_SOURCE_IMPORT_FAILED);
  }
  if (/\b429\b|too many requests/i.test(err)) {
    return new IngestError("network", USER_SOURCE_IMPORT_FAILED);
  }
  if (/\b403\b/.test(err) && /forbidden|blocked|denied/i.test(err)) {
    return new IngestError("import_unavailable", USER_SOURCE_IMPORT_FAILED);
  }
  if (/private video|login_required/i.test(err)) {
    return new IngestError("source_auth_required", USER_SOURCE_IMPORT_FAILED);
  }
  if (/this video (is|has been) (unavailable|removed)|video has been removed|copyright claim/i.test(err)) {
    return new IngestError("video_unavailable", "This video is unavailable, so no clips were created.");
  }
  return new IngestError("import_unavailable", USER_SOURCE_IMPORT_FAILED);
}

function ytdlpArgs(watch: string, dest: string, extra: string[]): string[] {
  return [
    "--no-playlist",
    "--no-warnings",
    "--newline",
    "--no-mtime",
    ...extra,
    "-f",
    "bv*[height<=1080]+ba/b[height<=1080]/b",
    "--merge-output-format",
    "mp4",
    "-o",
    dest,
    "--force-overwrites",
    watch,
  ];
}

export async function importYoutubeWithYtdlp(url: string, dest: string): Promise<{ contentType: string; bytes: number; attempts: IngestAttempt[] }> {
  const id = extractYoutubeId(url);
  if (!id) throw new IngestError("invalid_url", "That YouTube URL is missing a video id.");
  const bin = youtubeYtdlpBin();
  if (!bin) {
    throw new IngestError("import_unavailable", USER_SOURCE_IMPORT_FAILED);
  }
  const watch = `https://www.youtube.com/watch?v=${id}`;
  const attempts: IngestAttempt[] = [];
  const variants = [[], ["--force-ipv4"]];
  let lastError: IngestError | null = null;
  for (const extra of variants) {
    const started = Date.now();
    try {
      const result = await run(bin, ytdlpArgs(watch, dest, extra), 90 * 60_000);
      const providerError = `${result.stderr} ${result.stdout}`.slice(-1200);
      if (result.code !== 0) {
        lastError = mapYtdlpFailure(providerError);
        attempts.push({
          provider: extra.includes("--force-ipv4") ? "ytdlp_ipv4" : "ytdlp",
          ok: false,
          durationMs: Date.now() - started,
          errorCode: lastError.code,
          providerError: providerError.replace(/\s+/g, " ").slice(0, 280),
        });
        logAttempt("ingest_attempt", {
          provider: extra.includes("--force-ipv4") ? "ytdlp_ipv4" : "ytdlp",
          ok: false,
          source_domain: sourceDomain(watch),
          error_code: lastError.code,
          provider_error: providerError.replace(/\s+/g, " ").slice(0, 280),
        });
        continue;
      }
      const { promises: fs } = await import("node:fs");
      const stat = await fs.stat(dest).catch(() => null);
      if (!stat?.size) {
        lastError = new IngestError("import_unavailable", USER_SOURCE_IMPORT_FAILED);
        continue;
      }
      attempts.push({
        provider: extra.includes("--force-ipv4") ? "ytdlp_ipv4" : "ytdlp",
        ok: true,
        durationMs: Date.now() - started,
      });
      logAttempt("ingest_attempt", {
        provider: extra.includes("--force-ipv4") ? "ytdlp_ipv4" : "ytdlp",
        ok: true,
        source_domain: sourceDomain(watch),
        bytes: stat.size,
      });
      return { contentType: "video/mp4", bytes: stat.size, attempts };
    } catch (error) {
      if (error instanceof IngestError) lastError = error;
      else {
        const message = error instanceof Error ? error.message : String(error);
        if (/ENOENT|not found/i.test(message)) {
          lastError = new IngestError("import_unavailable", USER_SOURCE_IMPORT_FAILED);
        } else {
          lastError = new IngestError("import_unavailable", USER_SOURCE_IMPORT_FAILED);
        }
      }
      attempts.push({
        provider: extra.includes("--force-ipv4") ? "ytdlp_ipv4" : "ytdlp",
        ok: false,
        durationMs: Date.now() - started,
        errorCode: lastError.code,
        providerError: lastError.message.slice(0, 220),
      });
    }
  }
  throw lastError || new IngestError("import_unavailable", USER_SOURCE_IMPORT_FAILED);
}

export async function importYoutubeMedia(
  url: string,
  dest: string,
): Promise<{ contentType: string; bytes: number; provider: string; attempts: IngestAttempt[] }> {
  const chain = youtubeProviderChain();
  const attempts: IngestAttempt[] = [];
  let lastError: IngestError | null = null;
  for (const provider of chain) {
    const started = Date.now();
    try {
      if (provider === "authorized_http") {
        const downloaded = await importYoutubeAuthorized(url, dest);
        attempts.push({ provider, ok: true, durationMs: Date.now() - started });
        logAttempt("ingest_attempt", { provider, ok: true, source_domain: sourceDomain(url), bytes: downloaded.bytes });
        return { ...downloaded, provider, attempts };
      }
      const downloaded = await importYoutubeWithYtdlp(url, dest);
      return { contentType: downloaded.contentType, bytes: downloaded.bytes, provider: "ytdlp", attempts: [...attempts, ...downloaded.attempts] };
    } catch (error) {
      const ingestError =
        error instanceof IngestError ? error : new IngestError("import_unavailable", USER_SOURCE_IMPORT_FAILED);
      lastError = ingestError;
      attempts.push({
        provider,
        ok: false,
        durationMs: Date.now() - started,
        errorCode: ingestError.code,
        providerError: ingestError.message.slice(0, 220),
      });
      logAttempt("ingest_attempt", {
        provider,
        ok: false,
        source_domain: sourceDomain(url),
        error_code: ingestError.code,
        provider_error: ingestError.message.slice(0, 220),
      });
    }
  }
  throw lastError || new IngestError("import_unavailable", USER_SOURCE_IMPORT_FAILED);
}
