export type ImageProbe = {
  width: number;
  height: number;
  format: "jpeg" | "png" | "webp" | "unknown";
};

export type ClipProbe = {
  durationSeconds: number;
  width: number;
  height: number;
  readable: true;
};

export type ClipSpecCheck = {
  ok: boolean;
  notes: string[];
  durationSeconds: number;
  width: number;
  height: number;
  aspectOk: boolean;
  resolutionOk: boolean;
  durationOk: boolean;
};

const ASPECT = 9 / 16;
const ASPECT_TOLERANCE = 0.03;

export function isFtypMp4(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 12) return false;
  const brand = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]);
  if (brand !== "ftyp") return false;
  return true;
}

export function aspectIsNineSixteen(width: number, height: number, tolerance = ASPECT_TOLERANCE): boolean {
  if (!width || !height) return false;
  const ratio = width / height;
  return Math.abs(ratio - ASPECT) <= tolerance;
}

export function evaluateClipSpec(input: {
  durationSeconds: number;
  width: number;
  height: number;
  requestedDurationSeconds?: number;
  requestedWidth?: number;
  requestedHeight?: number;
}): ClipSpecCheck {
  const requestedDuration = input.requestedDurationSeconds ?? 5;
  const requestedWidth = input.requestedWidth ?? 1080;
  const requestedHeight = input.requestedHeight ?? 1920;
  const notes: string[] = [];
  const durationOk = Math.abs(input.durationSeconds - requestedDuration) <= 1.25;
  const aspectOk = aspectIsNineSixteen(input.width, input.height);
  const resolutionOk = input.width === requestedWidth && input.height === requestedHeight;
  if (!durationOk) {
    notes.push(
      `Duration ${input.durationSeconds.toFixed(2)}s does not match requested ${requestedDuration}s (±1.25s). Original file kept; no paid regenerate.`,
    );
  }
  if (!aspectOk) {
    notes.push(
      `Aspect ${input.width}×${input.height} is not 9:16. Original file kept; no paid regenerate.`,
    );
  }
  if (!resolutionOk) {
    notes.push(
      `Effective ${input.width}×${input.height} is not requested ${requestedWidth}×${requestedHeight}. Original file kept; no paid regenerate.`,
    );
  }
  return {
    ok: durationOk && aspectOk && resolutionOk,
    notes,
    durationSeconds: input.durationSeconds,
    width: input.width,
    height: input.height,
    aspectOk,
    resolutionOk,
    durationOk,
  };
}

export function evaluateSourcePhoto(input: { width: number; height: number }): { ok: boolean; notes: string[] } {
  const notes: string[] = [];
  const aspectOk = aspectIsNineSixteen(input.width, input.height);
  const sizeOk = input.width >= 1080 && input.height >= 1920;
  if (!aspectOk) notes.push(`Source photo ${input.width}×${input.height} is not 9:16.`);
  if (!sizeOk) {
    notes.push(
      `Source photo ${input.width}×${input.height} is below 1080×1920. Paid submit stays blocked so 1080p is not silently replaced.`,
    );
  }
  return { ok: aspectOk && sizeOk, notes };
}

function u16(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function u32(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}

export function probeImageBuffer(bytes: Uint8Array): ImageProbe {
  if (bytes.length >= 24 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { format: "png", width: u32(bytes, 16), height: u32(bytes, 20) };
  }
  if (bytes.length >= 30 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 8 < bytes.length) {
      if (bytes[offset] !== 0xff) break;
      const marker = bytes[offset + 1];
      const size = u16(bytes, offset + 2);
      if (marker >= 0xc0 && marker <= 0xc3) {
        return { format: "jpeg", height: u16(bytes, offset + 5), width: u16(bytes, offset + 7) };
      }
      offset += 2 + size;
    }
  }
  if (bytes.length >= 30 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") {
    const chunk = String.fromCharCode(...bytes.slice(12, 16));
    if (chunk === "VP8X" && bytes.length >= 30) {
      const width = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16);
      const height = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16);
      return { format: "webp", width, height };
    }
    if (chunk === "VP8 " && bytes.length >= 30) {
      const width = bytes[26] | ((bytes[27] & 0x3f) << 8);
      const height = bytes[28] | ((bytes[29] & 0x3f) << 8);
      return { format: "webp", width, height };
    }
    if (chunk === "VP8L" && bytes.length >= 25) {
      const bits = bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24);
      return { format: "webp", width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
  }
  throw new Error("Unsupported or unreadable image. JPEG, PNG, or WebP required.");
}
