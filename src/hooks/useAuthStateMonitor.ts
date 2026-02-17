import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { invalidateAuthCaches, queryClient } from "@/data";

export function useAuthStateMonitor() {
  const prevKeyRef = useRef<string>("__INIT__");

  useEffect(() => {
    // 1) init snapshot
    (async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) console.error("[useAuthStateMonitor] getSession error:", error);

      const user = data.session?.user ?? null;
      const key = user ? `${user.id}:${user.email ?? ""}` : "__LOGGED_OUT__";
      prevKeyRef.current = key;
    })();

    // 2) subscribe
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const user = session?.user ?? null;
      const key = user ? `${user.id}:${user.email ?? ""}` : "__LOGGED_OUT__";

      if (prevKeyRef.current !== key) {
        console.log(
          `[useAuthStateMonitor] Auth changed: ${user ? "logged-in" : "logged-out"}`
        );

        // Clear cached queries + refetch auth-related caches
        queryClient.clear();
        await invalidateAuthCaches();

        prevKeyRef.current = key;
      }
    });

    return () => {
      sub?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const onFocus = () => {
      void invalidateAuthCaches();
    };

    const onVis = () => {
      if (document.visibilityState === "visible") {
        void invalidateAuthCaches();
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);
}
