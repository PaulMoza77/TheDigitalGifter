import { createHash } from "node:crypto";

export function normalizeConceptText(value: string): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function dedupeKey(input: { conceptFamily: string; concept: string; hook: string }): string {
  const family = normalizeConceptText(input.conceptFamily);
  const concept = normalizeConceptText(input.concept);
  const hook = normalizeConceptText(input.hook);
  const raw = `${family}|${concept}|${hook}`;
  return createHash("sha256").update(raw).digest("hex").slice(0, 32);
}

export function isNearDuplicate(existing: string[], candidate: string): boolean {
  const normalized = normalizeConceptText(candidate);
  if (!normalized) return true;
  for (const item of existing) {
    const other = normalizeConceptText(item);
    if (!other) continue;
    if (other === normalized) return true;
    if (other.includes(normalized) || normalized.includes(other)) {
      const shorter = Math.min(other.length, normalized.length);
      const longer = Math.max(other.length, normalized.length);
      if (shorter / Math.max(longer, 1) > 0.85) return true;
    }
  }
  return false;
}
