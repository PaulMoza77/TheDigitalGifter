// src/pages/AuthCallback.tsx
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

function getHashParams() {
  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;

  return new URLSearchParams(hash);
}

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    async function finish() {
      if (!mounted) return;
      navigate("/", { replace: true });
    }

    async function fail(reason: string) {
      if (!mounted) return;
      navigate(`/?auth_error=${encodeURIComponent(reason)}`, { replace: true });
    }

    async function handleAuthCallback() {
      try {
        const url = new URL(window.location.href);
        const searchParams = url.searchParams;
        const hashParams = getHashParams();

        const errorCode =
          searchParams.get("error") || hashParams.get("error");
        const errorDescription =
          searchParams.get("error_description") ||
          hashParams.get("error_description");

        if (errorCode) {
          console.error("[AuthCallback] OAuth error:", {
            errorCode,
            errorDescription,
          });
          await fail("oauth_error");
          return;
        }

        const code = searchParams.get("code");

        // PKCE flow: /auth/callback?code=...
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);

          if (error) {
            console.error("[AuthCallback] exchangeCodeForSession error:", error);
            await fail("exchange_failed");
            return;
          }

          await finish();
          return;
        }

        // Implicit/hash flow fallback: #access_token=...&refresh_token=...
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");

        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            console.error("[AuthCallback] setSession error:", error);
            await fail("set_session_failed");
            return;
          }

          await finish();
          return;
        }

        // If session already exists for any reason, continue.
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session) {
          await finish();
          return;
        }

        console.warn("[AuthCallback] No auth code or token found in callback URL.");
        await fail("missing_code");
      } catch (err) {
        console.error("[AuthCallback] Unexpected error:", err);
        await fail("unexpected");
      }
    }

    void handleAuthCallback();

    return () => {
      mounted = false;
    };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center text-white/80">
      Finalizing sign in...
    </div>
  );
}