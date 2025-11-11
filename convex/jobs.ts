import { mutation, query, action, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

export const create = mutation({
  args: {
    type: v.union(v.literal("image"), v.literal("video"), v.literal("card")),
    prompt: v.string(),
    inputFileId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Must be logged in");
    }

    // Check user has enough credits (basic cost calculation)
    const baseCost = args.type === "video" ? 20 : 10;
    const userProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!userProfile || userProfile.credits < baseCost) {
      throw new Error("Insufficient credits");
    }

    // Debit credits
    await ctx.db.patch(userProfile._id, {
      credits: userProfile.credits - baseCost,
    });

    // Create job
    const jobId = await ctx.db.insert("jobs", {
      userId,
      type: args.type,
      prompt: args.prompt,
      inputFileId: args.inputFileId,
      status: "queued",
      debited: baseCost,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Schedule processing
    await ctx.scheduler.runAfter(0, internal.jobs.processJob, { jobId });

    return jobId;
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    return await ctx.db
      .query("jobs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const get = query({
  args: { id: v.id("jobs") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Must be logged in");
    }

    const job = await ctx.db.get(args.id);
    if (!job || job.userId !== userId) {
      throw new Error("Job not found");
    }

    return job;
  },
});

export const processJob = internalAction({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    // Update job status to processing
    await ctx.runMutation(internal.jobs.updateStatus, {
      jobId: args.jobId,
      status: "processing",
    });

    try {
      // Get job details
      const job = await ctx.runQuery(internal.jobs.getInternal, {
        jobId: args.jobId,
      });

      if (!job) {
        throw new Error("Job not found");
      }

      // Simulate AI processing (replace with actual AI service call)
      await new Promise(resolve => setTimeout(resolve, 3000));

      // For demo purposes, generate a placeholder result
      const resultUrl = `https://picsum.photos/800/600?random=${Date.now()}`;

      // Update job with result
      await ctx.runMutation(internal.jobs.updateResult, {
        jobId: args.jobId,
        resultUrl,
        status: "done",
      });

    } catch (error) {
      // Update job with error
      await ctx.runMutation(internal.jobs.updateStatus, {
        jobId: args.jobId,
        status: "error",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
});

export const processTemplateJob = internalAction({
  args: { 
    jobId: v.id("jobs"),
    templateId: v.id("templates"),
  },
  handler: async (ctx, args) => {
    // Update job status to processing
    await ctx.runMutation(internal.jobs.updateStatus, {
      jobId: args.jobId,
      status: "processing",
    });

    try {
      // Get job and template details
      const job = await ctx.runQuery(internal.jobs.getInternal, {
        jobId: args.jobId,
      });
      const template = await ctx.runQuery(internal.jobs.getTemplateInternal, {
        templateId: args.templateId,
      });

      if (!job || !template) {
        throw new Error("Job or template not found");
      }

      // Here you would integrate with your AI service (OpenAI, Replicate, etc.)
      // For now, we'll simulate the processing
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Generate a result URL (replace with actual AI-generated image)
      const resultUrl = `https://picsum.photos/800/600?random=${Date.now()}&template=${template.scene}`;

      // Update job with result
      await ctx.runMutation(internal.jobs.updateResult, {
        jobId: args.jobId,
        resultUrl,
        status: "done",
      });

    } catch (error) {
      // Update job with error
      await ctx.runMutation(internal.jobs.updateStatus, {
        jobId: args.jobId,
        status: "error",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
});

// Internal mutations for job processing
export const updateStatus = internalMutation({
  args: {
    jobId: v.id("jobs"),
    status: v.union(v.literal("queued"), v.literal("processing"), v.literal("done"), v.literal("error")),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      status: args.status,
      updatedAt: Date.now(),
      ...(args.errorMessage && { errorMessage: args.errorMessage }),
    });
  },
});

export const updateResult = internalMutation({
  args: {
    jobId: v.id("jobs"),
    resultUrl: v.string(),
    status: v.union(v.literal("done"), v.literal("error")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.jobId, {
      resultUrl: args.resultUrl,
      status: args.status,
      updatedAt: Date.now(),
    });
  },
});

export const getInternal = internalQuery({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.jobId);
  },
});

export const getTemplateInternal = internalQuery({
  args: { templateId: v.id("templates") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.templateId);
  },
});

export const deleteJob = mutation({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Must be logged in");
    }

    const job = await ctx.db.get(args.jobId);
    if (!job || job.userId !== userId) {
      throw new Error("Job not found or not authorized");
    }

    await ctx.db.delete(args.jobId);
    return { success: true };
  },
});
