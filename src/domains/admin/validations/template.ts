import * as z from "zod";

/**
 * Base schema with all template fields - used for type inference
 */
const templateFieldsSchema = {
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
  previewImageFile: z.any().optional(),
  thumbnailFile: z.any().optional(),
  videoFile: z.any().optional(),
};

/**
 * Schema for creating a new template - all required fields are enforced
 */
export const templateCreateSchema = z.object(templateFieldsSchema);

/**
 * Schema for updating an existing template - all fields are optional
 * This allows partial updates where only changed fields are sent
 */
export const templateUpdateSchema = z.object({
  title: z.string().min(1, "Template title is required").optional(),
  occasion: z.string().optional(),
  category: z.string().optional(),
  subCategory: z.string().optional(),
  type: z.enum(["image", "video"]).optional(),
  scene: z.string().optional(),
  orientation: z.enum(["portrait", "landscape"]).optional(),
  prompt: z.string().optional(),
  textDefault: z.string().optional(),
  creditCost: z.coerce
    .number()
    .min(1, "Credit cost must be at least 1")
    .optional(),
  tags: z.string().optional(),
  // Video specific
  defaultDuration: z.coerce.number().optional(),
  defaultAspectRatio: z.string().optional(),
  defaultResolution: z.string().optional(),
  generateAudioDefault: z.boolean().optional(),
  negativePromptDefault: z.string().optional(),
  isActive: z.boolean().optional(),
  // Files
  previewImageFile: z.any().optional(),
  thumbnailFile: z.any().optional(),
  videoFile: z.any().optional(),
});

// Backwards compatibility - use create schema as default
export const templateFormSchema = templateCreateSchema;

export type TemplateFormValues = z.infer<typeof templateCreateSchema>;
export type TemplateUpdateValues = z.infer<typeof templateUpdateSchema>;
