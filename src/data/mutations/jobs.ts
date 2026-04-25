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
    .select("id,title,type,occasion,category,prompt")
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
  const templateTitle = String(input.template.title ?? "").trim();
  const templatePrompt = String(input.template.prompt ?? "").trim();
  const occasion = String(input.template.occasion ?? "").trim();
  const category = String(input.template.category ?? "").trim();
  const userInstructions = String(input.userInstructions ?? "").trim();

  return [
    "Use the uploaded image as the main reference image.",
    "Preserve the exact main subject from the uploaded image.",
    "The final image must be a transformation of the uploaded image, not a new unrelated image.",
    "Keep the subject identity, shape, proportions, color, and key visual details recognizable.",
    "Do not replace the uploaded subject with people, couples, faces, animals, or unrelated objects.",
    "If the uploaded image contains a car, the final image must still show that same car as the main hero subject.",
    "If the uploaded image contains a product/object, keep that product/object as the central subject.",
    templateTitle ? `Apply the selected template style: ${templateTitle}.` : "",
    occasion ? `Occasion/theme: ${occasion}.` : "",
    category ? `Visual category/style: ${category}.` : "",
    templatePrompt ? `Template instructions: ${templatePrompt}.` : "",
    "Add only background, lighting, textures, decorations, atmosphere, and framing that match the selected template.",
    "Do not add romantic couples, wedding characters, human portraits, or love-card elements unless explicitly requested by the selected template.",
    "Create a polished premium digital gift artwork while keeping the uploaded subject dominant and clearly recognizable.",
    userInstructions ? `Additional user instructions: ${userInstructions}.` : "",
  ]
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
            templatePrompt: template.prompt,
            aspectRatio: payload.aspectRatio,
            userInstructions: payload.userInstructions ?? null,
            sourceImageCount: payload.inputUrls.length,
            promptMode: "template_style_transfer_preserve_subject",
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