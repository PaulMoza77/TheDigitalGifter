import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { toast } from "sonner";
import { useEffect, useRef } from "react";
import { invalidateAuthCaches, queryClient } from "@/data";

export function SignInButton() {
  const { signIn } = useAuthActions();
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const previousAuthStateRef = useRef<boolean | null>(null);

  // Monitor for successful login and invalidate caches
  useEffect(() => {
    // Skip if still loading
    if (authLoading) return;

    // Initialize on first render
    if (previousAuthStateRef.current === null) {
      previousAuthStateRef.current = isAuthenticated;
      return;
    }

    // If switched to authenticated, invalidate and refetch everything
    if (isAuthenticated && !previousAuthStateRef.current) {
      console.log("[SignInButton] Login detected! Invalidating caches");
      // Clear entire cache and invalidate auth queries
      queryClient.clear();
      invalidateAuthCaches();
      previousAuthStateRef.current = true;
    } else {
      previousAuthStateRef.current = isAuthenticated;
    }
  }, [isAuthenticated, authLoading]);

  async function handleGoogle() {
    try {
      console.log("[SignInButton] Starting Google sign-in...");
      await signIn("google");
      console.log("[SignInButton] Google sign-in completed");
      // Invalidate caches after login completes
      setTimeout(() => {
        console.log("[SignInButton] Post-login cache invalidation");
        queryClient.clear();
        invalidateAuthCaches();
      }, 500);
    } catch (e) {
      console.error("Google sign-in failed:", e);
      toast.error(
        [
          "Sign-in error. Verifică:",
          "1) Redirect URI: https://giddy-swan-737.convex.app/auth/callback/google",
          "2) Origin: https://thedigitalgifter.com",
          "3) Test users pe OAuth consent screen",
          "4) GOOGLE_CLIENT_ID / SECRET în Convex",
        ].join("\n")
      );
    }
  }

  return (
    <button
      type="button"
      className="rounded-full px-3 py-2 text-sm border border-white/20 bg-white/10 hover:bg-white/15 transition will-change-transform hover:scale-[1.04] text-white"
      onClick={() => {
        void handleGoogle();
      }}
    >
      Connect Google
    </button>
  );
}
