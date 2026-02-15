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
  duration: number; // ex 8
  resolution: "1080p";
  aspectRatio: "16:9";
  generateAudio: boolean;
  negativePrompt?: string;
};

type JobCreateResponse = {
  jobId: string;
};

export function useCreateJobMutation() {
  return useMutation<JobCreateResponse, Error, CreateImageJobArgs>({
    mutationKey: ["jobs", "create", "image"],
    mutationFn: async (payload) => {
      // ✅ Aici chemi backend-ul tău (Edge Function / API)
      // IMPORTANT: schimbă numele funcției dacă ai altul
      const { data, error } = await supabase.functions.invoke("create-image-job", {
        body: payload,
      });

      if (error) throw new Error(error.message || "Failed to create image job");
      const jobId = (data as any)?.jobId ?? (data as any)?.id ?? data;
      if (!jobId) throw new Error("Missing jobId from create-image-job");

      return { jobId: String(jobId) };
    },
  });
}

export function useCreateVideoJobMutation() {
  return useMutation<JobCreateResponse, Error, CreateVideoJobArgs>({
    mutationKey: ["jobs", "create", "video"],
    mutationFn: async (payload) => {
      const { data, error } = await supabase.functions.invoke("create-video-job", {
        body: payload,
      });

      if (error) throw new Error(error.message || "Failed to create video job");
      const jobId = (data as any)?.jobId ?? (data as any)?.id ?? data;
      if (!jobId) throw new Error("Missing jobId from create-video-job");

      return { jobId: String(jobId) };
    },
  });
}