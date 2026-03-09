// src/lib/supabase.ts
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  "https://rmdsnpckutsucabledqz.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJtZHNucGNrdXRzdWNhYmxlZHF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA4MjE2NTksImV4cCI6MjA4NjM5NzY1OX0.yHUiSnsvCyjXkLaazuumVcEL4d0ChdwFaaFR4YXkkCI",
  {
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
  }
);

if (typeof window !== "undefined") {
  (window as any).__supabase = supabase;
}