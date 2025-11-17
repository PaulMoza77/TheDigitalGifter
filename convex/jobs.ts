import {
  mutation,
  query,
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { generateImageFromStorage } from "./ai/replicate";
import { Id } from "./_generated/dataModel";

// Atomic internal mutation to debit credits and create a job (prevents race conditions)
// Atomic debit+job creation moved to `convex/atomic.ts` to avoid circular type references

export const create = mutation({
  args: {
    type: v.literal("image"),
    inputFileIds: v.array(v.id("_storage")),
    templateId: v.id("templates"), // Required - backend is source of truth
    aspectRatio: v.optional(v.string()),
    userInstructions: v.optional(v.string()), // User's custom instructions (merged with template prompt on backend)
    // Legacy fields removed for security:
    // - prompt: removed (client should never send prompts)
    // - creditCost: removed (always use database template's creditCost)
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Must be logged in");
    }

    // Load template from database - this is the single source of truth
    const template = await ctx.db.get(args.templateId);
    if (!template) {
      throw new Error("Template not found");
    }

    // Validate user instructions length (prevent prompt injection attacks)
    if (args.userInstructions && args.userInstructions.length > 2000) {
      throw new Error("User instructions too long. Maximum 2000 characters.");
    }

    // Merge template prompt with user instructions securely on backend
    let finalPrompt = template.prompt;
    if (args.userInstructions && args.userInstructions.trim()) {
      finalPrompt += ` Additional instructions: ${args.userInstructions.trim()}`;
    }

    // Use template's credit cost from database (never trust client)
    const creditCost = template.creditCost;

    const userProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!userProfile || userProfile.credits < creditCost) {
      throw new Error("Insufficient credits");
    }
    // Atomically debit credits and create the job via internal mutation
    const jobId: Id<"jobs"> = await ctx.runMutation(
      internal.atomic.debitCreditsAndCreateJob,
      {
        userId,
        templateId: args.templateId,
        creditCost,
        inputFileIds: args.inputFileIds,
        prompt: finalPrompt,
        aspectRatio: args.aspectRatio,
        type: args.type,
      }
    );

    // Schedule AI generation if input files exist, otherwise use processJob fallback
    if (args.inputFileIds.length > 0) {
      await ctx.scheduler.runAfter(0, internal.jobs.generateWithAI, {
        inputFileIds: args.inputFileIds,
        prompt: finalPrompt, // Use merged prompt from backend
        jobId,
        aspectRatio: args.aspectRatio,
      });
    } else {
      await ctx.scheduler.runAfter(0, internal.jobs.processJob, { jobId });
    }

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

    let job;
    try {
      // Get job details
      job = await ctx.runQuery(internal.jobs.getInternal, {
        jobId: args.jobId,
      });

      if (!job) {
        throw new Error("Job not found");
      }

      // If job has inputFileId, use AI generation
      if (job.inputFileId) {
        await ctx.runAction(internal.jobs.generateWithAI, {
          inputFileIds: [job.inputFileId], // Convert single file to array
          prompt: job.prompt,
          jobId: args.jobId,
        });
      } else {
        // Fallback: simulate AI processing for jobs without input files
        await new Promise((resolve) => setTimeout(resolve, 3000));
        const resultUrl = `https://picsum.photos/800/600?random=${Date.now()}`;
        await ctx.runMutation(internal.jobs.updateResult, {
          jobId: args.jobId,
          resultUrl,
          status: "done",
        });
      }
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      console.error("[processJob] Job processing failed", {
        jobId: args.jobId,
        error: errorMessage,
      });

      // Update job with error status
      await ctx.runMutation(internal.jobs.updateStatus, {
        jobId: args.jobId,
        status: "error",
        errorMessage,
      });

      // Refund credits if job had debited credits
      if (job?.debited && job.debited > 0) {
        await ctx.runMutation(internal.credits.refundCreditsByUserId, {
          userId: job.userId,
          amount: job.debited,
        });
        console.log("[processJob] Credits refunded", {
          jobId: args.jobId,
          userId: job.userId,
          amount: job.debited,
        });
      }
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

    let job;
    try {
      // Get job and template details
      job = await ctx.runQuery(internal.jobs.getInternal, {
        jobId: args.jobId,
      });
      const template = await ctx.runQuery(internal.jobs.getTemplateInternal, {
        templateId: args.templateId,
      });

      if (!job || !template) {
        throw new Error("Job or template not found");
      }

      // Use AI generation if input files exist
      // Get inputFileIds from job (backward compatibility: use inputFileId if exists)
      const inputFileIds =
        (job as any).inputFileIds || (job.inputFileId ? [job.inputFileId] : []);
      if (inputFileIds.length > 0) {
        // Combine template prompt with job prompt
        const combinedPrompt = `${template.prompt}. ${job.prompt}`;
        await ctx.runAction(internal.jobs.generateWithAI, {
          inputFileIds: inputFileIds,
          prompt: combinedPrompt,
          jobId: args.jobId,
          aspectRatio: job.aspectRatio,
        });
      } else {
        // Fallback: simulate processing for jobs without input files
        await new Promise((resolve) => setTimeout(resolve, 5000));
        const resultUrl = `https://picsum.photos/800/600?random=${Date.now()}&template=${template.scene}`;
        await ctx.runMutation(internal.jobs.updateResult, {
          jobId: args.jobId,
          resultUrl,
          status: "done",
        });
      }
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      console.error("[processTemplateJob] Job processing failed", {
        jobId: args.jobId,
        error: errorMessage,
      });

      // Update job with error status
      await ctx.runMutation(internal.jobs.updateStatus, {
        jobId: args.jobId,
        status: "error",
        errorMessage,
      });

      // Refund credits if job had debited credits
      if (job?.debited && job.debited > 0) {
        await ctx.runMutation(internal.credits.refundCreditsByUserId, {
          userId: job.userId,
          amount: job.debited,
        });
        console.log("[processTemplateJob] Credits refunded", {
          jobId: args.jobId,
          userId: job.userId,
          amount: job.debited,
        });
      }
    }
  },
});

// Internal mutations for job processing
export const updateStatus = internalMutation({
  args: {
    jobId: v.id("jobs"),
    status: v.union(
      v.literal("queued"),
      v.literal("processing"),
      v.literal("done"),
      v.literal("error")
    ),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      throw new Error(`Job not found: ${args.jobId}`);
    }

    await ctx.db.patch(args.jobId, {
      status: args.status,
      updatedAt: Date.now(),
      ...(args.errorMessage && { errorMessage: args.errorMessage }),
    });

    // If status is error and job has debited credits, refund them
    if (args.status === "error" && job.debited && job.debited > 0) {
      // Refund credits asynchronously via action to avoid blocking
      // The refund will be handled by the calling action
      console.log(
        `[updateStatus] Job ${args.jobId} marked as error, credits will be refunded`,
        {
          userId: job.userId,
          debited: job.debited,
        }
      );
    }
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

/**
 * Internal mutation to store job result with storage ID
 * Used when result is stored in Convex storage
 */
export const storeJobResult = internalMutation({
  args: {
    jobId: v.id("jobs"),
    resultStorageId: v.optional(v.id("_storage")),
    resultUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      throw new Error(`Job not found: ${args.jobId}`);
    }

    let finalResultUrl = args.resultUrl;

    // If storage ID provided, get the URL
    if (args.resultStorageId && !finalResultUrl) {
      finalResultUrl =
        (await ctx.storage.getUrl(args.resultStorageId)) ?? undefined;
    }

    if (!finalResultUrl) {
      throw new Error("No result URL or storage ID provided");
    }

    await ctx.db.patch(args.jobId, {
      resultUrl: finalResultUrl,
      status: "done",
      updatedAt: Date.now(),
    });

    console.log(`[storeJobResult] Job ${args.jobId} result stored`, {
      resultUrl: finalResultUrl,
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

/**
 * Migration: Update all existing jobs with type "card" or "video" to "image"
 * This fixes schema validation errors after removing card/video types
 */
export const migrateJobTypes = mutation({
  args: {},
  returns: v.object({
    updated: v.number(),
  }),
  handler: async (ctx) => {
    const allJobs = await ctx.db.query("jobs").collect();
    let updated = 0;

    for (const job of allJobs) {
      // TypeScript might complain, but we need to check the actual value
      const jobType = (job as any).type;
      if (jobType === "card" || jobType === "video") {
        await ctx.db.patch(job._id, {
          type: "image" as const,
        });
        updated++;
      }
    }

    return { updated };
  },
});

/**
 * Helper function to extract error message from unknown error type
 * Matches the frontend getErrorMessage utility for consistency
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "Unknown error occurred";
}

/**
 * Downloads an image from a URL and uploads it to Convex storage
 */
async function downloadAndStoreImage(
  ctx: { storage: { generateUploadUrl: () => Promise<string> } },
  imageUrl: string
): Promise<Id<"_storage">> {
  // Download the image
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to download image: ${imageResponse.statusText}`);
  }

  const imageBlob = await imageResponse.blob();
  const contentType = imageResponse.headers.get("content-type") || "image/jpeg";

  // Generate upload URL
  const uploadUrl = await ctx.storage.generateUploadUrl();

  // Upload to Convex storage
  const uploadResponse = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": contentType },
    body: imageBlob,
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text().catch(() => "Unknown error");
    throw new Error(`Failed to upload image to storage: ${errorText}`);
  }

  const { storageId } = (await uploadResponse.json()) as {
    storageId: Id<"_storage">;
  };
  return storageId;
}

/**
 * Internal action to generate AI image using Replicate
 * Downloads result and stores it in Convex storage, then updates job record
 */
export const generateWithAI = internalAction({
  args: {
    inputFileIds: v.array(v.id("_storage")),
    prompt: v.string(),
    jobId: v.id("jobs"),
    aspectRatio: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Update job status to processing
    await ctx.runMutation(internal.jobs.updateStatus, {
      jobId: args.jobId,
      status: "processing",
    });

    let job;
    try {
      // Get job to access userId for potential credit refund
      job = await ctx.runQuery(internal.jobs.getInternal, {
        jobId: args.jobId,
      });

      if (!job) {
        throw new Error("Job not found");
      }

      // Get aspect ratio from job if not provided
      let aspectRatio = args.aspectRatio;
      if (!aspectRatio && job.aspectRatio) {
        aspectRatio = job.aspectRatio;
      }

      // Generate AI image using Replicate with multiple input images
      const outputImageUrl = await generateImageFromStorage(
        ctx,
        args.inputFileIds,
        args.prompt,
        aspectRatio,
        "jpg"
      );

      console.log("[generateWithAI] AI generation completed", {
        jobId: args.jobId,
        outputUrl: outputImageUrl,
      });

      // Download and store the result image in Convex storage
      const resultStorageId = await downloadAndStoreImage(ctx, outputImageUrl);

      // Get the storage URL for the result
      const resultUrl = await ctx.storage.getUrl(resultStorageId);
      if (!resultUrl) {
        throw new Error("Failed to get URL for stored result image");
      }

      // Store job result using the new mutation
      await ctx.runMutation(internal.jobs.storeJobResult, {
        jobId: args.jobId,
        resultStorageId,
        resultUrl,
      });

      console.log("[generateWithAI] Job updated successfully", {
        jobId: args.jobId,
        resultStorageId,
        resultUrl,
      });
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      console.error("[generateWithAI] Generation failed", {
        jobId: args.jobId,
        error: errorMessage,
      });

      // Update job with error status
      await ctx.runMutation(internal.jobs.updateStatus, {
        jobId: args.jobId,
        status: "error",
        errorMessage,
      });

      // Refund credits if job had debited credits
      if (job?.debited && job.debited > 0) {
        await ctx.runMutation(internal.credits.refundCreditsByUserId, {
          userId: job.userId,
          amount: job.debited,
        });
        console.log("[generateWithAI] Credits refunded", {
          jobId: args.jobId,
          userId: job.userId,
          amount: job.debited,
        });
      }
    }
  },
});
