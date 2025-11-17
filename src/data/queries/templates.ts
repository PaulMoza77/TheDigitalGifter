import { useQuery } from "@tanstack/react-query";
import { useConvex } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { TemplateSummary } from "@/types/templates";

export const templateKeys = {
  all: ["templates"] as const,
};

export function useTemplatesQuery() {
  const convex = useConvex();

  return useQuery<TemplateSummary[], Error>({
    queryKey: templateKeys.all,
    queryFn: () => convex.query(api.templates.list, {}),
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
