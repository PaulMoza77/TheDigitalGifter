const EMAIL_RE = /^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/i;

export function normalizeClubEmail(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase();
}

export function isValidClubEmail(value: unknown): boolean {
  const email = normalizeClubEmail(value);
  if (!email) return false;
  if (email.length < 5 || email.length > 254) return false;
  if (email.includes("..")) return false;
  if (email.startsWith(".") || email.endsWith(".")) return false;
  if (email.includes(" ")) return false;
  const [local, domain] = email.split("@");
  if (!local || !domain) return false;
  if (local.length > 64) return false;
  if (!domain.includes(".")) return false;
  return EMAIL_RE.test(email);
}

export function clubEmailValidationMessage(value: unknown): string | null {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "Please enter your email.";
  if (!isValidClubEmail(raw)) return "Please enter a valid email.";
  return null;
}
