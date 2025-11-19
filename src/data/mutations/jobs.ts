import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useConvex } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Doc, Id } from "../../../convex/_generated/dataModel";
import { jobsKeys } from "../queries/jobs";
import { creditsKeys } from "../queries/credits";
import { templateKeys } from "../queries/templates";
import { TemplateSummary } from "@/types/templates";
import { authKeys } from "../queries/auth";

type CreateJobArgs = {
  type: "image";
  inputFileIds: Id<"_storage">[];
  templateId: Id<"templates">;
  aspectRatio?: string;
  userInstructions?: string;
};

type DeleteJobArgs = {
  jobId: Id<"jobs">;
};

export function useCreateJobMutation() {
  const convex = useConvex();
  const queryClient = useQueryClient();

  return useMutation<Id<"jobs">, Error, CreateJobArgs, Record<string, unknown>>(
    {
      mutationKey: ["jobs", "create"],
      mutationFn: async (input) => convex.mutation(api.jobs.create, input),
      onMutate: async (variables) => {
        await Promise.all([
          queryClient.cancelQueries({ queryKey: jobsKeys.all }),
          queryClient.cancelQueries({ queryKey: creditsKeys.all }),
        ]);

        const previousJobs =
          queryClient.getQueryData<Doc<"jobs">[]>(jobsKeys.all) || [];
        const previousCredits = queryClient.getQueryData<number>(
          creditsKeys.all
        );

        const templates =
          queryClient.getQueryData<TemplateSummary[]>(templateKeys.all) || [];
        const template = templates.find(
          (tpl) => tpl._id === variables.templateId
        );

        if (previousCredits !== undefined && template) {
          queryClient.setQueryData(
            creditsKeys.all,
            Math.max(previousCredits - template.creditCost, 0)
          );
        }

        if (previousJobs) {
          const currentUser =
            queryClient.getQueryData<Doc<"users"> | null>(authKeys.me) ?? null;

          const optimisticJob: Doc<"jobs"> = {
            _id: `optimistic-${Date.now()}` as Id<"jobs">,
            _creationTime: Date.now(),
            userId: (currentUser?._id as unknown as string) ?? "pending-user",
            type: variables.type,
            prompt: "Preparing your magical creation...",
            inputFileId: variables.inputFileIds[0],
            status: "queued",
            resultUrl: undefined,
            errorMessage: undefined,
            debited: template?.creditCost,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            templateId: variables.templateId,
            aspectRatio: variables.aspectRatio,
          };

          queryClient.setQueryData<Doc<"jobs">[]>(jobsKeys.all, [
            optimisticJob,
            ...previousJobs,
          ]);
        }

        return { previousJobs, previousCredits };
      },
      onError: (_error, _variables, context) => {
        if (context?.previousJobs) {
          queryClient.setQueryData(jobsKeys.all, context.previousJobs);
        }
        if (context?.previousCredits !== undefined) {
          queryClient.setQueryData(creditsKeys.all, context.previousCredits);
        }
      },
      onSettled: () => {
        void queryClient.invalidateQueries({ queryKey: jobsKeys.all });
        void queryClient.invalidateQueries({ queryKey: creditsKeys.all });
      },
    }
  );
}

export function useDeleteJobMutation() {
  const convex = useConvex();
  const queryClient = useQueryClient();

  return useMutation<
    { success: boolean },
    Error,
    DeleteJobArgs,
    Doc<"jobs">[] | undefined
  >({
    mutationKey: ["jobs", "delete"],
    mutationFn: async (variables) =>
      convex.mutation(api.jobs.deleteJob, variables),
    onMutate: async ({ jobId }) => {
      await queryClient.cancelQueries({ queryKey: jobsKeys.all });
      const previousJobs = queryClient.getQueryData<Doc<"jobs">[]>(
        jobsKeys.all
      );
      if (previousJobs) {
        queryClient.setQueryData<Doc<"jobs">[]>(
          jobsKeys.all,
          previousJobs.filter((job) => job._id !== jobId)
        );
      }
      return previousJobs;
    },
    onError: (_error, _variables, context) => {
      if (context) {
        queryClient.setQueryData(jobsKeys.all, context);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: jobsKeys.all });
    },
  });
}

type CreateVideoJobArgs = {
  templateId: Id<"templates">;
  inputFileIds?: Id<"_storage">[];
  userInstructions?: string;
  duration?: 4 | 6 | 8;
  resolution?: "720p" | "1080p";
  aspectRatio?: string;
  generateAudio?: boolean;
  negativePrompt?: string;
  seed?: number;
};

export function useCreateVideoJobMutation() {
  const convex = useConvex();
  const queryClient = useQueryClient();

  return useMutation<
    { jobId: Id<"jobs"> },
    Error,
    CreateVideoJobArgs,
    Record<string, unknown>
  >({
    mutationKey: ["jobs", "createVideo"],
    mutationFn: async (input) => {
      // convex.mutation returns job id (server-side type may vary)
      const res = await convex.mutation(api.jobs.createVideoJob, input as any);
      // createVideoJob returns an object { jobId, status, creditsDebited, templateTitle }
      return res as { jobId: Id<"jobs"> };
    },
    onMutate: async (variables) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: jobsKeys.all }),
        queryClient.cancelQueries({ queryKey: creditsKeys.all }),
      ]);

      const previousJobs =
        queryClient.getQueryData<Doc<"jobs">[]>(jobsKeys.all) || [];
      const previousCredits = queryClient.getQueryData<number>(creditsKeys.all);

      const templates =
        queryClient.getQueryData<TemplateSummary[]>(templateKeys.all) || [];
      const template = templates.find((t) => t._id === variables.templateId);

      if (previousCredits !== undefined && template) {
        queryClient.setQueryData(
          creditsKeys.all,
          Math.max(previousCredits - template.creditCost, 0)
        );
      }

      if (previousJobs) {
        const currentUser =
          queryClient.getQueryData<Doc<"users"> | null>(authKeys.me) ?? null;
        const optimisticJob: Doc<"jobs"> = {
          _id: `optimistic-video-${Date.now()}` as Id<"jobs">,
          _creationTime: Date.now(),
          userId: (currentUser?._id as unknown as string) ?? "pending-user",
          type: "video",
          prompt: "Preparing your video...",
          inputFileId: variables.inputFileIds?.[0] ?? undefined,
          inputFileIds: variables.inputFileIds as any,
          status: "queued",
          resultUrl: undefined,
          errorMessage: undefined,
          debited: template?.creditCost,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          templateId: variables.templateId,
          aspectRatio: variables.aspectRatio,
        } as unknown as Doc<"jobs">;

        queryClient.setQueryData<Doc<"jobs">[]>(jobsKeys.all, [
          optimisticJob,
          ...previousJobs,
        ]);
      }

      return { previousJobs, previousCredits };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousJobs) {
        queryClient.setQueryData(jobsKeys.all, context.previousJobs);
      }
      if (context?.previousCredits !== undefined) {
        queryClient.setQueryData(creditsKeys.all, context.previousCredits);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: jobsKeys.all });
      void queryClient.invalidateQueries({ queryKey: creditsKeys.all });
    },
  });
}
