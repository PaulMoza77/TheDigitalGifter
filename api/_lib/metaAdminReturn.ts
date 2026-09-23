/** Allowlist for the Meta OAuth return URL. Kept in the Node origin so the callback does not import Edge-only files. */

export function isAllowedAdminReturn(target: string, publicBaseUrl: string): boolean {
  try {
    const base = new URL(publicBaseUrl);
    const url = new URL(target);
    if (url.origin !== base.origin) return false;
    if (url.username || url.password) return false;
    if (url.pathname !== "/admin/social-accounts") return false;
    return true;
  } catch {
    return false;
  }
}
