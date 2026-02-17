// src/hooks/useAdminAuth.ts
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

/**
 * Custom hook to check if the current user has admin privileges
 * @param redirectIfNotAdmin - If true, automatically redirects to home page when user is not an admin
 *
 * Priority:
 *  1) profiles.role === "admin" (if exists)
 *  2) admin_users allowlist by email (fallback, recommended)
 */
export function useAdminAuth(redirectIfNotAdmin = true) {
  const navigate = useNavigate();

  const [isAdminRaw, setIsAdminRaw] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function checkAdmin() {
      setIsLoading(true);

      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      if (userErr) console.error("[useAdminAuth] getUser error:", userErr);

      if (!user) {
        if (mounted) {
          setIsAdminRaw(false);
          setIsLoading(false);
          if (redirectIfNotAdmin) navigate("/");
        }
        return;
      }

      // ---- 1) Try profiles.role (if you have it) ----
      try {
        const { data: prof, error: profErr } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        // If row exists and is admin -> done
        if (!profErr && prof?.role) {
          const admin = prof.role === "admin";
          if (mounted) {
            setIsAdminRaw(admin);
            setIsLoading(false);
            if (redirectIfNotAdmin && !admin) navigate("/");
          }
          return;
        }
      } catch (e) {
        console.error("[useAdminAuth] profiles check failed:", e);
      }

      // ---- 2) Fallback: admin_users allowlist by email ----
      try {
        const email = user.email ?? null;

        if (!email) {
          if (mounted) {
            setIsAdminRaw(false);
            setIsLoading(false);
            if (redirectIfNotAdmin) navigate("/");
          }
          return;
        }

        const { data: row, error: allowErr } = await supabase
          .from("admin_users")
          .select("email")
          .eq("email", email)
          .maybeSingle();

        if (allowErr) console.error("[useAdminAuth] admin_users check error:", allowErr);

        const admin = Boolean(row?.email);

        if (mounted) {
          setIsAdminRaw(admin);
          setIsLoading(false);
          if (redirectIfNotAdmin && !admin) navigate("/");
        }
      } catch (e) {
        console.error("[useAdminAuth] admin_users fallback failed:", e);
        if (mounted) {
          setIsAdminRaw(false);
          setIsLoading(false);
          if (redirectIfNotAdmin) navigate("/");
        }
      }
    }

    void checkAdmin();

    return () => {
      mounted = false;
    };
  }, [redirectIfNotAdmin, navigate]);

  return {
    isAdmin: isAdminRaw === true,
    isLoading,
    isNotAdmin: isAdminRaw === false,
  };
}
