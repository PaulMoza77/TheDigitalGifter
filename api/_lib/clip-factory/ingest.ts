import { lookup } from "node:dns/promises";
import { createWriteStream, promises as fs } from "node:fs";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { classifyMediaUrl, isBlockedResolvedAddress } from "../../../src/features/clip-factory/safeUrl";

const MAX_BYTES = 500 * 1024 * 1024;
const ALLOWED_TYPES = /^(video\/(mp4|quicktime|webm|x-m4v|mpeg)|application\/octet-stream)/i;

export class IngestError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export async function assertSafeHostname(hostname: string): Promise<void> {
  const host = hostname.toLowerCase();
  if (isBlockedResolvedAddress(host)) throw new IngestError("ssrf_blocked", "That host cannot be fetched.");
  let addresses: string[] = [];
  try {
    const v4 = await lookup(host, { all: true, verbatim: true });
    addresses = v4.map((row) => row.address);
  } catch {
    throw new IngestError("invalid_url", "Could not resolve that host.");
  }
  for (const address of addresses) {
    if (isBlockedResolvedAddress(address)) throw new IngestError("ssrf_blocked", "That host resolves to a private address.");
  }
}

export async function downloadDirectMedia(urlString: string, dest: string): Promise<{ contentType: string; bytes: number }> {
  const decision = classifyMediaUrl(urlString);
  if (!decision.ok) throw new IngestError(decision.code, decision.message);
  const url = new URL(decision.url);
  await assertSafeHostname(url.hostname);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 180_000);
  try {
    const response = await fetch(decision.url, {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
      headers: { "User-Agent": "TheDigitalGifter-ClipFactory/1.0" },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const loc = response.headers.get("location") || "";
      const next = classifyMediaUrl(new URL(loc, decision.url).toString());
      if (!next.ok) throw new IngestError(next.code, next.message);
      await assertSafeHostname(new URL(next.url).hostname);
      return downloadDirectMedia(next.url, dest);
    }
    if (!response.ok || !response.body) {
      throw new IngestError("unsupported_codec", `Could not download that URL (${response.status}).`);
    }
    const contentType = response.headers.get("content-type") || "application/octet-stream";
    if (contentType.includes("text/html")) {
      throw new IngestError(
        "unsupported_external_source",
        "That URL is a web page, not a media file. Upload the video you have rights to use.",
      );
    }
    if (!ALLOWED_TYPES.test(contentType) && !/\.(mp4|mov|m4v|webm)$/i.test(url.pathname)) {
      throw new IngestError("unsupported_codec", `Unsupported media type: ${contentType}`);
    }
    const length = Number(response.headers.get("content-length") || 0);
    if (length > MAX_BYTES) throw new IngestError("huge_file", "Video is larger than 500MB.");
    const nodeStream = Readable.fromWeb(response.body as import("node:stream/web").ReadableStream);
    let bytes = 0;
    nodeStream.on("data", (chunk) => {
      bytes += chunk.length;
      if (bytes > MAX_BYTES) {
        controller.abort();
      }
    });
    await pipeline(nodeStream, createWriteStream(dest));
    if (bytes > MAX_BYTES) {
      await fs.rm(dest, { force: true });
      throw new IngestError("huge_file", "Video is larger than 500MB.");
    }
    const stat = await fs.stat(dest);
    return { contentType, bytes: stat.size };
  } catch (error) {
    if (error instanceof IngestError) throw error;
    if ((error as Error).name === "AbortError") throw new IngestError("network", "Download timed out. Try uploading the file instead.");
    throw new IngestError("network", error instanceof Error ? error.message : "Download failed.");
  } finally {
    clearTimeout(timer);
  }
}

export function sanitizeFilename(name: string): string {
  const base = String(name || "video.mp4").split(/[/\\]/).pop() || "video.mp4";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
  return cleaned.toLowerCase().endsWith(".mp4") || /\.(mov|m4v|webm)$/i.test(cleaned) ? cleaned : `${cleaned}.mp4`;
}

export const MAX_UPLOAD_BYTES = MAX_BYTES;
export const ALLOWED_UPLOAD_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-m4v",
]);
