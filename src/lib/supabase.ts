// src/lib/supabase.ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  // Ajută enorm la debug când pe Vercel lipsesc env vars
  throw new Error(
    "Missing Supabase env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."
  );
}

// IMPORTANT:
// - persistSession + autoRefreshToken ca să ai JWT atașat automat la queries
// - storage: window.localStorage ca să nu pice pe SSR/edge cases
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
  },
  global: {
    headers: {
      "X-Client-Info": "thedigitalgifter-web",
    },
  },
});

// DEBUG helper (poți scoate după ce merge)
if (typeof window !== "undefined") {
  (window as any).__supabase = supabase;
}