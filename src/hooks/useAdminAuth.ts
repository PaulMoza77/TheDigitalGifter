// src/hooks/useAdminAuth.ts
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

/**
 * Custom hook to check if the current user has admin privileges
 * @param redirectIfNotAdmin - If true, automatically redirects to home page when user is not an admin
 */
export function useAdminAuth(redirectIfNotAdmin = true) {
  const navigate = useNavigate();

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function checkAdmin() {
      setIsLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (mounted) {
          setIsAdmin(false);
          setIsLoading(false);
          if (redirectIfNotAdmin) navigate("/");
        }
        return;
      }

      // 🔥 Adjust table name if needed
      const { data, error } = await supabase
        .from("profiles") // change to "users" if that's your table
        .select("role")
        .eq("id", user.id)
        .single();

      if (mounted) {
        const admin = !error && data?.role === "admin";
        setIsAdmin(admin);
        setIsLoading(false);

        if (redirectIfNotAdmin && !admin) {
          console.log("User is not admin, redirecting...");
          navigate("/");
        }
      }
    }

    void checkAdmin();

    return () => {
      mounted = false;
    };
  }, [redirectIfNotAdmin, navigate]);

  return {
    isAdmin: isAdmin === true,
    isLoading,
    isNotAdmin: isAdmin === false,
  };
}