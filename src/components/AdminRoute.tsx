// src/components/AdminRoute.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";

// ✅ Simple allowlist (edit to your admin emails)
const ADMIN_EMAILS = new Set<string>([
  "paul@thedigitalgifter.com",
  "paulmoza@gmail.com",
]);

type AuthState = {
  loading: boolean;
  email: string | null;
  // optional: helpful for debugging
  checkedProfile: boolean;
  profileRole: string | null;
};

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  const [state, setState] = useState<AuthState>({
    loading: true,
    email: null,
    checkedProfile: false,
    profileRole: null,
  });

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        // 1) Prefer session from local storage (most reliable)
        const { data, error } = await supabase.auth.getSession();
        if (!mounted) return;

        if (error) {
          console.error("[AdminRoute] getSession error:", error);
          setState((s) => ({ ...s, loading: false, email: null }));
          return;
        }

        const email = data.session?.user?.email ?? null;

        // set email fast (so allowlist can pass instantly)
        setState((s) => ({
          ...s,
          loading: false,
          email,
        }));

        // 2) OPTIONAL: check DB role (won't block allowlist)
        // If your project doesn't have profiles/role, this can safely fail.
        if (email) {
          try {
            const { data: u } = await supabase.auth.getUser();
            const userId = u.user?.id ?? null;

            if (userId) {
              const { data: prof, error: profErr } = await supabase
                .from("profiles")
                .select("role")
                .eq("id", userId)
                .maybeSingle();

              if (!mounted) return;

              if (profErr) {
                // This is usually where your 400 comes from (table/column mismatch)
                console.warn("[AdminRoute] profiles.role check failed:", profErr);
                setState((s) => ({
                  ...s,
                  checkedProfile: true,
                  profileRole: null,
                }));
              } else {
                setState((s) => ({
                  ...s,
                  checkedProfile: true,
                  profileRole: (prof as any)?.role ?? null,
                }));
              }
            } else {
              setState((s) => ({ ...s, checkedProfile: true, profileRole: null }));
            }
          } catch (e) {
            console.warn("[AdminRoute] profile role check exception:", e);
            if (!mounted) return;
            setState((s) => ({ ...s, checkedProfile: true, profileRole: null }));
          }
        } else {
          setState((s) => ({ ...s, checkedProfile: true, profileRole: null }));
        }
      } catch (e) {
        console.error("[AdminRoute] init error:", e);
        if (!mounted) return;
        setState((s) => ({ ...s, loading: false, email: null }));
      }
    }

    void load();

    // keep in sync with auth changes
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setState((s) => ({
        ...s,
        loading: false,
        email: session?.user?.email ?? null,
      }));
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe();
    };
  }, []);

  const isAdmin = useMemo(() => {
    const email = (state.email || "").trim().toLowerCase();
    const allowlistOk = email ? ADMIN_EMAILS.has(email) : false;

    // if you actually use DB roles, this enables it too
    const roleOk = (state.profileRole || "").toLowerCase() === "admin";

    return allowlistOk || roleOk;
  }, [state.email, state.profileRole]);

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

  // not logged in → redirect
  if (!state.email) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  // logged in but not admin → redirect
  if (!isAdmin) {
    console.warn("[AdminRoute] Not admin:", {
      email: state.email,
      profileRole: state.profileRole,
      checkedProfile: state.checkedProfile,
    });
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
