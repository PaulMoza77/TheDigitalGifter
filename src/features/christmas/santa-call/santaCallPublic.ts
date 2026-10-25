/**
 * Santa Call commercial landing release gate.
 * Route exists in code; public Meta Ads activation stays off until explicit approval.
 *
 * Server sales remain gated by CHRISTMAS_LIVE_PRODUCTS (must not include santa until launch).
 * Client landing visibility:
 *   - VITE_SANTA_CALL_LANDING_PUBLIC=true → full landing (QA overlay builds only until launch)
 *   - ?preview=<token> matching VITE_SANTA_CALL_PREVIEW_TOKEN (min 16 chars) → authorized preview
 *   - otherwise → soft gate page (noindex, no checkout)
 *
 * Bare ?preview=1 / localStorage is NOT auth and is rejected.
 */

export function isSantaCallLandingPublic(): boolean {
  const raw = String(import.meta.env.VITE_SANTA_CALL_LANDING_PUBLIC || "")
    .trim()
    .toLowerCase();
  return raw === "true" || raw === "1" || raw === "on";
}

function previewTokenConfigured(): string {
  return String(import.meta.env.VITE_SANTA_CALL_PREVIEW_TOKEN || "").trim();
}

export function isSantaCallLandingPreviewAllowed(search = ""): boolean {
  if (isSantaCallLandingPublic()) return true;
  const expected = previewTokenConfigured();
  if (expected.length < 16) return false;
  try {
    const q = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
    const got = String(q.get("preview") || "").trim();
    return got.length === expected.length && got === expected;
  } catch {
    return false;
  }
}
