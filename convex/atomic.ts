import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Centralized atomic debit+job creation to avoid circular type references
export const debitCreditsAndCreateJob = internalMutation({
  args: {
    userId: v.id("users"),
    templateId: v.optional(v.id("templates")),
    creditCost: v.number(),
    // inputFileIds is optional for backward compatibility (may be undefined or empty array)
    inputFileIds: v.optional(v.array(v.id("_storage"))),
    prompt: v.string(),
    // Keep aspectRatio as a free-form string for backward compatibility in Phase 1.
    aspectRatio: v.optional(v.string()),
    // Allow both image and video types in the atomic creator. This is necessary
    // so the same atomic operation can create either job kind without breaking
    // existing image flows. All video-specific fields are optional and passed
    // through to the jobs table.
    type: v.union(v.literal("image"), v.literal("video")),
    // Video-specific optional fields (all optional to remain backward compatible)
    videoUrl: v.optional(v.union(v.string(), v.null())),
    duration: v.optional(v.union(v.literal(4), v.literal(6), v.literal(8))),
    resolution: v.optional(v.union(v.literal("720p"), v.literal("1080p"))),
    generateAudio: v.optional(v.boolean()),
    negativePrompt: v.optional(v.union(v.string(), v.null())),
    seed: v.optional(v.union(v.number(), v.null())),
    creditBreakdown: v.optional(
      v.object({
        perSecondCost: v.number(),
        seconds: v.number(),
        audioMultiplier: v.number(),
        totalCost: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const userProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();

    if (!userProfile) {
      throw new Error("User profile not found");
    }

    if ((userProfile.credits ?? 0) < args.creditCost) {
      throw new Error("Insufficient credits");
    }

    await ctx.db.patch(userProfile._id, {
      credits: (userProfile.credits ?? 0) - args.creditCost,
    });

    const jobId = await ctx.db.insert("jobs", {
      userId: args.userId,
      type: args.type,
      prompt: args.prompt,
      inputFileId:
        args.inputFileIds && args.inputFileIds.length > 0
          ? args.inputFileIds[0]
          : undefined,
      inputFileIds: args.inputFileIds, // Store the full array for video multi-file support
      status: "queued",
      debited: args.creditCost,
      creditBreakdown: args.creditBreakdown,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      templateId: args.templateId,
      aspectRatio: args.aspectRatio,
      // Store all video-specific fields so the worker can use them
      duration: args.duration,
      resolution: args.resolution,
      generateAudio: args.generateAudio,
      negativePrompt: args.negativePrompt,
      seed: args.seed,
      videoUrl: args.videoUrl,
    });

    return jobId;
  },
});
