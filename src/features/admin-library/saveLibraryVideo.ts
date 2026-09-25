export type SaveLibraryVideoResult = "shared" | "downloaded" | "ready" | "opened";

const FILE_CACHE_LIMIT = 3;
const fileCache = new Map<string, File>();
const FETCH_TIMEOUT_MS = 120_000;

export function isIosLikeDevice(userAgent = "", maxTouchPoints = 0, platform = ""): boolean {
  if (/iPad|iPhone|iPod/i.test(userAgent)) return true;
  return platform === "MacIntel" && maxTouchPoints > 1;
}

export function isUserShareCancel(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = "name" in error ? String(error.name) : "";
  return name === "AbortError";
}

export function isShareGestureLost(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = "name" in error ? String(error.name) : "";
  return name === "NotAllowedError";
}

export function videoFileType(filename: string, blobType = ""): string {
  if (blobType.includes("text/html")) return blobType;
  const lower = filename.toLowerCase();
  if (lower.endsWith(".mov")) return "video/quicktime";
  if (lower.endsWith(".m4v") || lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (blobType.startsWith("video/") || blobType.startsWith("image/")) return blobType;
  return "video/mp4";
}

export function getCachedLibraryVideoFile(url: string): File | undefined {
  return fileCache.get(url);
}

export function rememberLibraryVideoFile(url: string, file: File): void {
  if (fileCache.has(url)) fileCache.delete(url);
  fileCache.set(url, file);
  while (fileCache.size > FILE_CACHE_LIMIT) {
    const oldest = fileCache.keys().next().value;
    if (!oldest) break;
    fileCache.delete(oldest);
  }
}

export function clearLibraryVideoFileCache(): void {
  fileCache.clear();
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  globalThis.setTimeout(() => URL.revokeObjectURL(objectUrl), 2_000);
}

/** Same-origin streamed download. Does not buffer the file in JS memory. */
export function triggerDirectDownload(url: string, filename: string): void {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/** iOS/iPad: open the signed MP4 in Safari so Share → Save Video stays native. */
export function openNativeVideoPlayback(url: string): "opened" {
  const w = globalThis as typeof globalThis & {
    open?: (url: string, target?: string, features?: string) => unknown;
    location?: { assign: (href: string) => void };
  };
  const opened = typeof w.open === "function" ? w.open(url, "_blank", "noopener,noreferrer") : null;
  if (!opened && typeof w.location?.assign === "function") {
    w.location.assign(url);
  }
  return "opened";
}

export function iosVideoSharePayload(file: File): ShareData {
  // iOS treats files+text as a document share and hides Save Video / Photos.
  return { files: [file] };
}

function canShareVideoFile(file: File): boolean {
  if (typeof navigator.share !== "function") return false;
  if (typeof navigator.canShare !== "function") return true;
  try {
    return navigator.canShare(iosVideoSharePayload(file));
  } catch {
    return true;
  }
}

export async function shareLibraryVideoFile(file: File): Promise<"shared"> {
  if (!canShareVideoFile(file) || typeof navigator.share !== "function") {
    throw new Error(
      "This iPhone cannot save the file automatically. Play the clip here, then long-press and choose Save Video.",
    );
  }
  await navigator.share(iosVideoSharePayload(file));
  return "shared";
}

async function readResponseBytes(
  response: Response,
  onProgress?: (loaded: number, total: number | null) => void,
): Promise<ArrayBuffer> {
  const totalHeader = response.headers.get("content-length");
  const total = totalHeader ? Number(totalHeader) : null;
  if (!response.body || typeof response.body.getReader !== "function") {
    const buffer = await response.arrayBuffer();
    onProgress?.(buffer.byteLength, total ?? buffer.byteLength);
    return buffer;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      loaded += value.byteLength;
      onProgress?.(loaded, Number.isFinite(total) ? total : null);
    }
  }

  const bytes = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes.buffer;
}

export async function fetchLibraryVideoFile(
  url: string,
  filename: string,
  onProgress?: (loaded: number, total: number | null) => void,
): Promise<File> {
  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      credentials: "same-origin",
      cache: "force-cache",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Could not download this file (${response.status}).`);
    }
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("text/html")) {
      throw new Error("This video could not be loaded.");
    }
    const buffer = await readResponseBytes(response, onProgress);
    const type = videoFileType(filename, contentType);
    if (type.includes("text/html")) {
      throw new Error("This video could not be loaded.");
    }
    return new File([buffer], filename, { type, lastModified: Date.now() });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error("This video is taking too long to download. Check your connection and try again.");
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timer);
  }
}

export type SaveLibraryVideoKind = "reel" | "short" | "photo" | "long_form";

export async function saveLibraryVideo(input: {
  url: string;
  filename: string;
  title?: string;
  kind?: SaveLibraryVideoKind;
  downloadUrl?: string;
  onProgress?: (loaded: number, total: number | null) => void;
}): Promise<SaveLibraryVideoResult> {
  const ios = isIosLikeDevice(navigator.userAgent, navigator.maxTouchPoints, navigator.platform);

  // Long-form files can be 1GB+. Never fetch the entire MP4 into a JS File.
  if (input.kind === "long_form") {
    if (ios) {
      openNativeVideoPlayback(input.url);
      return "opened";
    }
    triggerDirectDownload(input.downloadUrl || input.url, input.filename);
    return "downloaded";
  }

  const cached = getCachedLibraryVideoFile(input.url);
  const file = cached ?? (await fetchLibraryVideoFile(input.url, input.filename, input.onProgress));
  if (!cached) rememberLibraryVideoFile(input.url, file);

  // iPhone/iPad Safari ignores <a download> for MP4 and navigates to a dead-end file page.
  // Share the video file alone so the sheet includes Save Video → Photos.
  if (ios) {
    await shareLibraryVideoFile(file);
    return "shared";
  }

  triggerBlobDownload(file, input.filename);
  return "downloaded";
}
