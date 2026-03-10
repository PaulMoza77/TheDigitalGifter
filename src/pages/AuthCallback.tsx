// src/pages/AuthCallback.tsx
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    async function handleAuthCallback() {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        const errorCode = url.searchParams.get("error");
        const errorDescription = url.searchParams.get("error_description");

        if (errorCode) {
          console.error("[AuthCallback] OAuth error:", {
            errorCode,
            errorDescription,
          });

          if (mounted) {
            navigate("/?auth_error=oauth_error", { replace: true });
          }
          return;
        }

        if (!code) {
          console.warn("[AuthCallback] Missing auth code in callback URL.");

          if (mounted) {
            navigate("/?auth_error=missing_code", { replace: true });
          }
          return;
        }

        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          console.error("[AuthCallback] exchangeCodeForSession error:", error);

          if (mounted) {
            navigate("/?auth_error=exchange_failed", { replace: true });
          }
          return;
        }

        // curăță query params din URL și mergi în app
        if (mounted) {
          navigate("/", { replace: true });
        }
      } catch (err) {
        console.error("[AuthCallback] Unexpected error:", err);

        if (mounted) {
          navigate("/?auth_error=unexpected", { replace: true });
        }
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