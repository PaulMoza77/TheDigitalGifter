import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { runVeo3, VeoInput } from "./ai/veo3";

// Robust internal video worker. Mirrors patterns in `generateWithAI`.
export const generateVideoWithAI = internalAction({
  args: { jobId: v.id("jobs") },
  handler: async (ctx, args) => {
    // Helper: normalized error message
    const getErrorMessage = (e: unknown) => {
      if (e instanceof Error) return e.message;
      if (e === null || e === undefined) return "Unknown error";
      if (typeof e === "string") return e;
      // Try to safely stringify objects, handling circular references
      try {
        const seen = new WeakSet();
        return JSON.stringify(
          e,
          (_key, value) => {
            if (value && typeof value === "object") {
              if (seen.has(value)) return "[Circular]";
              seen.add(value);
            }
            return value;
          },
          2
        );
      } catch {
        // Last-resort fallback: show object's class/type
        try {
          if (typeof e === "symbol") return e.toString();
        } catch {}
        return Object.prototype.toString.call(e);
      }
    };

    // Idempotency: fetch job and bail out if already processed
    const job = await ctx.runQuery((internal as any).jobs.getInternal, {
      jobId: args.jobId,
    });
    if (!job) {
      console.warn("[generateVideoWithAI] Job not found, exiting", {
        jobId: args.jobId,
      });
      return;
    }

    // Only process if queued (this makes worker idempotent)
    if (job.status !== "queued") {
      console.log(
        "[generateVideoWithAI] Job already processed or in-progress",
        {
          jobId: args.jobId,
          status: job.status,
        }
      );
      // If result already exists, ensure result URL is refreshed
      if (job.resultUrl) {
        try {
          await ctx.runMutation((internal as any).jobs.updateResult, {
            jobId: args.jobId,
            resultUrl: job.resultUrl,
            status: "done",
          });
        } catch {
          // ignore
        }
      }
      return;
    }

    // Move to processing
    await ctx.runMutation((internal as any).jobs.updateStatus, {
      jobId: args.jobId,
      status: "processing",
    });

    // Fetch template securely
    const template = job.templateId
      ? await ctx.runQuery((internal as any).jobs.getTemplateInternal, {
          templateId: job.templateId,
        })
      : null;

    // Build final prompt: prefer server-composed `job.prompt` (createVideoJob already composes it)
    const sanitize = (s: string) =>
      s
        .split("")
        .map((ch) => {
          const code = ch.charCodeAt(0);
          return (code >= 0 && code <= 31) || code === 127 ? " " : ch;
        })
        .join("")
        .trim()
        .slice(0, 4000);
    const finalPrompt = sanitize(String(job.prompt || template?.prompt || ""));

    // Prepare input file IDs (support both new and legacy shapes)
    const inputFileIds =
      job.inputFileIds && Array.isArray(job.inputFileIds)
        ? job.inputFileIds
        : job.inputFileId
          ? [job.inputFileId]
          : [];

    // Validate: allow 0-3 images (0 = T2V mode, 1-3 = R2V mode)
    if (inputFileIds.length > 3) {
      const msg =
        "Too many images uploaded. Only up to 3 images are supported.";
      console.warn("[generateVideoWithAI]", {
        jobId: args.jobId,
        msg,
        count: inputFileIds.length,
      });
      await ctx.runMutation((internal as any).jobs.updateStatus, {
        jobId: args.jobId,
        status: "error",
        errorMessage: msg,
      });
      // Refund credits if debited
      if (job.debited && job.debited > 0) {
        await ctx.runMutation((internal as any).credits.refundCreditsByUserId, {
          userId: job.userId,
          amount: job.debited,
        });
      }
      return;
    }

    // Fetch signed URLs for all provided storage IDs (if any)
    const referenceImageUrls: string[] = [];
    for (const storageId of inputFileIds) {
      try {
        const url = await ctx.storage.getUrl(storageId);
        if (url) referenceImageUrls.push(url);
      } catch (e) {
        console.error(
          "[generateVideoWithAI] Failed to get reference image URL",
          {
            jobId: args.jobId,
            storageId,
            err: getErrorMessage(e),
          }
        );
      }
    }

    // Build unified input: use reference_images if provided (R2V), otherwise T2V
    const veoInput: VeoInput = {
      prompt: finalPrompt,
      // Enforce Veo 3.1 R2V requirements
      duration: 8,
      resolution: job.resolution !== undefined ? job.resolution : "1080p",
      aspect_ratio: "16:9",
      generate_audio:
        job.generateAudio !== undefined ? Boolean(job.generateAudio) : true,
      reference_images: referenceImageUrls,
      negative_prompt: job.negativePrompt ?? null,
      seed: job.seed ?? null,
    };

    console.log(
      referenceImageUrls.length > 0
        ? "[generateVideoWithAI] Using reference-to-video mode (R2V)"
        : "[generateVideoWithAI] Using text-to-video mode (T2V)",
      { jobId: args.jobId, referenceCount: referenceImageUrls.length }
    );

    // Log the values being sent to VEO-3 for debugging
    console.log("[generateVideoWithAI] Veo 3.1 input settings:", {
      duration: veoInput.duration,
      resolution: veoInput.resolution,
      aspect_ratio: veoInput.aspect_ratio,
      generate_audio: veoInput.generate_audio,
      referenceImages: veoInput.reference_images?.length ?? 0,
      fromJob: {
        duration: job.duration,
        resolution: job.resolution,
        aspectRatio: job.aspectRatio,
        generateAudio: job.generateAudio,
      },
    });

    try {
      const result = await runVeo3(veoInput);

      if (!result.success) {
        // Permanent vs recoverable
        const msg = result.error || "Unknown video generation error";
        console.error("[generateVideoWithAI] Replicate error", {
          jobId: args.jobId,
          error: msg,
          recoverable: result.recoverable,
        });

        // Mark job error and refund
        await ctx.runMutation((internal as any).jobs.updateStatus, {
          jobId: args.jobId,
          status: "error",
          errorMessage: msg,
        });

        if (job.debited && job.debited > 0) {
          await ctx.runMutation(
            (internal as any).credits.refundCreditsByUserId,
            {
              userId: job.userId,
              amount: job.debited,
            }
          );
          console.log("[generateVideoWithAI] Credits refunded due to error", {
            jobId: args.jobId,
            userId: job.userId,
            amount: job.debited,
          });
        }
        return;
      }

      // result.success === true; expect a URL
      const outputUrl = result.url;
      // If outputUrl doesn't look like an http URL, treat as runId or unexpected; store runId on job and leave processing
      if (!/^https?:\/\//i.test(outputUrl)) {
        console.warn(
          "[generateVideoWithAI] Replicate returned non-URL (runId?), storing runId and exiting",
          { jobId: args.jobId, runId: outputUrl }
        );
        // Store run id on job metadata (best-effort)
        try {
          await ctx.runMutation((internal as any).jobs.updateResult, {
            jobId: args.jobId,
            resultUrl: String(outputUrl),
            status: "processing",
          });
        } catch {
          // ignore
        }
        return;
      }

      // Download the resulting video and upload to Convex storage
      const resp = await fetch(outputUrl);
      if (!resp.ok)
        throw new Error(
          `Failed to download video: ${resp.status} ${resp.statusText}`
        );

      const blob = await resp.blob();
      const contentType = resp.headers.get("content-type") || "video/mp4";

      // Generate upload URL (server-side storage API)
      const uploadUrl = await ctx.storage.generateUploadUrl();

      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": contentType },
        body: blob,
      });

      if (!uploadResponse.ok) {
        const errText = await uploadResponse
          .text()
          .catch(() => "Unknown upload error");
        throw new Error(`Failed to upload video to storage: ${errText}`);
      }

      const uploadJson = (await uploadResponse.json()) as {
        storageId?: string;
      };
      const storageId = uploadJson.storageId as any;
      if (!storageId)
        throw new Error("Storage upload did not return storageId");

      const storedUrl = await ctx.storage.getUrl(storageId);
      if (!storedUrl) throw new Error("Failed to get URL for stored video");

      // Persist the result via existing mutation (sets status=done)
      await ctx.runMutation((internal as any).jobs.storeJobResult, {
        jobId: args.jobId,
        resultStorageId: storageId,
        resultUrl: storedUrl,
      });

      console.log("[generateVideoWithAI] Video job completed", {
        jobId: args.jobId,
        storageId,
        url: storedUrl,
      });
    } catch (error) {
      const msg = getErrorMessage(error);
      console.error("[generateVideoWithAI] Unexpected failure", {
        jobId: args.jobId,
        error: msg,
      });

      // Update job as error and refund if needed
      try {
        await ctx.runMutation((internal as any).jobs.updateStatus, {
          jobId: args.jobId,
          status: "error",
          errorMessage: msg,
        });
      } catch {
        // ignore
      }

      if (job.debited && job.debited > 0) {
        try {
          await ctx.runMutation(
            (internal as any).credits.refundCreditsByUserId,
            {
              userId: job.userId,
              amount: job.debited,
            }
          );
          console.log(
            "[generateVideoWithAI] Credits refunded after unexpected failure",
            { jobId: args.jobId, userId: job.userId, amount: job.debited }
          );
        } catch (e) {
          console.error("[generateVideoWithAI] Refund failed", {
            jobId: args.jobId,
            error: getErrorMessage(e),
          });
        }
      }
    }
  },
});
