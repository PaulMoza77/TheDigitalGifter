// src/lib/supabase.ts
import { createClient } from "@supabase/supabase-js";
import { getPublicSupabaseConfig } from "@/lib/env";

const { url: supabaseUrl, anon: supabaseAnonKey } = getPublicSupabaseConfig();

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  },
  global: {
    headers: {
      "X-Client-Info": "thedigitalgifter-web",
    },
  },
});

if (typeof window !== "undefined") {
  (window as any).__supabase = supabase;
}
