/** QA-safe recipient allowlist — fail closed when empty. */

export function parseSendAGiftEmailAllowlist(raw: string | undefined | null): string[] {
  return String(raw ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isSendAGiftEmailRecipientAllowed(
  email: string,
  allowlistRaw: string | undefined | null,
): boolean {
  const normalized = String(email ?? "").trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) return false;
  const list = parseSendAGiftEmailAllowlist(allowlistRaw);
  if (!list.length) return false;
  const domain = normalized.split("@")[1] || "";
  return list.some((entry) => entry === normalized || entry === domain || entry === `@${domain}`);
}
