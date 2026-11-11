import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { SignInButton } from "@/components/SignInButton";
import { rememberAuthReturnTo } from "@/lib/auth/returnTo";

type Gate = {
  ready: boolean;
  email: string | null;
  isAdmin: boolean;
};

function AdminSignInGate({ returnPath }: { returnPath: string }) {
  useEffect(() => {
    rememberAuthReturnTo(returnPath);
  }, [returnPath]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/70 p-8 text-center">
        <p className="text-xs uppercase tracking-[0.25em] text-slate-500">TDG Admin</p>
        <h1 className="mt-3 text-2xl font-semibold text-slate-50">Sign in required</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Pet Funnel Analytics and other admin pages are not public. Sign in with the admin
          account, then you will stay on this page.
        </p>
        <div className="mt-6 flex justify-center">
          <SignInButton />
        </div>
      </div>
    </div>
  );
}

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [gate, setGate] = useState<Gate>({ ready: false, email: null, isAdmin: false });

  useEffect(() => {
    let mounted = true;

    async function checkAdmin(sessionEmail?: string | null) {
      const normalizedEmail = (sessionEmail || "").trim().toLowerCase();
      if (!normalizedEmail) {
        if (mounted) setGate({ ready: true, email: null, isAdmin: false });
        return;
      }

      try {
        const { data, error } = await supabase.rpc("is_admin");
        if (!mounted) return;
        if (error) {
          setError("Admin access could not be verified. Check the connection and retry.");
          setGate({ ready: true, email: normalizedEmail, isAdmin: false });
          return;
        }
        setError(null);
        setGate({ ready: true, email: normalizedEmail, isAdmin: data === true });
      } catch (e) {
        console.error("[AdminRoute] checkAdmin fatal:", e);
        if (mounted) { setError("Admin access could not be verified. Please retry."); setGate({ ready: true, email: normalizedEmail, isAdmin: false }); }
      }
    }

    if (authLoading) return;
    setGate((prev) => ({ ...prev, ready: false }));
    void checkAdmin(user?.email ?? null);

    return () => {
      mounted = false;
    };
  }, [authLoading, user?.email, retry]);

  if (authLoading || !gate.ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-indigo-500" />
          <p className="text-sm text-slate-400">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  if (error && user) return <div className="p-8 text-center"><p role="alert">{error}</p><button className="mt-4 underline" onClick={() => setRetry((n) => n + 1)}>Retry access check</button></div>;

  if (!gate.email) {
    return <AdminSignInGate returnPath={`${location.pathname}${location.search}`} />;
  }

  if (!gate.isAdmin) {
    console.warn("[AdminRoute] Not admin:", { email: gate.email });
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
