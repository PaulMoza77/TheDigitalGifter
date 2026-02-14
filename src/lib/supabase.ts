// src/lib/supabase.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

function missingEnv(name: string) {
  return new Error(
    `Missing ${name}. Check your .env.local / Vercel env vars and restart dev server.`
  );
}

// We export a single client instance.
// If env vars are missing, we throw early so the app fails loudly (better than silent blank screen).
export const supabase: SupabaseClient = (() => {
  if (!supabaseUrl) throw missingEnv("VITE_SUPABASE_URL");
  if (!supabaseAnonKey) throw missingEnv("VITE_SUPABASE_ANON_KEY");

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true, // useful if you do OAuth redirects later
    },
  });
})();
