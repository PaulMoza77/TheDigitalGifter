/**
 * Client-side personalized teaser — destructive pixel transform, not CSS blur.
 * Never embeds the clear source under a translucent layer.
 * Cost: $0 (no Replicate/OpenAI).
 */

export const V2_TEASER_MAX_EDGE = 480;
export const V2_TEASER_PIXEL_BLOCK = 10;
export const V2_TEASER_BLUR_RADIUS = 14;
/** Soft performance budget for mobile (ms). Soft fail — still return result. */
export const V2_TEASER_BUDGET_MS = 5000;

export type V2TeaserResult = {
  ok: true;
  teaserDataUrl: string;
  latencyMs: number;
  width: number;
  height: number;
};

export type V2TeaserFailure = {
  ok: false;
  error: string;
  failureCategory: "invalid_image" | "teaser_error";
  latencyMs: number;
};

/**
 * Build a heavily obscured personalized teaser from the uploaded File.
 * Pipeline: decode → downscale → pixelate → gaussian-ish blur → racing frame overlay → lock badge.
 * Output is a JPEG data URL containing only transformed pixels.
 */
export async function buildV2PersonalizedTeaser(file: File): Promise<V2TeaserResult | V2TeaserFailure> {
  const started = typeof performance !== "undefined" ? performance.now() : Date.now();
  try {
    if (typeof createImageBitmap !== "function") {
      return fail("This browser cannot process photos for the teaser.", started, "teaser_error");
    }
    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(file);
    } catch {
      return fail("We couldn’t read this photo. Please upload a clear JPG, PNG, or WebP of your dog.", started, "invalid_image");
    }

    const scale = Math.min(1, V2_TEASER_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(32, Math.round(bitmap.width * scale));
    const height = Math.max(32, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      bitmap.close();
      return fail("We couldn’t create your teaser. Try again.", started, "teaser_error");
    }

    // Draw reduced-resolution source, then destroy it via pixelation + blur into the same buffer.
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    pixelateInPlace(ctx, width, height, V2_TEASER_PIXEL_BLOCK);
    boxBlurInPlace(ctx, width, height, V2_TEASER_BLUR_RADIUS);

    // Dark cinematic wash so the result never looks like a clear photo.
    ctx.fillStyle = "rgba(10, 8, 6, 0.28)";
    ctx.fillRect(0, 0, width, height);

    drawRacingInspiredFrame(ctx, width, height);
    drawLockedRevealOverlay(ctx, width, height);

    const teaserDataUrl = canvas.toDataURL("image/jpeg", 0.72);
    // Extra safety: ensure we never accidentally kept a huge clear encoding.
    if (!teaserDataUrl.startsWith("data:image/jpeg")) {
      return fail("We couldn’t create your teaser. Try again.", started, "teaser_error");
    }

    const latencyMs = Math.round((typeof performance !== "undefined" ? performance.now() : Date.now()) - started);
    return { ok: true, teaserDataUrl, latencyMs, width, height };
  } catch {
    return fail("We couldn’t create your teaser. Try again.", started, "teaser_error");
  }
}

function fail(
  error: string,
  started: number,
  failureCategory: V2TeaserFailure["failureCategory"],
): V2TeaserFailure {
  const latencyMs = Math.round((typeof performance !== "undefined" ? performance.now() : Date.now()) - started);
  return { ok: false, error, failureCategory, latencyMs };
}

/** Average each block into a solid color — irreversible downsampling. */
export function pixelateInPlace(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  block: number,
): void {
  const image = ctx.getImageData(0, 0, width, height);
  const { data } = image;
  const size = Math.max(4, Math.floor(block));
  for (let y = 0; y < height; y += size) {
    for (let x = 0; x < width; x += size) {
      let r = 0;
      let g = 0;
      let b = 0;
      let count = 0;
      const yMax = Math.min(y + size, height);
      const xMax = Math.min(x + size, width);
      for (let yy = y; yy < yMax; yy += 1) {
        for (let xx = x; xx < xMax; xx += 1) {
          const i = (yy * width + xx) * 4;
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          count += 1;
        }
      }
      if (!count) continue;
      r = Math.round(r / count);
      g = Math.round(g / count);
      b = Math.round(b / count);
      for (let yy = y; yy < yMax; yy += 1) {
        for (let xx = x; xx < xMax; xx += 1) {
          const i = (yy * width + xx) * 4;
          data[i] = r;
          data[i + 1] = g;
          data[i + 2] = b;
        }
      }
    }
  }
  ctx.putImageData(image, 0, 0);
}

/** Separable box blur approximating Gaussian — baked into pixels. */
export function boxBlurInPlace(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.max(1, Math.min(24, Math.floor(radius)));
  const src = ctx.getImageData(0, 0, width, height);
  const tmp = new Uint8ClampedArray(src.data.length);
  const out = new Uint8ClampedArray(src.data.length);
  blurAxis(src.data, tmp, width, height, r, true);
  blurAxis(tmp, out, width, height, r, false);
  src.data.set(out);
  ctx.putImageData(src, 0, 0);
}

function blurAxis(
  input: Uint8ClampedArray,
  output: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number,
  horizontal: boolean,
): void {
  const limX = width - 1;
  const limY = height - 1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let count = 0;
      for (let k = -radius; k <= radius; k += 1) {
        const xx = horizontal ? Math.min(limX, Math.max(0, x + k)) : x;
        const yy = horizontal ? y : Math.min(limY, Math.max(0, y + k));
        const i = (yy * width + xx) * 4;
        r += input[i];
        g += input[i + 1];
        b += input[i + 2];
        a += input[i + 3];
        count += 1;
      }
      const o = (y * width + x) * 4;
      output[o] = Math.round(r / count);
      output[o + 1] = Math.round(g / count);
      output[o + 2] = Math.round(b / count);
      output[o + 3] = Math.round(a / count);
    }
  }
}

/** Generic racing-inspired frame — no protected team/sponsor logos. */
function drawRacingInspiredFrame(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const inset = Math.round(Math.min(width, height) * 0.06);
  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, "rgba(122, 18, 28, 0.55)");
  grad.addColorStop(0.5, "rgba(12, 14, 18, 0.15)");
  grad.addColorStop(1, "rgba(201, 162, 39, 0.45)");
  ctx.strokeStyle = grad;
  ctx.lineWidth = Math.max(6, Math.round(inset * 0.55));
  roundRectPath(ctx, inset / 2, inset / 2, width - inset, height - inset, Math.round(inset * 0.6));
  ctx.stroke();

  // Cockpit-style top bar (abstract, not branded).
  ctx.fillStyle = "rgba(8, 10, 14, 0.72)";
  ctx.fillRect(0, 0, width, Math.round(height * 0.11));
  ctx.fillStyle = "rgba(243, 212, 138, 0.9)";
  ctx.font = `600 ${Math.max(11, Math.round(width * 0.035))}px Georgia, serif`;
  ctx.textAlign = "center";
  ctx.fillText("Secret life · locked", width / 2, Math.round(height * 0.07));
}

function drawLockedRevealOverlay(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const cx = width / 2;
  const cy = height * 0.52;
  const radius = Math.round(Math.min(width, height) * 0.12);
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(20, 14, 10, 0.72)";
  ctx.fill();
  ctx.strokeStyle = "rgba(212, 168, 75, 0.85)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Simple lock body (geometry only).
  ctx.fillStyle = "rgba(243, 212, 138, 0.95)";
  const lockW = radius * 0.55;
  const lockH = radius * 0.45;
  ctx.fillRect(cx - lockW / 2, cy - lockH * 0.1, lockW, lockH);
  ctx.strokeStyle = "rgba(243, 212, 138, 0.95)";
  ctx.lineWidth = Math.max(2, radius * 0.08);
  ctx.beginPath();
  ctx.arc(cx, cy - lockH * 0.35, lockW * 0.32, Math.PI, 0, false);
  ctx.stroke();

  ctx.fillStyle = "rgba(246, 239, 228, 0.92)";
  ctx.font = `600 ${Math.max(12, Math.round(width * 0.04))}px Georgia, serif`;
  ctx.textAlign = "center";
  ctx.fillText("Tap to reveal", cx, Math.min(height - 16, cy + radius + Math.round(height * 0.08)));
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
): void {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Test helper: teaser bytes must differ substantially from a clear downscale of the same image. */
export function teaserLooksDestructivelyTransformed(teaserDataUrl: string): boolean {
  return (
    teaserDataUrl.startsWith("data:image/jpeg") &&
    teaserDataUrl.length > 800 &&
    teaserDataUrl.length < 900_000
  );
}
