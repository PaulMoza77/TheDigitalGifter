// src/components/SignInButton.tsx
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { invalidateAuthCaches, queryClient } from "@/data";

interface SignInButtonProps {
  variant?: "default" | "gradient";
}

export function SignInButton({ variant = "default" }: SignInButtonProps) {
  const previousAuthRef = useRef<boolean | null>(null);

  // ✅ listen for auth state changes (login/logout) and refresh caches
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      // When auth changes, clear + refetch cached queries
      if (
        event === "SIGNED_IN" ||
        event === "TOKEN_REFRESHED" ||
        event === "SIGNED_OUT" ||
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

  // ✅ initial check (optional, but keeps same “previousAuthState” spirit)
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;

      const isAuthed = Boolean(data.session?.user);
      if (previousAuthRef.current === null) {
        previousAuthRef.current = isAuthed;
      } else if (isAuthed !== previousAuthRef.current) {
        previousAuthRef.current = isAuthed;
        queryClient.clear();
        void invalidateAuthCaches();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleGoogle() {
    try {
      // ✅ if you use PKCE + redirect, this will navigate away
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/callback`
          : undefined;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          // optional: keep user landing page
          queryParams: { access_type: "offline", prompt: "consent" },
        },
      });

      if (error) throw error;
    } catch (e: any) {
      console.error("Google sign-in failed:", e);
      toast.error(
        e?.message ||
          "Sign-in error. Verifică setările Google OAuth din Supabase."
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
      onClick={() => void handleGoogle()}
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