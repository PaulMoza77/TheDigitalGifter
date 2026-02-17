// src/lib/supabase.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

function missingEnv(name: string) {
  return new Error(
    `Missing ${name}. Check your .env.local / Vercel env vars and restart dev server.`
  );
}

// Single client instance.
// Fail loudly if env vars are missing.
export const supabase: SupabaseClient = (() => {
  if (!supabaseUrl) throw missingEnv("VITE_SUPABASE_URL");
  if (!supabaseAnonKey) throw missingEnv("VITE_SUPABASE_ANON_KEY");

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      // ✅ Important for OAuth in SPA (recommended)
      flowType: "pkce",

      // ✅ Persist + refresh
      persistSession: true,
      autoRefreshToken: true,

      // ✅ If you use OAuth redirects (code in URL)
      detectSessionInUrl: true,
    },
  });
})();
