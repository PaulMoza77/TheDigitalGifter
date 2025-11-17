import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Centralized atomic debit+job creation to avoid circular type references
export const debitCreditsAndCreateJob = internalMutation({
  args: {
    userId: v.id("users"),
    templateId: v.optional(v.id("templates")),
    creditCost: v.number(),
    inputFileIds: v.array(v.id("_storage")),
    prompt: v.string(),
    aspectRatio: v.optional(v.string()),
    type: v.literal("image"),
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
        args.inputFileIds.length > 0 ? args.inputFileIds[0] : undefined,
      status: "queued",
      debited: args.creditCost,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      templateId: args.templateId,
      aspectRatio: args.aspectRatio,
    });

    return jobId;
  },
});
