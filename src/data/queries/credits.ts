import { useQuery } from "@tanstack/react-query";
import { useConvex, useConvexAuth } from "convex/react";
import { api } from "../../../convex/_generated/api";

export const creditsKeys = {
  all: ["credits"] as const,
};

export function useUserCreditsQuery() {
  const convex = useConvex();
  const { isAuthenticated } = useConvexAuth();

  return useQuery<number, Error>({
    queryKey: creditsKeys.all,
    queryFn: () => convex.query(api.credits.getUserCredits, {}),
    // For auth-dependent queries, use very short stale time
    staleTime: 0, // Always consider stale, refetch on mount
    gcTime: 5 * 60 * 1000,
    // Refetch when window regains focus (catches auth redirects)
    refetchOnWindowFocus: true,
    // Only fetch when authenticated
    enabled: isAuthenticated,
  });
}
