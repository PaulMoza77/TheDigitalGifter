import { useEffect, useRef } from "react";
import { useConvexAuth } from "convex/react";
import { invalidateAuthCaches } from "@/data";

/**
 * Hook to monitor authentication state changes and invalidate caches
 * This ensures that when a user logs in or logs out, all auth-related
 * queries are refetched immediately instead of using stale cache.
 */
export function useAuthStateMonitor() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const previousAuthStateRef = useRef<boolean | null>(null);

  useEffect(() => {
    // Skip if auth state is still loading
    if (isLoading) {
      return;
    }

    // On first render, just store the current auth state
    if (previousAuthStateRef.current === null) {
      previousAuthStateRef.current = isAuthenticated;
      return;
    }

    // If auth state changed (login or logout), invalidate all caches
    if (previousAuthStateRef.current !== isAuthenticated) {
      console.log(
        `[useAuthStateMonitor] Auth state changed to: ${isAuthenticated ? "authenticated" : "unauthenticated"}`
      );
      invalidateAuthCaches();
      previousAuthStateRef.current = isAuthenticated;
    }
  }, [isAuthenticated, isLoading]);
}
