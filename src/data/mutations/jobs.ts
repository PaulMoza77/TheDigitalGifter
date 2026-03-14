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

type GenerationInsertRow = {
  id: string;
};

async function getAuthenticatedUser() {
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

  return user;
}

async function getAccessToken(): Promise<string> {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    throw new Error(error.message || "Failed to get session");
  }

  const token = session?.access_token?.trim();
  if (!token) {
    throw new Error("Missing access token");
  }

  return token;
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
      const user = await getAuthenticatedUser();
      const accessToken = await getAccessToken();

      const sourceImage = payload.inputUrls?.[0]?.trim() ?? "";

      if (!sourceImage) {
        throw new Error("Missing source image");
      }

      const { data: generation, error: insertError } = await supabase
        .from("generations")
        .insert({
          user_id: user.id,
          source_image_url: sourceImage,
          prompt: payload.userInstructions ?? "",
          status: "pending",
          metadata: {
            templateId: payload.templateId,
            aspectRatio: payload.aspectRatio,
          },
        })
        .select("id")
        .single<GenerationInsertRow>();

      if (insertError || !generation?.id) {
        throw new Error(insertError?.message || "Failed to create generation");
      }

      const body = {
        generation_id: generation.id,
      };

      const { data, error } = await supabase.functions.invoke("generate-nano-banana", {
        body,
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (error) {
        throw new Error(error.message || "Failed to create image job");
      }

      const jobId = extractJobId(
        (data as EdgeJobResponse | string | null) ?? generation.id
      );

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