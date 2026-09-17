export type SaveLibraryVideoResult = "shared" | "downloaded";

export function isIosLikeDevice(userAgent = "", maxTouchPoints = 0, platform = ""): boolean {
  if (/iPad|iPhone|iPod/i.test(userAgent)) return true;
  return platform === "MacIntel" && maxTouchPoints > 1;
}

export function isUserShareCancel(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = "name" in error ? String(error.name) : "";
  return name === "AbortError" || name === "NotAllowedError";
}

function videoFileType(blobType: string): string {
  if (blobType && blobType !== "application/octet-stream" && !blobType.includes("text/html")) {
    return blobType;
  }
  return "video/mp4";
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
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 2_000);
}

function canShareVideoFile(file: File): boolean {
  return typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
}

export async function saveLibraryVideo(input: {
  url: string;
  filename: string;
  title?: string;
}): Promise<SaveLibraryVideoResult> {
  const response = await fetch(input.url, { credentials: "same-origin" });
  if (!response.ok) {
    throw new Error(`Could not download this file (${response.status}).`);
  }
  const blob = await response.blob();
  if (blob.type.includes("text/html")) {
    throw new Error("This video could not be loaded.");
  }
  const file = new File([blob], input.filename, { type: videoFileType(blob.type) });
  const ios = isIosLikeDevice(navigator.userAgent, navigator.maxTouchPoints, navigator.platform);

  // iPhone/iPad Safari ignores <a download> for MP4 and navigates to a dead-end file page.
  // The share sheet is the supported way to Save Video into Photos.
  if (ios) {
    if (typeof navigator.share !== "function" || !canShareVideoFile(file)) {
      throw new Error(
        "This iPhone cannot save the file automatically. Play the clip here, then long-press and choose Save Video.",
      );
    }
    await navigator.share({
      files: [file],
      title: input.title || input.filename,
      text: "Choose Save Video to add this clip to Photos.",
    });
    return "shared";
  }

  triggerBlobDownload(file, input.filename);
  return "downloaded";
}
