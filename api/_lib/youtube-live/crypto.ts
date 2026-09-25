import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function socialTokenKey(): Buffer {
  const secret = String(process.env.SOCIAL_TOKEN_ENCRYPTION_KEY || process.env.PET_TOKEN_ENCRYPTION_KEY || "").trim();
  if (secret.length < 32) {
    throw new Error("SOCIAL_TOKEN_ENCRYPTION_KEY or PET_TOKEN_ENCRYPTION_KEY is required");
  }
  return createHash("sha256").update(secret).digest();
}

/** AES-256-GCM compatible with the Edge social token packing: iv || ciphertext || tag, base64. */
export function encryptLiveSecret(token: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", socialTokenKey(), iv);
  const enc = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const packed = Buffer.concat([iv, enc, cipher.getAuthTag()]);
  return packed.toString("base64");
}

export function decryptLiveSecret(ciphertext: string | null | undefined): string | null {
  if (!ciphertext) return null;
  try {
    const packed = Buffer.from(ciphertext, "base64");
    const iv = packed.subarray(0, 12);
    const tag = packed.subarray(packed.length - 16);
    const data = packed.subarray(12, packed.length - 16);
    const decipher = createDecipheriv("aes-256-gcm", socialTokenKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
