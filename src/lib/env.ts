// src/lib/env.ts
function requiredPublicEnv(name: "VITE_SUPABASE_URL" | "VITE_SUPABASE_ANON_KEY"): string {
  const value = String(import.meta.env[name] ?? "").trim();
  if (!value) {
    // For local testing without Supabase, return placeholder
    console.warn(`Missing environment variable: ${name}. Using placeholder for local testing.`);
    if (name === "VITE_SUPABASE_URL") {
      return "https://placeholder.supabase.co";
    }
    return "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder";
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
