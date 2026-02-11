// src/components/AdminRoute.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase";

// ✅ Simple allowlist (edit to your admin emails)
const ADMIN_EMAILS = new Set<string>([
  "paul@thedigitalgifter.com",
  "paulmoza@gmail.com",
]);

type AuthState = {
  loading: boolean;
  email: string | null;
};

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [state, setState] = useState<AuthState>({ loading: true, email: null });

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!mounted) return;

      if (error) {
        console.error("[AdminRoute] supabase.auth.getUser error:", error);
        setState({ loading: false, email: null });
        return;
      }

      setState({ loading: false, email: data.user?.email ?? null });
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setState({ loading: false, email: session?.user?.email ?? null });
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  const isAdmin = useMemo(() => {
    const email = (state.email || "").trim().toLowerCase();
    return email ? ADMIN_EMAILS.has(email) : false;
  }, [state.email]);

  if (state.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-indigo-500" />
          <p className="text-sm text-slate-400">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  // not logged in → redirect to home (or to /login if you have one)
  if (!state.email) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  // logged in but not admin → redirect home
  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
