import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

export default function AuthCallback() {
  const nav = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        // PKCE: exchange ?code=... to a session
        const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
        if (error) console.error("[AuthCallback] exchangeCodeForSession error:", error);
      } finally {
        nav("/", { replace: true });
      }
    })();
  }, [nav]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center text-white/80">
      Finalizing sign in...
    </div>
  );
}
