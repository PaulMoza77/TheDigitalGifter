const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXT = ["jpg", "jpeg", "png", "webp"] as const;
const JPEG = [0xff, 0xd8, 0xff];
const PNG = [0x89, 0x50, 0x4e, 0x47];
const WEBP_RIFF = [0x52, 0x49, 0x46, 0x46];

export type ImageValidationOk = {
  ok: true;
  mime: "image/jpeg" | "image/png" | "image/webp";
  ext: "jpg" | "png" | "webp";
};

export type ImageValidationErr = {
  ok: false;
  error: string;
};

export type ImageValidationResult = ImageValidationOk | ImageValidationErr;

function bytesMatch(header: Uint8Array, sig: number[], offset = 0): boolean {
  if (header.length < offset + sig.length) return false;
  return sig.every((value, index) => header[offset + index] === value);
}

export function detectImageMime(header: Uint8Array): ImageValidationOk["mime"] | null {
  if (bytesMatch(header, JPEG)) return "image/jpeg";
  if (bytesMatch(header, PNG)) return "image/png";
  if (
    bytesMatch(header, WEBP_RIFF) &&
    header.length >= 12 &&
    header[8] === 0x57 &&
    header[9] === 0x45 &&
    header[10] === 0x42 &&
    header[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

export function extensionForMime(mime: ImageValidationOk["mime"]): ImageValidationOk["ext"] {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  return "webp";
}

export function validateImageUpload(args: {
  fileName: string;
  reportedMime: string;
  sizeBytes: number;
  headerBytes: Uint8Array;
}): ImageValidationResult {
  if (args.sizeBytes <= 0) {
    return { ok: false, error: "The file is empty." };
  }

  if (args.sizeBytes > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      error: `Image is too large. Please upload a file under ${Math.floor(
        MAX_UPLOAD_BYTES / (1024 * 1024),
      )} MB.`,
    };
  }

  const detected = detectImageMime(args.headerBytes);
  if (!detected) {
    return {
      ok: false,
      error: "Please upload a real JPG, PNG, or WebP image.",
    };
  }

  const ext = String(args.fileName.split(".").pop() || "").toLowerCase();
  const allowedExt = ALLOWED_EXT as readonly string[];
  if (ext && !allowedExt.includes(ext)) {
    return {
      ok: false,
      error: "File extension must be .jpg, .jpeg, .png, or .webp.",
    };
  }

  const reported = String(args.reportedMime || "").toLowerCase();
  if (reported && reported !== "application/octet-stream" && reported !== detected) {
    if (!(detected === "image/jpeg" && (reported === "image/jpg" || reported === "image/jpeg"))) {
      return {
        ok: false,
        error: "The file type does not match the image contents.",
      };
    }
  }

  return { ok: true, mime: detected, ext: extensionForMime(detected) };
}
