import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

type CreateImageJobArgs = {
  type: "image";
  templateId: string;
  inputUrls: string[];
  aspectRatio: string;
  userInstructions?: string;
};

type CreateVideoJobArgs = {
  templateId: string;
  inputUrls: string[];
  userInstructions?: string;
  duration: number;
  resolution: "1080p";
  aspectRatio: "16:9";
  generateAudio: boolean;
  negativePrompt?: string;
};

type JobCreateResponse = {
  jobId: string;
};

type EdgeJobResponse = {
  jobId?: string;
  id?: string;
  error?: string;
  message?: string;
};

async function getAuthenticatedUserId(): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw new Error(error.message || "Failed to get authenticated user");
  }

  if (!user?.id) {
    throw new Error("User not authenticated");
  }

  return user.id;
}

function extractJobId(data: EdgeJobResponse | string | null | undefined): string {
  if (typeof data === "string" && data.trim()) {
    return data.trim();
  }

  if (data && typeof data === "object") {
    const maybeJobId = String(data.jobId || data.id || "").trim();
    if (maybeJobId) return maybeJobId;

    const maybeError = String(data.error || data.message || "").trim();
    if (maybeError) {
      throw new Error(maybeError);
    }
  }

  throw new Error("Missing jobId from Edge Function");
}

export function useCreateJobMutation() {
  return useMutation<JobCreateResponse, Error, CreateImageJobArgs>({
    mutationKey: ["jobs", "create", "image"],
    mutationFn: async (payload) => {
      const userId = await getAuthenticatedUserId();

      const body = {
        ...payload,
        userId,
      };

      const { data, error } = await supabase.functions.invoke("generate-nano-banana", {
        body,
      });

      if (error) {
        throw new Error(error.message || "Failed to create image job");
      }

      const jobId = extractJobId((data as EdgeJobResponse | string | null) ?? null);

      return { jobId };
    },
  });
}

export function useCreateVideoJobMutation() {
  return useMutation<JobCreateResponse, Error, CreateVideoJobArgs>({
    mutationKey: ["jobs", "create", "video"],
    mutationFn: async () => {
      throw new Error("Video generation is temporarily disabled.");
    },
  });
}