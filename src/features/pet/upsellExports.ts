import { downloadFromUrl } from "./shareDownload";
import { printPackEligibility, PRINT_DPI } from "./upsells";

type LoadImageResult = {
  image: HTMLImageElement;
  width: number;
  height: number;
};

async function loadImage(url: string): Promise<LoadImageResult> {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Could not load portrait");
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const image = new Image();
  image.decoding = "async";
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Could not load portrait"));
      image.src = objectUrl;
    });
    return { image, width: image.naturalWidth, height: image.naturalHeight };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type = "image/jpeg", quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Export failed"))),
      type,
      quality,
    );
  });
}

function triggerBlobDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const drawW = image.naturalWidth * scale;
  const drawH = image.naturalHeight * scale;
  const dx = x + (width - drawW) / 2;
  const dy = y + (height - drawH) / 2;
  ctx.drawImage(image, dx, dy, drawW, drawH);
}

function drawContain(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const drawW = image.naturalWidth * scale;
  const drawH = image.naturalHeight * scale;
  const dx = x + (width - drawW) / 2;
  const dy = y + (height - drawH) / 2;
  ctx.drawImage(image, dx, dy, drawW, drawH);
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function exportGiftPack(input: {
  imageUrl: string;
  petName: string;
  sceneTitle: string;
}) {
  const { image, width, height } = await loadImage(input.imageUrl);
  const base = slug(`${input.petName}-${input.sceneTitle}`);
  const exports = [
    { name: `${base}-wallpaper.jpg`, w: 1080, h: 1920, mode: "cover" as const },
    { name: `${base}-instagram-square.jpg`, w: 1080, h: 1080, mode: "cover" as const },
    { name: `${base}-instagram-story.jpg`, w: 1080, h: 1920, mode: "cover" as const },
    { name: `${base}-share-card.jpg`, w: 1200, h: 630, mode: "cover" as const },
  ];

  for (const item of exports) {
    const canvas = document.createElement("canvas");
    canvas.width = item.w;
    canvas.height = item.h;
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    ctx.fillStyle = "#120f0c";
    ctx.fillRect(0, 0, item.w, item.h);
    if (item.mode === "cover") drawCover(ctx, image, 0, 0, item.w, item.h);
    else drawContain(ctx, image, 0, 0, item.w, item.h);
    if (item.name.includes("share-card")) {
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(0, item.h - 120, item.w, 120);
      ctx.fillStyle = "#f6efe4";
      ctx.font = "bold 42px Georgia, serif";
      ctx.fillText(input.petName, 48, item.h - 52);
      ctx.font = "24px system-ui, sans-serif";
      ctx.fillText(input.sceneTitle, 48, item.h - 18);
    }
    const blob = await canvasToBlob(canvas);
    triggerBlobDownload(blob, item.name);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  return { width, height };
}

export async function exportHolidayCard(input: {
  imageUrl: string;
  petName: string;
  sceneTitle: string;
}) {
  const { image } = await loadImage(input.imageUrl);
  const w = 1050;
  const h = 1500;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");

  const gradient = ctx.createLinearGradient(0, 0, w, h);
  gradient.addColorStop(0, "#1a3d2f");
  gradient.addColorStop(0.5, "#0f2419");
  gradient.addColorStop(1, "#2d1f12");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = "#d4af37";
  ctx.lineWidth = 10;
  ctx.strokeRect(36, 36, w - 72, h - 72);

  ctx.fillStyle = "#f6efe4";
  ctx.font = "bold 56px Georgia, serif";
  ctx.textAlign = "center";
  ctx.fillText("Happy Holidays", w / 2, 120);
  ctx.font = "28px system-ui, sans-serif";
  ctx.fillText(`from ${input.petName}`, w / 2, 170);

  const frameX = 90;
  const frameY = 220;
  const frameW = w - 180;
  const frameH = 980;
  ctx.fillStyle = "#f6efe4";
  ctx.fillRect(frameX - 8, frameY - 8, frameW + 16, frameH + 16);
  drawCover(ctx, image, frameX, frameY, frameW, frameH);

  ctx.fillStyle = "#f6efe4";
  ctx.font = "italic 34px Georgia, serif";
  ctx.fillText(input.sceneTitle, w / 2, 1260);
  ctx.font = "22px system-ui, sans-serif";
  ctx.fillStyle = "rgba(246,239,228,0.75)";
  ctx.fillText("My Pet’s Secret Life", w / 2, 1310);

  const ornaments = ["✦", "❄", "✦"];
  ctx.font = "32px serif";
  ornaments.forEach((mark, index) => {
    ctx.fillText(mark, w / 2 + (index - 1) * 80, 1380);
  });

  const blob = await canvasToBlob(canvas);
  triggerBlobDownload(blob, `${slug(input.petName)}-${slug(input.sceneTitle)}-holiday-card.jpg`);
}

export async function exportPrintPack(input: {
  imageUrl: string;
  petName: string;
  sceneTitle: string;
  width: number | null;
  height: number | null;
}) {
  const eligibility = printPackEligibility(input.width, input.height);
  if (!eligibility.eligible || !eligibility.maxWidthInches || !eligibility.maxHeightInches) {
    throw new Error(eligibility.reason || "Portrait is not large enough to print.");
  }

  const { image } = await loadImage(input.imageUrl);
  const printW = Math.round(eligibility.maxWidthInches * PRINT_DPI);
  const printH = Math.round(eligibility.maxHeightInches * PRINT_DPI);
  const bleed = 24;
  const canvas = document.createElement("canvas");
  canvas.width = printW + bleed * 2;
  canvas.height = printH + bleed * 2;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawCover(ctx, image, bleed, bleed, printW, printH);

  ctx.strokeStyle = "#cccccc";
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 8]);
  ctx.strokeRect(bleed, bleed, printW, printH);
  ctx.setLineDash([]);

  ctx.fillStyle = "#333333";
  ctx.font = "18px system-ui, sans-serif";
  ctx.fillText(
    `${eligibility.maxSizeLabel} @ ${PRINT_DPI} DPI · ${printW}×${printH}px`,
    bleed,
    canvas.height - 16,
  );

  const blob = await canvasToBlob(canvas, "image/jpeg", 0.95);
  triggerBlobDownload(
    blob,
    `${slug(input.petName)}-${slug(input.sceneTitle)}-print-${eligibility.maxSizeLabel?.replace(/[^\d×]+/g, "")}.jpg`,
  );
}

export async function downloadUpsellExport(input: {
  upsellKey: "gift_pack" | "holiday_card" | "print_pack";
  imageUrl: string;
  petName: string;
  sceneTitle: string;
  width?: number | null;
  height?: number | null;
}) {
  if (input.upsellKey === "gift_pack") {
    await exportGiftPack(input);
    return;
  }
  if (input.upsellKey === "holiday_card") {
    await exportHolidayCard(input);
    return;
  }
  await exportPrintPack({
    ...input,
    width: input.width ?? null,
    height: input.height ?? null,
  });
}

export { downloadFromUrl };
