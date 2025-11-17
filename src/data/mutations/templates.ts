import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useConvex } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { templateKeys } from "../queries/templates";

export function useSeedTemplatesMutation() {
  const convex = useConvex();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["templates", "seed"],
    mutationFn: () => convex.mutation(api.templates.seed, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: templateKeys.all });
    },
  });
}

export function useAddMoreTemplatesMutation() {
  const convex = useConvex();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["templates", "addMore"],
    mutationFn: () => convex.mutation(api.templates.addMoreTemplates, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: templateKeys.all });
    },
  });
}

export function useClearTemplatesMutation() {
  const convex = useConvex();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["templates", "clearAll"],
    mutationFn: () => convex.mutation(api.templates.clearAll, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: templateKeys.all });
    },
  });
}
