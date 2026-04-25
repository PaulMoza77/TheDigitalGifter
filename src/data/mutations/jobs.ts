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

type GenerationInsertRow = {
  id: string;
};

type TemplatePromptRow = {
  id: string;
  title: string | null;
  type: string | null;
  occasion: string | null;
  category: string | null;
  prompt: string | null;
  description: string | null;
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

async function getTemplatePrompt(templateId: string): Promise<TemplatePromptRow> {
  const { data, error } = await supabase
    .from("templates")
    .select("id,title,type,occasion,category,prompt,description")
    .eq("id", templateId)
    .maybeSingle<TemplatePromptRow>();

  if (error) {
    throw new Error(error.message || "Failed to load template");
  }

  if (!data?.id) {
    throw new Error("Template not found");
  }

  return data;
}

function buildImagePrompt(input: {
  template: TemplatePromptRow;
  userInstructions?: string;
}) {
  const templatePrompt = String(input.template.prompt ?? "").trim();
  const userInstructions = String(input.userInstructions ?? "").trim();

  const fallbackTemplatePrompt = [
    `Transform the uploaded reference image into a ${input.template.title || "premium digital gift"} design.`,
    input.template.occasion ? `Occasion: ${input.template.occasion}.` : "",
    input.template.category ? `Style/category: ${input.template.category}.` : "",
    "Keep the main subject from the uploaded image clearly recognizable.",
    "Do not replace the uploaded subject with a romantic couple, people, faces, or unrelated characters unless the template explicitly asks for that.",
    "If the uploaded image is a car, keep the car as the main hero subject.",
    "Create a polished, premium digital gift illustration based on the selected template.",
  ]
    .filter(Boolean)
    .join(" ");

  return [templatePrompt || fallbackTemplatePrompt, userInstructions]
    .filter(Boolean)
    .join(" ")
    .trim();
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

      const template = await getTemplatePrompt(payload.templateId);
      const prompt = buildImagePrompt({
        template,
        userInstructions: payload.userInstructions,
      });

      const { data: generation, error: insertError } = await supabase
        .from("generations")
        .insert({
          user_id: user.id,
          source_image_url: sourceImage,
          prompt,
          status: "pending",
          metadata: {
            templateId: payload.templateId,
            templateTitle: template.title,
            templateType: template.type,
            templateOccasion: template.occasion,
            templateCategory: template.category,
            aspectRatio: payload.aspectRatio,
            userInstructions: payload.userInstructions ?? null,
            sourceImageCount: payload.inputUrls.length,
          },
        })
        .select("id")
        .single<GenerationInsertRow>();

      if (insertError || !generation?.id) {
        throw new Error(insertError?.message || "Failed to create generation");
      }

      const { error } = await supabase.functions.invoke("generate-nano-banana", {
        body: {
          generation_id: generation.id,
        },
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (error) {
        throw new Error(error.message || "Failed to create image job");
      }

      return { jobId: generation.id };
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