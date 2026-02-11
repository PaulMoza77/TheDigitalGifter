// src/hooks/useAuthStateMonitor.ts
import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { invalidateAuthCaches, queryClient } from "@/data";

/**
 * Supabase-based auth state monitor
 * - When user logs in/out, we clear & invalidate react-query caches
 * - Also invalidates on focus/visibility to catch OAuth redirects
 */
export function useAuthStateMonitor() {
  const previousAuthRef = useRef<string | null>(null);

  // 1) Monitor Supabase session changes
  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      const email = data.session?.user?.email ?? null;
      previousAuthRef.current = email;
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const email = session?.user?.email ?? null;

      // first time: just store
      if (previousAuthRef.current === null && email === null) {
        previousAuthRef.current = email;
        return;
      }

      // if changed: clear + invalidate
      if (previousAuthRef.current !== email) {
        console.log(
          `[useAuthStateMonitor] Auth changed: ${email ? "logged-in" : "logged-out"}`
        );
        queryClient.clear();
        invalidateAuthCaches();
        previousAuthRef.current = email;
      }
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  // 2) Aggressive refetch on focus/visibility
  useEffect(() => {
    const handleFocus = () => {
      invalidateAuthCaches();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        invalidateAuthCaches();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);
}
