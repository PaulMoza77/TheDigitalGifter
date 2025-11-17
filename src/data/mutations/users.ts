import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useConvex } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { userKeys } from "../queries/users";
import { creditsKeys } from "../queries/credits";

type EnsureUserProfileArgs = {
  userId: string;
};

export function useEnsureUserProfileMutation() {
  const convex = useConvex();
  const queryClient = useQueryClient();

  return useMutation<string, Error, EnsureUserProfileArgs>({
    mutationKey: ["users", "ensureProfile"],
    mutationFn: async (variables) =>
      convex.mutation(api.users.ensureUserProfile, variables),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({
        queryKey: userKeys.profile(variables.userId),
      });
      void queryClient.invalidateQueries({ queryKey: creditsKeys.all });
    },
  });
}
