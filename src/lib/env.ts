// src/lib/env.ts

/** Expected hosted project ref for TheDigitalGifter (kjlsocejpmnzhhduyumy). */
export const TDG_SUPABASE_PROJECT_REF = "kjlsocejpmnzhhduyumy";

function requiredPublicEnv(name: "VITE_SUPABASE_URL" | "VITE_SUPABASE_ANON_KEY"): string {
  const value = String(import.meta.env[name] ?? "").trim();
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Set it in .env.local (local) or the VPS app.env used at image build.`
    );
  }
  return value;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const json =
      typeof atob === "function"
        ? atob(padded)
        : typeof Buffer !== "undefined"
          ? Buffer.from(padded, "base64").toString("utf8")
          : "";
    if (!json) return null;
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Soft validation for public Supabase env. Does not throw — wrong env must not
 * blank the whole SPA — but logs actionable diagnostics for ops.
 */
export function warnIfPublicSupabaseConfigLooksBroken(input: {
  url: string;
  anon: string;
}): void {
  if (typeof console === "undefined") return;

  const url = String(input.url || "").replace(/\/$/, "");
  const anon = String(input.anon || "");

  let hostname = "";
  try {
    hostname = new URL(url).hostname;
  } catch {
    console.error("[env] VITE_SUPABASE_URL is not a valid URL:", url);
    return;
  }

  if (/^supabase\.thedigitalgifter\.com$/i.test(hostname)) {
    console.warn(
      "[env] VITE_SUPABASE_URL uses supabase.thedigitalgifter.com. " +
        "If that host is not a working Supabase custom domain (TLS/DNS), " +
        `use https://${TDG_SUPABASE_PROJECT_REF}.supabase.co instead.`,
    );
  }

  const payload = decodeJwtPayload(anon);
  const ref = typeof payload?.ref === "string" ? payload.ref : "";
  const role = typeof payload?.role === "string" ? payload.role : "";

  if (!payload || role !== "anon" || !ref) {
    console.error(
      "[env] VITE_SUPABASE_ANON_KEY does not look like a hosted Supabase anon JWT " +
        `(missing role/ref). Expected a key for project ${TDG_SUPABASE_PROJECT_REF}.`,
    );
    return;
  }

  if (ref !== TDG_SUPABASE_PROJECT_REF) {
    console.error(
      `[env] VITE_SUPABASE_ANON_KEY ref=${ref} does not match project ${TDG_SUPABASE_PROJECT_REF}.`,
    );
  }
}

/** Public Supabase config for browser + edge function Authorization headers. */
export function getPublicSupabaseConfig(): { url: string; anon: string } {
  const config = {
    url: requiredPublicEnv("VITE_SUPABASE_URL"),
    anon: requiredPublicEnv("VITE_SUPABASE_ANON_KEY"),
  };

  try {
    warnIfPublicSupabaseConfigLooksBroken(config);
  } catch {
    // Validation is best-effort; never block boot.
  }

  return config;
}
