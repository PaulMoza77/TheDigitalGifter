// src/lib/env.ts
function requiredPublicEnv(name: "VITE_SUPABASE_URL" | "VITE_SUPABASE_ANON_KEY"): string {
  const value = String(import.meta.env[name] ?? "").trim();
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Set it in .env.local (local) or Vercel Project Settings (deploy).`
    );
  }
  return value;
}

/** Public Supabase config for browser + edge function Authorization headers. */
export function getPublicSupabaseConfig(): { url: string; anon: string } {
  return {
    url: requiredPublicEnv("VITE_SUPABASE_URL"),
    anon: requiredPublicEnv("VITE_SUPABASE_ANON_KEY"),
  };
}
