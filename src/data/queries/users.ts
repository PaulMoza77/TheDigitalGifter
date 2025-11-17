import { useQuery } from "@tanstack/react-query";
import { useConvex } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Doc } from "../../../convex/_generated/dataModel";

export const userKeys = {
  profile: (userId?: string | null) =>
    ["userProfile", userId ?? "anonymous"] as const,
};

export function useUserProfileQuery(userId?: string | null) {
  const convex = useConvex();

  return useQuery<Doc<"userProfiles"> | null, Error>({
    queryKey: userKeys.profile(userId),
    queryFn: () => {
      if (!userId) {
        return Promise.resolve(null);
      }
      return convex.query(api.users.getMe, { userId });
    },
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
