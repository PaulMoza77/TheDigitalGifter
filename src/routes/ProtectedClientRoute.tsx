// FILE: src/routes/ProtectedClientRoute.tsx
import React, { lazy, Suspense } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";
import { rememberAuthReturnTo } from "@/lib/auth/returnTo";

const PlannerAuthGate = lazy(() => import("@/features/christmas/planner/PlannerAuthGate"));

export default function ProtectedClientRoute() {
  const location = useLocation();
  const [loading, setLoading] = React.useState(true);
  const [session, setSession] = React.useState<Session | null>(null);

  React.useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession ?? null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    const planner =
      location.pathname === "/account/christmas" || location.pathname.startsWith("/account/christmas/");
    if (planner) {
      return (
        <div
          className="min-h-screen flex items-center justify-center"
          style={{ background: "#f7f1e8", color: "#6a5f55", fontFamily: '"Source Sans 3", "Segoe UI", sans-serif' }}
        >
          Opening your Christmas…
        </div>
      );
    }
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-white/80">
        Loading...
      </div>
    );
  }

  if (!session) {
    if (location.pathname === "/account/christmas" || location.pathname.startsWith("/account/christmas/")) {
      rememberAuthReturnTo(`${location.pathname}${location.search}`);
      return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#f6efe4] text-[#1c1612]">Opening…</div>}>
          <PlannerAuthGate />
        </Suspense>
      );
    }
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  return <Outlet />;
}