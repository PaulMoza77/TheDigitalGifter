/** Client-side watermark so the visitor never holds an unmarked HD file. */
export async function watermarkPreviewDataUrl(
  source: string,
  label = "PREVIEW",
): Promise<string> {
  const image = await loadImage(source);
  const maxEdge = 900;
  const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return source;
  ctx.drawImage(image, 0, 0, width, height);

  ctx.fillStyle = "rgba(20, 14, 10, 0.38)";
  ctx.fillRect(0, height - Math.round(height * 0.12), width, Math.round(height * 0.12));
  ctx.fillStyle = "rgba(246, 239, 228, 0.92)";
  ctx.font = `600 ${Math.max(14, Math.round(width * 0.045))}px Georgia, serif`;
  ctx.textAlign = "center";
  ctx.fillText("My Pet’s Secret Life · preview", width / 2, height - Math.round(height * 0.045));

  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.rotate(-Math.PI / 5);
  ctx.fillStyle = "rgba(246, 239, 228, 0.22)";
  ctx.font = `700 ${Math.max(28, Math.round(width * 0.12))}px Georgia, serif`;
  ctx.fillText(label, 0, 0);
  ctx.restore();

  return canvas.toDataURL("image/jpeg", 0.72);
}

/** Honest mock: visitor's own photo with F1-styled framing when live generation is off. */
export async function buildMockF1Preview(source: string): Promise<string> {
  const image = await loadImage(source);
  const width = 768;
  const height = Math.round((image.height / image.width) * width) || 960;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return source;

  const inset = 28;
  ctx.fillStyle = "#0b0f12";
  ctx.fillRect(0, 0, width, height);
  const g = ctx.createLinearGradient(0, 0, width, height);
  g.addColorStop(0, "#1a0b10");
  g.addColorStop(0.55, "#7a121c");
  g.addColorStop(1, "#c9a227");
  ctx.fillStyle = g;
  ctx.fillRect(10, 10, width - 20, height - 20);
  ctx.fillStyle = "#0b0f12";
  ctx.fillRect(inset, inset, width - inset * 2, height - inset * 2);
  ctx.drawImage(image, inset + 6, inset + 6, width - inset * 2 - 12, height - inset * 2 - 12);

  ctx.fillStyle = "rgba(11, 15, 18, 0.62)";
  ctx.fillRect(0, 0, width, 54);
  ctx.fillStyle = "#f3e6c0";
  ctx.font = "600 18px Georgia, serif";
  ctx.textAlign = "center";
  ctx.fillText("F1 driver · preview unavailable", width / 2, 34);

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
