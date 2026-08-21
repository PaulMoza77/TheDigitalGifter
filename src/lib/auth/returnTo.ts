export const AUTH_RETURN_TO_KEY = "tdg.auth.returnTo";

export function isSafeAdminReturnPath(path: string): boolean {
  return path.startsWith("/admin") && !path.startsWith("//") && !path.includes("://") && !path.includes("\\");
}

export function rememberAuthReturnTo(path: string) {
  try {
    if (!isSafeAdminReturnPath(path)) return;
    window.sessionStorage.setItem(AUTH_RETURN_TO_KEY, path);
  } catch {
    /* private mode */
  }
}

export function takeAuthReturnTo(fallback = "/"): string {
  try {
    const value = window.sessionStorage.getItem(AUTH_RETURN_TO_KEY) || "";
    window.sessionStorage.removeItem(AUTH_RETURN_TO_KEY);
    return isSafeAdminReturnPath(value) ? value : fallback;
  } catch {
    return fallback;
  }
}
