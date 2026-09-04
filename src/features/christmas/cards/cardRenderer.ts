/** Deterministic client canvas renderer → real PNG blob ($0 AI). */

import { getCardLayout, getCardStyle, MAX_CARD_MESSAGE_CHARS } from "./styles";

export type CardRenderInput = {
  message: string;
  styleKey: string;
  layoutKey: string;
  recipientName?: string;
  fromName?: string;
  photo?: HTMLImageElement | ImageBitmap | null;
  photoFit?: "cover" | "contain";
  projectRef?: string;
};

export type CardRenderResult = {
  blob: Blob;
  width: number;
  height: number;
  dataUrl: string;
  byteSize: number;
  filename: string;
};

export function sanitizeCardPlainText(value: string): string {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_CARD_MESSAGE_CHARS);
}

export function escapeCardText(value: string): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type MeasureFn = (text: string) => number;

function resolveMeasure(
  ctxOrMeasure: Pick<CanvasRenderingContext2D, "measureText"> | MeasureFn,
): MeasureFn {
  if (typeof ctxOrMeasure === "function") return ctxOrMeasure;
  return (text: string) => ctxOrMeasure.measureText(text).width;
}

export function wrapTextLines(
  ctxOrMeasure: Pick<CanvasRenderingContext2D, "measureText"> | MeasureFn,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const measure = resolveMeasure(ctxOrMeasure);
  const words = sanitizeCardPlainText(text).split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (measure(next) <= maxWidth) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word;
      if (lines.length >= maxLines - 1) break;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  if (words.length && lines.length === maxLines) {
    let clipped = lines[maxLines - 1] || "";
    while (clipped.length > 3 && measure(`${clipped}…`) > maxWidth) {
      clipped = clipped.slice(0, -1);
    }
    lines[maxLines - 1] = `${clipped}…`;
  }
  return lines.slice(0, maxLines);
}

export function adaptiveFontSize(messageLength: number, canvasWidth: number): number {
  const base = canvasWidth >= 1500 ? 44 : canvasWidth >= 1080 ? 48 : 40;
  if (messageLength > 400) return Math.round(base * 0.62);
  if (messageLength > 250) return Math.round(base * 0.75);
  if (messageLength > 140) return Math.round(base * 0.88);
  return base;
}

export function validatePhotoFile(file: File): { ok: true } | { ok: false; error: string } {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return { ok: false, error: "Please upload a JPEG, PNG, or WebP photo." };
  }
  if (file.size <= 0 || file.size > 8 * 1024 * 1024) {
    return { ok: false, error: "Photo must be under 8MB." };
  }
  return { ok: true };
}

export function cardDownloadFilename(projectRef: string, layoutKey: string): string {
  const safe =
    String(projectRef || "card")
      .replace(/[^a-zA-Z0-9_-]/g, "")
      .slice(0, 24) || "card";
  const layout = ["square", "story", "landscape"].includes(layoutKey) ? layoutKey : "square";
  return `tdg-christmas-card-${safe}-${layout}.png`;
}

export const cardFileName = cardDownloadFilename;

function imageSize(image: HTMLImageElement | ImageBitmap): { w: number; h: number } {
  if ("naturalWidth" in image) {
    return { w: image.naturalWidth || image.width, h: image.naturalHeight || image.height };
  }
  return { w: image.width, h: image.height };
}

function drawFit(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  x: number,
  y: number,
  width: number,
  height: number,
  iw: number,
  ih: number,
  fit: "cover" | "contain",
) {
  const scale = fit === "contain" ? Math.min(width / iw, height / ih) : Math.max(width / iw, height / ih);
  const drawW = iw * scale;
  const drawH = ih * scale;
  ctx.drawImage(image, x + (width - drawW) / 2, y + (height - drawH) / 2, drawW, drawH);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export async function renderChristmasCard(input: CardRenderInput): Promise<CardRenderResult> {
  const layout = getCardLayout(input.layoutKey);
  const style = getCardStyle(input.styleKey);
  const canvas = document.createElement("canvas");
  canvas.width = layout.width;
  canvas.height = layout.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas_unavailable");

  const grad = ctx.createLinearGradient(0, 0, 0, layout.height);
  grad.addColorStop(0, style.bgTop);
  grad.addColorStop(1, style.bgBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, layout.width, layout.height);

  ctx.strokeStyle = style.accent;
  ctx.lineWidth = Math.max(8, Math.round(layout.width * 0.012));
  const pad = ctx.lineWidth + 10;
  ctx.strokeRect(pad, pad, layout.width - pad * 2, layout.height - pad * 2);

  const photoH = input.photo
    ? layout.key === "story"
      ? Math.round(layout.height * 0.42)
      : Math.round(layout.height * 0.38)
    : 0;

  let textTop = pad + 36;
  if (input.photo && photoH > 0) {
    const { w, h } = imageSize(input.photo);
    const photoY = pad + 24;
    const photoX = pad + 24;
    const photoW = layout.width - (pad + 24) * 2;
    ctx.save();
    roundRect(ctx, photoX, photoY, photoW, photoH, 18);
    ctx.clip();
    drawFit(ctx, input.photo, photoX, photoY, photoW, photoH, w, h, input.photoFit || "cover");
    ctx.restore();
    ctx.fillStyle = style.accent;
    ctx.fillRect(photoX, photoY + photoH + 10, photoW, 4);
    textTop = photoY + photoH + 40;
  }

  const message = sanitizeCardPlainText(input.message) || "Merry Christmas!";
  const fontSize = adaptiveFontSize(message.length, layout.width);
  const maxLines = layout.key === "story" ? 14 : layout.key === "landscape" ? 8 : 10;
  const panelX = pad + 28;
  const panelW = layout.width - (pad + 28) * 2;
  const maxTextW = panelW - 48;

  ctx.font = `600 ${fontSize}px Georgia, "Times New Roman", serif`;
  const lines = wrapTextLines(ctx, message, maxTextW, maxLines);
  const lineH = fontSize * 1.28;
  const blockH = lines.length * lineH + 80;
  const panelY = textTop;
  const panelH = Math.min(layout.height - panelY - pad - 50, Math.max(blockH, layout.height * 0.28));

  ctx.fillStyle = style.panel;
  roundRect(ctx, panelX, panelY, panelW, panelH, 22);
  ctx.fill();

  ctx.fillStyle = style.text;
  ctx.font = `600 ${fontSize}px Georgia, "Times New Roman", serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  let ty = panelY + Math.max(24, (panelH - lines.length * lineH - 40) / 2);
  for (const line of lines) {
    ctx.fillText(line, layout.width / 2, ty, maxTextW);
    ty += lineH;
  }

  const to = sanitizeCardPlainText(input.recipientName || "").slice(0, 80);
  const from = sanitizeCardPlainText(input.fromName || "").slice(0, 80);
  let footer = "";
  if (to && from) footer = `To ${to} · From ${from}`;
  else if (to) footer = `To ${to}`;
  else if (from) footer = `From ${from}`;
  if (footer) {
    ctx.fillStyle = style.muted || style.accent;
    ctx.font = `500 ${Math.max(20, Math.round(fontSize * 0.45))}px Georgia, serif`;
    ctx.fillText(footer, layout.width / 2, panelY + panelH - 36, maxTextW);
  }

  ctx.fillStyle = style.accent;
  ctx.font = `500 ${Math.max(16, Math.round(layout.width * 0.018))}px system-ui, sans-serif`;
  ctx.fillText("The Digital Gifter", layout.width / 2, layout.height - pad - 18);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("png_encode_failed"))), "image/png");
  });
  const filename = cardDownloadFilename(input.projectRef || "draft", layout.key);
  return {
    blob,
    width: layout.width,
    height: layout.height,
    dataUrl: canvas.toDataURL("image/png"),
    byteSize: blob.size,
    filename,
  };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function downloadCardBlob(blob: Blob, projectId: string, layoutKey: string) {
  downloadBlob(blob, cardDownloadFilename(projectId, layoutKey));
}

export async function shareCardFile(blob: Blob, filename: string): Promise<"shared" | "downloaded"> {
  const file = new File([blob], filename, { type: "image/png" });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: "Christmas Card" });
      return "shared";
    }
  } catch {
    /* fall through */
  }
  downloadBlob(blob, filename);
  return "downloaded";
}

export const shareCardBlob = shareCardFile;

export async function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  const check = validatePhotoFile(file);
  if (!check.ok) throw new Error(check.error);
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not decode photo."));
      el.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
