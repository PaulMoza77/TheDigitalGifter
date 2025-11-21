import { useQuery } from "@tanstack/react-query";
import { useConvex } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Doc } from "../../../convex/_generated/dataModel";

export const authKeys = {
  me: ["auth", "me"] as const,
};

export function useLoggedInUserQuery() {
  const convex = useConvex();

  return useQuery<Doc<"users"> | null, Error>({
    queryKey: authKeys.me,
    queryFn: () => convex.query(api.auth.loggedInUser, {}),
    // For auth queries, use very short stale time so changes are detected quickly
    staleTime: 0, // Always consider stale, refetch on mount
    gcTime: 5 * 60 * 1000,
    // Refetch when window regains focus (catches auth redirects)
    refetchOnWindowFocus: true,
    // Only fetch when authenticated or when checking auth status
    enabled: true,
  });
}
