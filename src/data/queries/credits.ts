import { useQuery } from "@tanstack/react-query";
import { useConvex } from "convex/react";
import { api } from "../../../convex/_generated/api";

export const creditsKeys = {
  all: ["credits"] as const,
};

export function useUserCreditsQuery() {
  const convex = useConvex();

  return useQuery<number, Error>({
    queryKey: creditsKeys.all,
    queryFn: () => convex.query(api.credits.getUserCredits, {}),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
