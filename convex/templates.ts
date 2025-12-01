import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";

// Minimal types/helpers needed by this file
type TemplateSeed = any;

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

async function requireAdmin(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Must be logged in");
  const user = await ctx.db.get(userId);
  const email = (user as any)?.email;
  if (!email || !ADMIN_EMAILS.includes(email)) {
    throw new Error("Admin privileges required");
  }
}

// Query to check if current user is an admin (for frontend auth checks)
export const isAdmin = query({
  args: {},
  handler: async (ctx) => {
    try {
      const userId = await getAuthUserId(ctx);
      if (!userId) return false;

      const user = await ctx.db.get(userId);
      const email = (user as any)?.email;

      return email && ADMIN_EMAILS.includes(email);
    } catch {
      return false;
    }
  },
});

function slugify(title: string) {
  return title
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function sanitizeTemplate(template: Doc<"templates">) {
  return {
    _id: (template as any)._id,
    _creationTime: (template as any)._creationTime,
    slug: slugify((template as any).title || ""),
    title: (template as any).title || "",
    category: (template as any).category || "",
    subCategory: (template as any).subCategory || "",
    occasion: (template as any).occasion || "",
    // Normalize legacy template types to a standardized set for the frontend
    // Legacy values like "photo" or "card" are normalized to "image".
    type: (function () {
      const t = (template as any).type;
      if (!t) return "image";
      if (t === "video") return "video";
      // treat variants ('photo', 'card', etc.) as image
      return "image";
    })(),
    orientation: (template as any).orientation || "portrait",
    aspectRatio: (template as any).aspectRatio || "",
    previewUrl: (template as any).previewUrl || "",
    thumbnailUrl: (template as any).thumbnailUrl || "",
    creditCost: (template as any).creditCost || 0,
    tags: (template as any).tags || [],
    scene: (template as any).scene || "",
    textDefault: (template as any).textDefault || "",
    isActive: (template as any).isActive !== false, // Default to true if undefined
  };
}

export const createFromTemplate = mutation({
  args: {
    templateId: v.id("templates"),
    inputFileId: v.id("_storage"),
    additionalPrompt: v.optional(v.string()),
    aspectRatio: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Must be logged in");
    }

    // Validate additionalPrompt length to reduce prompt injection risk
    if (args.additionalPrompt && args.additionalPrompt.length > 2000) {
      throw new Error("Additional prompt must be less than 2000 characters");
    }

    // Get the template
    const template = await ctx.db.get(args.templateId);
    if (!template) {
      throw new Error("Template not found");
    }

    // Check user has enough credits
    const userProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!userProfile || userProfile.credits < template.creditCost) {
      throw new Error("Insufficient credits");
    }

    // Build the final prompt by merging template base prompt with user input
    // Structure: [Template Base Prompt] + [Custom Text if provided] + [Additional Instructions if provided]
    let finalPrompt = template.prompt;

    // Extract custom text from additionalPrompt if it contains "Include text:"
    let customText = "";
    let additionalInstructions = args.additionalPrompt || "";

    if (additionalInstructions.includes("Include text:")) {
      const textMatch = additionalInstructions.match(
        /Include text:\s*"([^"]+)"/
      );
      if (textMatch && textMatch[1]) {
        customText = textMatch[1];
        // Remove the custom text part from additional instructions
        additionalInstructions = additionalInstructions
          .replace(/Include text:\s*"[^"]+"/, "")
          .trim();
      }
    }

    // Merge prompts in structured format
    if (customText) {
      finalPrompt += ` Include the text "${customText}" in the image.`;
    }

    if (additionalInstructions) {
      finalPrompt += ` Additional instructions: ${additionalInstructions}`;
    }

    // Atomically debit credits and create the job via centralized internal mutation
    const jobId: Id<"jobs"> = await ctx.runMutation(
      (internal as any).atomic.debitCreditsAndCreateJob,
      {
        userId,
        templateId: args.templateId,
        creditCost: template.creditCost,
        inputFileIds: args.inputFileId ? [args.inputFileId] : [],
        prompt: finalPrompt,
        aspectRatio: args.aspectRatio,
        type: "image",
      }
    );

    // Schedule AI generation directly if input file exists
    if (args.inputFileId) {
      await ctx.scheduler.runAfter(0, internal.jobs.generateWithAI, {
        inputFileIds: [args.inputFileId],
        prompt: finalPrompt,
        jobId,
        aspectRatio: args.aspectRatio,
      });
    } else {
      // Fallback: use processTemplateJob for jobs without input files
      await ctx.scheduler.runAfter(0, internal.jobs.processTemplateJob, {
        jobId,
        templateId: args.templateId,
      });
    }

    return {
      jobId,
      status: "queued",
      template: template.title,
      creditsCost: template.creditCost,
    };
  },
});

export const list = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("templates"),
      _creationTime: v.number(),
      slug: v.string(),
      title: v.string(),
      category: v.string(),
      subCategory: v.string(),
      occasion: v.string(),
      type: v.string(),
      orientation: v.union(v.literal("portrait"), v.literal("landscape")),
      aspectRatio: v.string(),
      previewUrl: v.string(),
      thumbnailUrl: v.string(),
      creditCost: v.number(),
      tags: v.array(v.string()),
      scene: v.string(),
      textDefault: v.string(),
      isActive: v.boolean(),
    })
  ),
  handler: async (ctx) => {
    const templates = await ctx.db.query("templates").collect();
    // Filter out inactive templates for public listing
    return templates.filter((t) => t.isActive !== false).map(sanitizeTemplate);
  },
});

export const getByScene = query({
  args: { scene: v.string() },
  handler: async (ctx, args) => {
    const templates = await ctx.db
      .query("templates")
      .withIndex("by_scene", (q) => q.eq("scene", args.scene))
      .collect();
    return templates.map(sanitizeTemplate);
  },
});

export const getById = query({
  args: { id: v.id("templates") },
  handler: async (ctx, args) => {
    const template = await ctx.db.get(args.id);
    if (!template) return null;
    return sanitizeTemplate(template);
  },
});

export const listAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const templates = await ctx.db.query("templates").collect();
    return templates.map((t) => ({
      ...sanitizeTemplate(t),
      prompt: t.prompt, // Include prompt for admin search
      isActive: t.isActive !== false,
    }));
  },
});

// Admin-only query to get complete template data including prompt
export const getByIdAdmin = query({
  args: { id: v.id("templates") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const template = await ctx.db.get(args.id);
    if (!template) return null;

    // Return complete template data without sanitization for admin editing
    return {
      _id: template._id,
      _creationTime: template._creationTime,
      title: template.title,
      category: template.category,
      subCategory: template.subCategory,
      occasion: template.occasion,
      type: template.type,
      orientation: template.orientation,
      previewUrl: template.previewUrl,
      thumbnailUrl: template.thumbnailUrl,
      creditCost: template.creditCost,
      tags: template.tags,
      scene: template.scene,
      textDefault: template.textDefault,
      prompt: template.prompt, // Include the sensitive prompt for admin editing
      // Video-specific fields
      defaultDuration: template.defaultDuration,
      defaultAspectRatio: template.defaultAspectRatio,
      defaultResolution: template.defaultResolution,
      generateAudioDefault: template.generateAudioDefault,
      negativePromptDefault: template.negativePromptDefault,
      isActive: template.isActive,
    };
  },
});

export const clearAll = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const templates = await ctx.db.query("templates").collect();
    for (const template of templates) {
      await ctx.db.delete(template._id);
    }
    return { success: true, deleted: templates.length };
  },
});

// Helper function to get templates by tags
export const getByTags = query({
  args: { tags: v.array(v.string()) },
  handler: async (ctx, args) => {
    const allTemplates = await ctx.db.query("templates").collect();
    const filtered = allTemplates.filter((template) =>
      args.tags.some((tag) => template.tags.includes(tag))
    );
    return filtered.map(sanitizeTemplate);
  },
});

// Get templates by price range
export const getByPriceRange = query({
  args: {
    minCost: v.optional(v.number()),
    maxCost: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let query = ctx.db.query("templates");

    if (args.minCost !== undefined) {
      query = query.filter((q) => q.gte(q.field("creditCost"), args.minCost!));
    }

    if (args.maxCost !== undefined) {
      query = query.filter((q) => q.lte(q.field("creditCost"), args.maxCost!));
    }

    const templates = await query.collect();
    return templates.map(sanitizeTemplate);
  },
});

// Atomic internal mutation to debit credits and create a job (prevents race conditions)
// atomic debit+job creation moved to `convex/atomic.ts` to avoid circular type references

// Create job from template - implemented above as `createFromTemplate`.

// Get templates by orientation
export const getByOrientation = query({
  args: { orientation: v.union(v.literal("portrait"), v.literal("landscape")) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("templates")
      .withIndex("by_orientation", (q) => q.eq("orientation", args.orientation))
      .collect();
  },
});
// Admin CRUD operations - require admin authentication

// Create a new template (admin only)
export const create = mutation({
  args: {
    title: v.string(),
    occasion: v.optional(v.string()),
    category: v.optional(v.string()),
    subCategory: v.optional(v.string()),
    type: v.optional(v.string()),
    scene: v.string(),
    orientation: v.union(v.literal("portrait"), v.literal("landscape")),
    prompt: v.string(),
    textDefault: v.string(),
    creditCost: v.number(),
    tags: v.array(v.string()),
    // File storage IDs (new)
    previewImageId: v.optional(v.id("_storage")),
    thumbnailImageId: v.optional(v.id("_storage")),
    // Video-specific fields
    defaultDuration: v.optional(
      v.union(v.literal(4), v.literal(6), v.literal(8))
    ),
    defaultAspectRatio: v.optional(v.string()),
    defaultResolution: v.optional(
      v.union(v.literal("720p"), v.literal("1080p"))
    ),
    generateAudioDefault: v.optional(v.boolean()),
    negativePromptDefault: v.optional(v.union(v.string(), v.null())),
    // Email notification flag (new)
    sendEmailNotification: v.optional(v.boolean()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    // Convert storage IDs to URLs
    const previewUrl = args.previewImageId
      ? await ctx.storage.getUrl(args.previewImageId)
      : "";
    const thumbnailUrl = args.thumbnailImageId
      ? await ctx.storage.getUrl(args.thumbnailImageId)
      : "";

    // Create template with URLs
    const templateId = await ctx.db.insert("templates", {
      title: args.title,
      occasion: args.occasion || "christmas",
      category: args.category,
      subCategory: args.subCategory,
      type: args.type,
      scene: args.scene,
      orientation: args.orientation,
      previewUrl: previewUrl || "",
      thumbnailUrl: thumbnailUrl || undefined,
      prompt: args.prompt,
      textDefault: args.textDefault,
      creditCost: args.creditCost,
      tags: args.tags,
      defaultDuration: args.defaultDuration,
      defaultAspectRatio: args.defaultAspectRatio,
      defaultResolution: args.defaultResolution,
      generateAudioDefault: args.generateAudioDefault,
      negativePromptDefault: args.negativePromptDefault || undefined,
      isActive: args.isActive !== undefined ? args.isActive : true,
    });

    // Trigger email notification asynchronously (default: true)
    // TODO: Uncomment after Convex regenerates types for internal.emails
    if (args.sendEmailNotification !== false) {
      await ctx.scheduler.runAfter(
        0,
        internal.emailActions.sendNewTemplateNotification,
        {
          templateId,
        }
      );
    }

    return templateId;
  },
});

// Update an existing template (admin only)
export const update = mutation({
  args: {
    id: v.id("templates"),
    title: v.optional(v.string()),
    occasion: v.optional(v.string()),
    category: v.optional(v.string()),
    subCategory: v.optional(v.string()),
    type: v.optional(v.string()),
    scene: v.optional(v.string()),
    orientation: v.optional(
      v.union(v.literal("portrait"), v.literal("landscape"))
    ),
    previewUrl: v.optional(v.string()),
    thumbnailUrl: v.optional(v.string()),
    prompt: v.optional(v.string()),
    textDefault: v.optional(v.string()),
    creditCost: v.optional(v.number()),
    tags: v.optional(v.array(v.string())),
    defaultDuration: v.optional(
      v.union(v.literal(4), v.literal(6), v.literal(8))
    ),
    defaultAspectRatio: v.optional(v.string()),
    defaultResolution: v.optional(
      v.union(v.literal("720p"), v.literal("1080p"))
    ),
    generateAudioDefault: v.optional(v.boolean()),
    negativePromptDefault: v.optional(v.union(v.string(), v.null())),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
    return id;
  },
});

// Delete a template (admin only)
export const deleteTemplate = mutation({
  args: { id: v.id("templates") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    await ctx.db.delete(args.id);
    return { success: true };
  },
});
