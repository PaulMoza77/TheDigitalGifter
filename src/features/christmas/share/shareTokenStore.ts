import { isShareToken, parseShareTokenFromSearch } from "./shareLogic";

const PREFIX = "tdg.christmas.result-share-token.";

export function resultShareTokenStorageKey(generationId: string): string {
  return `${PREFIX}${generationId}`;
}

/**
 * Production origin stores the token in sessionStorage and strips the query
 * before analytics boot. Query parsing is retained as a preview/dev fallback.
 */
export function readResultShareToken(generationId: string, search = ""): string | null {
  if (typeof window === "undefined") return parseShareTokenFromSearch(search);
  const fromQuery = parseShareTokenFromSearch(search);
  if (fromQuery) {
    try {
      window.sessionStorage.setItem(resultShareTokenStorageKey(generationId), fromQuery);
      window.history.replaceState(window.history.state, "", window.location.pathname);
    } catch {
      /* ignore */
    }
    return fromQuery;
  }
  try {
    const stored = window.sessionStorage.getItem(resultShareTokenStorageKey(generationId));
    return isShareToken(stored) ? stored : null;
  } catch {
    return null;
  }
}
