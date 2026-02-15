import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { queryClient, invalidateAuthCaches, useLoggedInUserQuery } from "@/data";

export function useBootstrapUser() {
  const { data: user } = useLoggedInUserQuery(); // { id, email } | null

  // 1) Ensure profile row exists in DB (profiles)
  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;

    (async () => {
      try {
        // ✅ create/update profile row (adjust columns as you want)
        const { error } = await supabase.from("profiles").upsert(
          {
            id: user.id,
            email: user.email,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );

        if (error) throw error;

        if (!cancelled) {
          // refresh any auth-dependent queries
          await invalidateAuthCaches();
        }
      } catch (err) {
        console.error("[useBootstrapUser] Failed to ensure profile:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.email]);

  // 2) When auth changes, clear + invalidate caches
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (
        event === "SIGNED_IN" ||
        event === "SIGNED_OUT" ||
        event === "TOKEN_REFRESHED" ||
        event === "USER_UPDATED"
      ) {
        queryClient.clear();
        void invalidateAuthCaches();
      }
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  return user;
}