/** Safe decode / integrity checks for free-preview source images. Never log raw bytes. */

export type DecodedPreviewImage = {
  mime: string;
  byteLength: number;
  widthHint: number | null;
  heightHint: number | null;
  magic: "jpeg" | "png" | "webp" | "unknown";
};

export type ImageDecodeResult =
  | { ok: true; image: DecodedPreviewImage }
  | { ok: false; errorCode: "invalid_photo" | "heic_unsupported"; error: string };

const MAX_DATA_URL_CHARS = 2_500_000;
const MIN_BYTES = 2_048;
/** Hard ceiling after base64 decode — keeps provider payload bounded. */
const MAX_BYTES = 4_500_000;

export function maxPreviewDataUrlChars(): number {
  return MAX_DATA_URL_CHARS;
}

export function decodePreviewDataUrl(imageDataUrl: string): ImageDecodeResult {
  if (!imageDataUrl.startsWith("data:image/") || imageDataUrl.length > MAX_DATA_URL_CHARS) {
    return {
      ok: false,
      errorCode: "invalid_photo",
      error: "That photo could not be used. Try a smaller JPEG, PNG, or WebP.",
    };
  }
  if (/image\/heic|image\/heif/i.test(imageDataUrl)) {
    return {
      ok: false,
      errorCode: "heic_unsupported",
      error:
        "iPhone HEIC photos aren’t supported yet. Set Camera Formats to Most Compatible, or export as JPEG.",
    };
  }

  const comma = imageDataUrl.indexOf(",");
  if (comma < 0) {
    return {
      ok: false,
      errorCode: "invalid_photo",
      error: "That photo could not be used. Try a smaller JPEG, PNG, or WebP.",
    };
  }
  const header = imageDataUrl.slice(0, comma);
  const payload = imageDataUrl.slice(comma + 1);
  if (!/;base64/i.test(header) || payload.length < 32) {
    return {
      ok: false,
      errorCode: "invalid_photo",
      error: "That photo could not be used. Try a smaller JPEG, PNG, or WebP.",
    };
  }

  let bytes: Uint8Array;
  try {
    const binary = atob(payload);
    bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  } catch {
    return {
      ok: false,
      errorCode: "invalid_photo",
      error: "That photo could not be decoded. Try exporting as JPEG and upload again.",
    };
  }

  if (bytes.byteLength < MIN_BYTES || bytes.byteLength > MAX_BYTES) {
    return {
      ok: false,
      errorCode: "invalid_photo",
      error: "That photo could not be used. Try a clearer JPEG, PNG, or WebP under 15 MB.",
    };
  }

  const magic = detectMagic(bytes);
  if (magic === "unknown") {
    return {
      ok: false,
      errorCode: "invalid_photo",
      error: "That photo could not be used. Try a smaller JPEG, PNG, or WebP.",
    };
  }

  const mimeMatch = /data:(image\/[a-z0-9.+-]+)/i.exec(header);
  const mime = (mimeMatch?.[1] || `image/${magic}`).toLowerCase();

  return {
    ok: true,
    image: {
      mime,
      byteLength: bytes.byteLength,
      widthHint: null,
      heightHint: null,
      magic,
    },
  };
}

function detectMagic(bytes: Uint8Array): DecodedPreviewImage["magic"] {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "png";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "webp";
  }
  return "unknown";
}

/** Structured diagnostics only — never includes image bytes, full URLs, or secrets. */
export function previewDiag(fields: Record<string, unknown>): void {
  try {
    console.info(
      JSON.stringify({
        event: "pet_preview_diag",
        ts: new Date().toISOString(),
        ...fields,
      }),
    );
  } catch {
    /* ignore logging failures */
  }
}
