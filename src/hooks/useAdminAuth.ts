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

      try {
        const { data, error } = await supabase.rpc("is_admin");
        if (error) throw error;
        if (mounted) {
          setIsAdminRaw(data === true);
          setIsLoading(false);
          if (redirectIfNotAdmin && data !== true) navigate("/");
        }
      } catch (error) {
        console.error("[useAdminAuth] admin verification failed", error);
        if (mounted) { setIsAdminRaw(false); setIsLoading(false); }
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
