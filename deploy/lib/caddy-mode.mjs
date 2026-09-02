/**
 * Decide which Caddyfile source deploy should install.
 * Never downgrades an active HTTPS TDG site to the HTTP-only file.
 */

/**
 * @param {string} activeCaddyfile
 * @param {string | null | undefined} modeMarker  "http" | "https" | empty
 * @returns {"http" | "https"}
 */
export function detectTdgCaddyMode(activeCaddyfile, modeMarker) {
  const text = String(activeCaddyfile || "");
  const marker = String(modeMarker || "").trim().toLowerCase();
  if (marker === "https" || marker === "http") return marker;

  // Named site block (HTTPS-capable) — not only Host matchers inside :80.
  const namedTdgSite =
    /^\s*thedigitalgifter\.com,\s*www\.thedigitalgifter\.com\s*\{/m.test(text) ||
    /^\s*www\.thedigitalgifter\.com,\s*thedigitalgifter\.com\s*\{/m.test(text);
  const hasHsts = /Strict-Transport-Security/i.test(text);
  if (namedTdgSite && hasHsts) return "https";
  if (namedTdgSite) return "https";
  return "http";
}

/**
 * @param {"http" | "https"} mode
 * @returns {string} repo-relative path under deploy/caddy/
 */
export function caddySourceFileForMode(mode) {
  return mode === "https" ? "Caddyfile.https.ready" : "Caddyfile.http";
}

/**
 * @param {string} candidateContent
 * @param {"http" | "https"} mode
 */
export function assertCaddyContentMatchesMode(candidateContent, mode) {
  const text = String(candidateContent || "");
  if (!text.includes("themozas:8080")) {
    throw new Error("Caddyfile must keep TheMozas upstream");
  }
  if (!text.includes("tdg-verify.mozas-prod-01")) {
    throw new Error("Caddyfile must keep TDG verify host");
  }
  if (!text.includes("thedigitalgifter.com")) {
    throw new Error("Caddyfile must include thedigitalgifter.com");
  }
  if (mode === "https") {
    const named =
      /^\s*thedigitalgifter\.com,\s*www\.thedigitalgifter\.com\s*\{/m.test(text) ||
      /^\s*www\.thedigitalgifter\.com,\s*thedigitalgifter\.com\s*\{/m.test(text);
    if (!named) {
      throw new Error("HTTPS Caddyfile must use a named site block for TDG");
    }
    if (!/Strict-Transport-Security/i.test(text)) {
      throw new Error("HTTPS Caddyfile must set HSTS");
    }
  }
  if (mode === "http") {
    const named =
      /^\s*thedigitalgifter\.com,\s*www\.thedigitalgifter\.com\s*\{/m.test(text) ||
      /^\s*www\.thedigitalgifter\.com,\s*thedigitalgifter\.com\s*\{/m.test(text);
    if (named) {
      throw new Error("HTTP Caddyfile must not enable named HTTPS site blocks");
    }
  }
  return true;
}
