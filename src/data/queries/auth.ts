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
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
