import type { SantaCallLanguage } from "./santaCallTypes";

/**
 * Resolve UI language for Santa Call.
 * Priority: ?lang= → /ro|/en path prefix → navigator → RO (primary commercial market).
 */
export function resolveSantaCallUiLanguage(input?: {
  pathname?: string | null;
  search?: string | null;
  navigatorLanguage?: string | null;
}): SantaCallLanguage {
  const search = String(input?.search || "");
  const params = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search,
  );
  const fromQuery = String(params.get("lang") || "")
    .trim()
    .toLowerCase();
  if (fromQuery.startsWith("en")) return "en";
  if (fromQuery.startsWith("ro")) return "ro";

  const path = String(input?.pathname || "").toLowerCase();
  if (/^\/ro(\/|$)/.test(path)) return "ro";
  if (/^\/en(\/|$)/.test(path)) return "en";

  const nav = String(input?.navigatorLanguage || "")
    .trim()
    .toLowerCase();
  if (nav.startsWith("en")) return "en";
  return "ro";
}
