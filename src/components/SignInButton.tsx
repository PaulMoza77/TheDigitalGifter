import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { toast } from "sonner";
import { useEffect, useRef } from "react";
import { invalidateAuthCaches, queryClient } from "@/data";

interface SignInButtonProps {
  variant?: "default" | "gradient";
}

export function SignInButton({ variant = "default" }: SignInButtonProps) {
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

  const buttonStyles =
    variant === "gradient"
      ? "shrink-0 inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-[#1a1a1a] bg-[linear-gradient(120deg,#ff4d4d,#ff9866,#ffd976)] hover:brightness-110 active:scale-95 transition-all shadow-[0_4px_20px_rgba(255,170,90,.4)]"
      : "rounded-full px-3 py-2 text-sm border border-white/20 bg-white/10 hover:bg-white/15 transition will-change-transform hover:scale-[1.04] text-white";

  return (
    <button
      type="button"
      className={buttonStyles}
      onClick={() => {
        void handleGoogle();
      }}
    >
      {variant === "gradient" && (
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path
            fill="currentColor"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="currentColor"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="currentColor"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="currentColor"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
      )}
      Connect Google
    </button>
  );
}
