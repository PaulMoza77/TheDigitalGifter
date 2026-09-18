async function socialTokenKey(): Promise<CryptoKey> {
  const secret = (
    Deno.env.get("SOCIAL_TOKEN_ENCRYPTION_KEY") ||
    Deno.env.get("PET_TOKEN_ENCRYPTION_KEY") ||
    ""
  ).trim();
  if (secret.length < 32) {
    throw new Error("SOCIAL_TOKEN_ENCRYPTION_KEY or PET_TOKEN_ENCRYPTION_KEY is required");
  }
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", hash, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptSecret(token: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await socialTokenKey();
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(token));
  const packed = new Uint8Array(iv.length + encrypted.byteLength);
  packed.set(iv, 0);
  packed.set(new Uint8Array(encrypted), iv.length);
  let binary = "";
  for (const b of packed) binary += String.fromCharCode(b);
  return btoa(binary);
}

export async function decryptSecret(ciphertext: string | null | undefined): Promise<string | null> {
  if (!ciphertext) return null;
  const key = await socialTokenKey();
  try {
    const binary = atob(ciphertext);
    const packed = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) packed[i] = binary.charCodeAt(i);
    const iv = packed.slice(0, 12);
    const data = packed.slice(12);
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
    return new TextDecoder().decode(decrypted);
  } catch {
    return null;
  }
}
