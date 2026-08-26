/** Read Meta browser cookies for CAPI matching. Never log returned values. */

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  try {
    const prefix = `${name}=`;
    const parts = document.cookie.split(";").map((part) => part.trim());
    const hit = parts.find((part) => part.startsWith(prefix));
    if (!hit) return null;
    const value = decodeURIComponent(hit.slice(prefix.length)).trim();
    if (!value || value.length > 200) return null;
    if (/[<>@]/.test(value)) return null;
    return value;
  } catch {
    return null;
  }
}

export function readMetaFbc(): string | null {
  return readCookie("_fbc");
}

export function readMetaFbp(): string | null {
  return readCookie("_fbp");
}
