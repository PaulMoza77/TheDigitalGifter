// src/contexts/AuthProvider.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;

  signOut: () => Promise<void>;
  signInWithGoogle: (opts?: { redirectTo?: string }) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    // 1) initial session
    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!mountedRef.current) return;

        if (error) console.error("[auth] getSession error:", error);
        setSession(data.session ?? null);
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    })();

    // 2) listen for changes
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mountedRef.current) return;
      setSession(newSession ?? null);
      setLoading(false);
    });

    return () => {
      mountedRef.current = false;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    return {
      session,
      user: session?.user ?? null,
      loading,

      signOut: async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      },

      signInWithGoogle: async (opts) => {
        // default: keep user on same page after auth callback (origin + current path)
        const redirectTo =
          opts?.redirectTo ??
          `${window.location.origin}${window.location.pathname}`;

        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo },
        });
        if (error) throw error;
      },
    };
  }, [session, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return ctx;
}
