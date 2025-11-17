import { useQuery } from "@tanstack/react-query";
import { useConvex } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Doc } from "../../../convex/_generated/dataModel";

export const jobsKeys = {
  all: ["jobs"] as const,
};

export function useJobsQuery() {
  const convex = useConvex();

  return useQuery<Doc<"jobs">[], Error>({
    queryKey: jobsKeys.all,
    queryFn: () => convex.query(api.jobs.list, {}),
    staleTime: 5 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchInterval: 5 * 1000,
    refetchIntervalInBackground: true,
  });
}
