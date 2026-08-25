export { watermarkPreviewDataUrl } from "../pet-v2/watermark";

/** Honest mock: visitor's own cat photo with royal-styled framing when live generation is off. */
export async function buildMockRoyalCatPreview(source: string): Promise<string> {
  const { watermarkPreviewDataUrl } = await import("../pet-v2/watermark");
  const image = await loadImage(source);
  const width = 768;
  const height = Math.round((image.height / image.width) * width) || 960;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return source;

  const inset = 28;
  ctx.fillStyle = "#1a0f0a";
  ctx.fillRect(0, 0, width, height);
  const g = ctx.createLinearGradient(0, 0, width, height);
  g.addColorStop(0, "#2a1018");
  g.addColorStop(0.5, "#6b1a2a");
  g.addColorStop(1, "#c9a227");
  ctx.fillStyle = g;
  ctx.fillRect(10, 10, width - 20, height - 20);
  ctx.fillStyle = "#140e0a";
  ctx.fillRect(inset, inset, width - inset * 2, height - inset * 2);
  ctx.drawImage(image, inset + 6, inset + 6, width - inset * 2 - 12, height - inset * 2 - 12);

  ctx.fillStyle = "rgba(20, 14, 10, 0.62)";
  ctx.fillRect(0, 0, width, 54);
  ctx.fillStyle = "#f3e6c0";
  ctx.font = "600 18px Georgia, serif";
  ctx.textAlign = "center";
  ctx.fillText("Royal ruler · preview unavailable", width / 2, 34);

  return watermarkPreviewDataUrl(canvas.toDataURL("image/jpeg", 0.8));
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not read that photo."));
    image.src = src;
  });
}
