export type SaveLibraryVideoResult = "shared" | "downloaded" | "ready" | "opened";

const FILE_CACHE_LIMIT = 3;
const fileCache = new Map<string, File>();
const FETCH_TIMEOUT_MS = 120_000;

export function isIpadLikeDevice(userAgent = "", maxTouchPoints = 0, platform = ""): boolean {
  if (/iPad/i.test(userAgent)) return true;
  // iPadOS 13+ reports a desktop Mac UA.
  return platform === "MacIntel" && maxTouchPoints > 1;
}

export function isIosLikeDevice(userAgent = "", maxTouchPoints = 0, platform = ""): boolean {
  if (/iPad|iPhone|iPod/i.test(userAgent)) return true;
  return isIpadLikeDevice(userAgent, maxTouchPoints, platform);
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
  if (blobType.startsWith("video/")) return blobType;
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

/** iPad Web Share for MP4s is an empty AirDrop card. Open the real file instead. */
export function openLibraryVideoInNewTab(url: string, filename: string): "opened" {
  const absolute = new URL(url, window.location.href).toString();
  const link = document.createElement("a");
  link.href = absolute;
  link.download = filename;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  document.body.appendChild(link);
  link.click();
  link.remove();
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
      // Video tags cache Range responses. force-cache can return a truncated MP4
      // and iOS then shows an empty share sheet instead of Save Video.
      cache: "no-store",
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

export async function saveLibraryVideo(input: {
  url: string;
  filename: string;
  title?: string;
  onProgress?: (loaded: number, total: number | null) => void;
}): Promise<SaveLibraryVideoResult> {
  const ios = isIosLikeDevice(navigator.userAgent, navigator.maxTouchPoints, navigator.platform);
  const ipad = isIpadLikeDevice(navigator.userAgent, navigator.maxTouchPoints, navigator.platform);

  // iPad Safari's file share sheet is an empty AirDrop popover and never saves.
  // Open the same-origin MP4 so the native player Share → Save Video works.
  if (ipad) {
    return openLibraryVideoInNewTab(input.url, input.filename);
  }

  const cached = getCachedLibraryVideoFile(input.url);
  const file = cached ?? (await fetchLibraryVideoFile(input.url, input.filename, input.onProgress));
  if (!cached) rememberLibraryVideoFile(input.url, file);

  // iPhone Safari ignores <a download> for MP4 and navigates to a dead-end file page.
  // Share the video file alone so the sheet includes Save Video → Photos.
  if (ios) {
    await shareLibraryVideoFile(file);
    return "shared";
  }

  triggerBlobDownload(file, input.filename);
  return "downloaded";
}
