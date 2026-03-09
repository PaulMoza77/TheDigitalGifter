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

    async function checkAdmin(sessionEmail?: string | null) {
      try {
        const normalizedEmail = (sessionEmail || "").trim().toLowerCase();

        if (!normalizedEmail) {
          if (mounted) {
            setState({
              loading: false,
              email: null,
              isAdmin: false,
            });
          }
          return;
        }

        const { data: row, error } = await supabase
          .from("admin_users")
          .select("email")
          .eq("email", normalizedEmail)
          .maybeSingle();

        if (!mounted) return;

        if (error) {
          console.error("[AdminRoute] admin_users check error:", error);
          setState({
            loading: false,
            email: normalizedEmail,
            isAdmin: false,
          });
          return;
        }

        setState({
          loading: false,
          email: normalizedEmail,
          isAdmin: Boolean(row?.email),
        });
      } catch (e) {
        console.error("[AdminRoute] checkAdmin fatal:", e);

        if (!mounted) return;

        setState({
          loading: false,
          email: null,
          isAdmin: false,
        });
      }
    }

    async function bootstrap() {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (!mounted) return;

        if (error) {
          console.error("[AdminRoute] getSession error:", error);
          setState({
            loading: false,
            email: null,
            isAdmin: false,
          });
          return;
        }

        const email = data.session?.user?.email?.trim().toLowerCase() ?? null;
        await checkAdmin(email);
      } catch (e) {
        console.error("[AdminRoute] bootstrap fatal:", e);

        if (!mounted) return;

        setState({
          loading: false,
          email: null,
          isAdmin: false,
        });
      }
    }

    void bootstrap();

    const { data: authSub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;

      const email = session?.user?.email?.trim().toLowerCase() ?? null;

      setState((prev) => {
        if (prev.email === email) {
          return prev;
        }

        return {
          loading: true,
          email,
          isAdmin: false,
        };
      });

      void checkAdmin(email);
    });

    return () => {
      mounted = false;
      authSub.subscription.unsubscribe();
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

  if (!state.email) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  if (!state.isAdmin) {
    console.warn("[AdminRoute] Not admin:", { email: state.email });
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}