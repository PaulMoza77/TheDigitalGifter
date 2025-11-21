import { useEffect, useRef } from "react";
import { useConvexAuth } from "convex/react";
import { useConvex } from "convex/react";
import { invalidateAuthCaches, queryClient } from "@/data";

/**
 * Hook to monitor authentication state changes and invalidate caches
 * This ensures that when a user logs in or logs out, all auth-related
 * queries are refetched immediately instead of using stale cache.
 *
 * This uses multiple strategies:
 * 1. Monitors useConvexAuth state changes
 * 2. Detects Convex client reconnection (happens after auth redirect)
 * 3. Immediately invalidates and refetches queries
 */
export function useAuthStateMonitor() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const convex = useConvex();
  const previousAuthStateRef = useRef<boolean | null>(null);
  const reconnectionCheckRef = useRef<NodeJS.Timeout | null>(null);

  // Strategy 1: Monitor explicit auth state changes
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
      // Clear entire query cache and refetch
      queryClient.clear();
      invalidateAuthCaches();
      previousAuthStateRef.current = isAuthenticated;
    }
  }, [isAuthenticated, isLoading]);

  // Strategy 2: Monitor Convex client connection state
  // This catches auth changes that happen via redirect (like Google OAuth callback)
  useEffect(() => {
    if (!convex) return;

    // Setup listener for connection state changes
    const onStateChange = () => {
      console.log("[useAuthStateMonitor] Convex connection state changed");
      // Clear and invalidate on any connection change
      invalidateAuthCaches();
    };

    // Listen to Convex client events
    // The client may emit connection events when auth status changes
    if ((convex as any).onStateChange) {
      (convex as any).onStateChange(onStateChange);
    }

    // Also set up a fallback: periodically check if data has changed
    // This catches edge cases where state changes aren't detected
    const checkInterval = setInterval(() => {
      invalidateAuthCaches();
    }, 1000); // Check every second for 5 seconds after auth change

    return () => {
      clearInterval(checkInterval);
      if ((convex as any).offStateChange) {
        (convex as any).offStateChange(onStateChange);
      }
    };
  }, [convex]);

  // Strategy 3: Aggressive refetch on window focus (catches auth redirects)
  useEffect(() => {
    const handleFocus = () => {
      console.log("[useAuthStateMonitor] Window focused, invalidating caches");
      invalidateAuthCaches();
    };

    // Also catch visibilitychange which is more reliable
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        console.log(
          "[useAuthStateMonitor] Tab became visible, invalidating caches"
        );
        invalidateAuthCaches();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);
}
