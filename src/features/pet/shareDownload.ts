export function portraitFileName(petName: string, sceneTitle: string, ext = "jpg"): string {
  const safe = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "portrait";
  return `${safe(petName)}-${safe(sceneTitle)}.${ext}`;
}

export async function downloadFromUrl(url: string, fileName: string): Promise<void> {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("download failed");
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

export async function sharePortrait(input: {
  url: string;
  title: string;
  text: string;
  fileName: string;
  pageUrl?: string;
}): Promise<"shared" | "copied" | "opened"> {
  try {
    const response = await fetch(input.url);
    if (response.ok) {
      const blob = await response.blob();
      const file = new File([blob], input.fileName, { type: blob.type || "image/jpeg" });
      const canShareFiles = typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
      if (canShareFiles && typeof navigator.share === "function") {
        await navigator.share({ title: input.title, text: input.text, files: [file] });
        return "shared";
      }
    }
  } catch {
    /* fall through to URL share */
  }

  const shareUrl = input.pageUrl || input.url;
  if (typeof navigator.share === "function") {
    await navigator.share({ title: input.title, text: input.text, url: shareUrl });
    return "shared";
  }
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(shareUrl);
    return "copied";
  }
  window.open(shareUrl, "_blank", "noopener,noreferrer");
  return "opened";
}
