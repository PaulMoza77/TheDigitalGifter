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
        const { data: row, error } = await supabase
          .from("admin_users")
          .select("email")
          .eq("email", normalizedEmail)
          .maybeSingle();

        if (!mounted) return;

        if (error) {
          console.error("[AdminRoute] admin_users check error:", error);
          // Terminate loading with explicit non-admin rather than hang
          setGate({ ready: true, email: normalizedEmail, isAdmin: false });
          return;
        }

        setGate({
          ready: true,
          email: normalizedEmail,
          isAdmin: Boolean(row?.email),
        });
      } catch (e) {
        console.error("[AdminRoute] checkAdmin fatal:", e);
        if (mounted) setGate({ ready: true, email: normalizedEmail || null, isAdmin: false });
      }
    }

    if (authLoading) return;

    const nextEmail = (user?.email || "").trim().toLowerCase();
    // Avoid infinite "Verifying…" flash on SPA nav when already verified for same email
    setGate((prev) => {
      if (prev.ready && prev.email === nextEmail && nextEmail) {
        void checkAdmin(user?.email ?? null);
        return prev;
      }
      return { ...prev, ready: false };
    });
    void checkAdmin(user?.email ?? null);

    return () => {
      mounted = false;
    };
  }, [authLoading, user?.email]);

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

  if (!gate.email) {
    return <AdminSignInGate returnPath={`${location.pathname}${location.search}`} />;
  }

  if (!gate.isAdmin) {
    console.warn("[AdminRoute] Not admin:", { email: gate.email });
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
