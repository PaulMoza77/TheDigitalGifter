import * as z from "zod";

export const templateFormSchema = z.object({
  title: z.string().min(1, "Template title is required"),
  occasion: z.string().min(1, "Occasion is required"),
  category: z.string(),
  subCategory: z.string().optional(),
  type: z.enum(["image", "video"]),
  scene: z.string(),
  orientation: z.enum(["portrait", "landscape"]),
  prompt: z.string().min(1, "Prompt is required"),
  textDefault: z.string().optional(),
  creditCost: z.coerce.number().min(1, "Credit cost must be at least 1"),
  tags: z.string().optional(),
  // Video specific
  defaultDuration: z.coerce.number().optional(),
  defaultAspectRatio: z.string().optional(),
  defaultResolution: z.string().optional(),
  generateAudioDefault: z.boolean().optional(),
  negativePromptDefault: z.string().optional(),
  isActive: z.boolean().default(true),
  sendEmailNotification: z.boolean().default(true),
  // Files - typed as any for File object since Zod doesn't have a native File type
  // We handle file validation manually in the component based on edit mode
  previewImageFile: z.any().optional(),
  thumbnailFile: z.any().optional(),
  videoFile: z.any().optional(),
});

export type TemplateFormValues = z.infer<typeof templateFormSchema>;
