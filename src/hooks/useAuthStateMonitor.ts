import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { invalidateAuthCaches, queryClient } from "@/data";

export function useAuthStateMonitor() {
  const previousEmailRef = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;

    // init snapshot
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      previousEmailRef.current = data.session?.user?.email ?? null;
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const email = session?.user?.email ?? null;

      if (previousEmailRef.current !== email) {
        console.log(
          `[useAuthStateMonitor] Auth changed: ${email ? "logged-in" : "logged-out"}`
        );
        queryClient.clear();
        invalidateAuthCaches();
        previousEmailRef.current = email;
      }
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const onFocus = () => invalidateAuthCaches();
    const onVis = () => {
      if (document.visibilityState === "visible") invalidateAuthCaches();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);
}
