// src/components/AdminRoute.tsx
import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";

type State = {
  loading: boolean;
  email: string | null;
  isAdmin: boolean;
};

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [state, setState] = useState<State>({
    loading: true,
    email: null,
    isAdmin: false,
  });

  useEffect(() => {
    let mounted = true;

    async function run() {
      try {
        // 1) get current session/email
        const { data, error } = await supabase.auth.getSession();
        if (!mounted) return;

        if (error) {
          console.error("[AdminRoute] getSession error:", error);
          setState({ loading: false, email: null, isAdmin: false });
          return;
        }

        const email = data.session?.user?.email?.trim().toLowerCase() ?? null;

        if (!email) {
          setState({ loading: false, email: null, isAdmin: false });
          return;
        }

        // 2) check admin by DB table: public.admin_users
        // NOTE: needs RLS policy (see SQL below) OR RLS disabled for admin_users
        const { data: row, error: e2 } = await supabase
          .from("admin_users")
          .select("email")
          .eq("email", email)
          .maybeSingle();

        if (!mounted) return;

        if (e2) {
          console.error("[AdminRoute] admin_users check error:", e2);
          setState({ loading: false, email, isAdmin: false });
          return;
        }

        setState({ loading: false, email, isAdmin: Boolean(row?.email) });
      } catch (e) {
        console.error("[AdminRoute] fatal:", e);
        if (!mounted) return;
        setState({ loading: false, email: null, isAdmin: false });
      }
    }

    void run();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const email = session?.user?.email?.trim().toLowerCase() ?? null;
      // keep UI responsive; actual admin check runs on mount / refresh.
      setState((s) => ({ ...s, email }));
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

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

  // not logged in
  if (!state.email) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  // logged in but not admin
  if (!state.isAdmin) {
    console.warn("[AdminRoute] Not admin:", { email: state.email });
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
