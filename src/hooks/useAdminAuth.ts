import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";

/**
 * Custom hook to check if the current user has admin privileges
 * @param redirectIfNotAdmin - If true, automatically redirects to home page when user is not an admin
 * @returns Object containing isAdmin status and loading state
 */
export function useAdminAuth(redirectIfNotAdmin = true) {
  const isAdmin = useQuery(api.templates.isAdmin);
  const navigate = useNavigate();

  useEffect(() => {
    // Only redirect if explicitly requested and we know the user is NOT an admin
    if (redirectIfNotAdmin && isAdmin === false) {
      console.log("User is not an admin, redirecting to home page");
      navigate("/");
    }
  }, [isAdmin, redirectIfNotAdmin, navigate]);

  return {
    isAdmin: isAdmin === true,
    isLoading: isAdmin === undefined,
    isNotAdmin: isAdmin === false,
  };
}
