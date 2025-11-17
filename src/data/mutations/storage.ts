import { useMutation } from "@tanstack/react-query";
import { useConvex } from "convex/react";
import { api } from "../../../convex/_generated/api";

export function useGenerateUploadUrlMutation() {
  const convex = useConvex();

  return useMutation<string, Error>({
    mutationKey: ["storage", "generateUploadUrl"],
    mutationFn: async () => {
      const result = await convex.mutation(api.storage.generateUploadUrl, {});
      return result;
    },
  });
}
