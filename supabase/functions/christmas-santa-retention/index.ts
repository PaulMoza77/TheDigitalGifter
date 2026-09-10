import { optionsResponse, jsonResponse } from "../_shared/cors.ts";
import { getServiceClient, isServiceRoleRequest, readJson } from "../_shared/supabase.ts";
import {
  SANTA_FINAL_VIDEO_RETENTION_DAYS,
  SANTA_INTERMEDIATE_RETENTION_DAYS,
  SANTA_PERSONALIZATION_RETENTION_DAYS,
  santaFinalStorageTargets,
  santaIntermediateStorageTargets,
  santaPersonalizationRedaction,
  santaRetentionDue,
  type SantaRetentionJob,
} from "../_shared/christmas/santaOps.ts";

/**
 * Daily Santa retention sweep (service-role / cron secret).
 * Deletes order-scoped intermediates, redacts child PII, then the final MP4.
 * Never touches shared template stills. Never invents prices or enables checkout.
 */

type Body = {
  action?: string;
  dry_run?: boolean;
  limit?: number;
};

function asString(value: unknown): string {
  return String(value ?? "").trim();
}

function cronAuthorized(req: Request): boolean {
  const secret = asString(
    Deno.env.get("CHRISTMAS_SANTA_CRON_SECRET") ||
      Deno.env.get("PET_ANALYTICS_CRON_SECRET") ||
      Deno.env.get("CRON_SECRET"),
  );
  if (!secret) return false;
  const header = asString(req.headers.get("x-cron-secret") || req.headers.get("x-christmas-santa-cron-secret"));
  if (header && header === secret) return true;
  const auth = asString(req.headers.get("Authorization")).replace(/^Bearer\s+/i, "");
  return Boolean(auth && auth === secret);
}

function policyDays() {
  const num = (name: string, fallback: number) => {
    const raw = Number(Deno.env.get(name) || fallback);
    return Number.isFinite(raw) && raw > 0 ? raw : fallback;
  };
  return {
    intermediateDays: num("CHRISTMAS_SANTA_INTERMEDIATE_RETENTION_DAYS", SANTA_INTERMEDIATE_RETENTION_DAYS),
    personalizationDays: num("CHRISTMAS_SANTA_PERSONALIZATION_RETENTION_DAYS", SANTA_PERSONALIZATION_RETENTION_DAYS),
    finalDays: num("CHRISTMAS_SANTA_RETENTION_DAYS", SANTA_FINAL_VIDEO_RETENTION_DAYS),
  };
}

async function removeStorage(
  service: ReturnType<typeof getServiceClient>,
  targets: Array<{ bucket: string; path: string }>,
): Promise<string[]> {
  const removed: string[] = [];
  const byBucket = new Map<string, string[]>();
  for (const t of targets) {
    const list = byBucket.get(t.bucket) || [];
    list.push(t.path);
    byBucket.set(t.bucket, list);
  }
  for (const [bucket, paths] of byBucket) {
    const { error } = await service.storage.from(bucket).remove(paths);
    if (error) {
      // Missing objects are success for idempotent retention.
      const msg = String(error.message || "").toLowerCase();
      if (!msg.includes("not found") && !msg.includes("does not exist")) {
        throw error;
      }
    }
    for (const path of paths) removed.push(`${bucket}/${path}`);
  }
  return removed;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST" && req.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }
  if (!isServiceRoleRequest(req) && !cronAuthorized(req)) {
    return jsonResponse({ error: "Forbidden" }, 403);
  }

  try {
    const url = new URL(req.url);
    const body = req.method === "POST" ? await readJson<Body>(req) : {};
    const dryRun =
      body.dry_run === true ||
      url.searchParams.get("dry_run") === "1" ||
      url.searchParams.get("dry_run") === "true";
    const limitRaw = Number(body.limit || url.searchParams.get("limit") || 25);
    const limit = Math.min(50, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 25));
    const policy = policyDays();
    const now = new Date();
    const service = getServiceClient();

    const { data: jobs, error } = await service
      .from("christmas_santa_video_jobs")
      .select(
        "id,order_id,completed_at,created_at,retention_delete_after,intermediates_purge_after,personalization_purge_after,intermediates_purged_at,personalization_purged_at,final_purged_at,source_audio_path,source_audio_bucket,santa_still_path,santa_still_bucket,result_video_path,result_video_bucket,result_asset_id,metadata",
      )
      .or("final_purged_at.is.null,personalization_purged_at.is.null,intermediates_purged_at.is.null")
      .order("created_at", { ascending: true })
      .limit(200);
    if (error) throw error;

    const dueJobs = ((jobs || []) as SantaRetentionJob[])
      .map((job) => ({ job, due: santaRetentionDue(job, now, policy) }))
      .filter((row) => row.due.intermediates || row.due.personalization || row.due.finalVideo)
      .slice(0, limit);

    const results: Array<Record<string, unknown>> = [];
    for (const { job, due } of dueJobs) {
      const actions: string[] = [];
      const removed: string[] = [];
      if (dryRun) {
        if (due.intermediates) actions.push("intermediates");
        if (due.personalization) actions.push("personalization");
        if (due.finalVideo) actions.push("final_video");
        results.push({
          order_id: job.order_id,
          dry_run: true,
          actions,
          intermediate_targets: santaIntermediateStorageTargets(job),
          final_targets: due.finalVideo ? santaFinalStorageTargets(job) : [],
        });
        continue;
      }

      const nowIso = now.toISOString();
      const meta =
        typeof (job as { metadata?: unknown }).metadata === "object" &&
          (job as { metadata?: Record<string, unknown> }).metadata
          ? { ...(job as { metadata: Record<string, unknown> }).metadata }
          : {};

      if (due.intermediates || due.finalVideo) {
        const targets = due.finalVideo
          ? santaFinalStorageTargets(job)
          : santaIntermediateStorageTargets(job);
        removed.push(...(await removeStorage(service, targets)));
        actions.push(due.finalVideo ? "final_video" : "intermediates");
      }

      if (due.personalization) {
        await service
          .from("christmas_santa_personalization")
          .update(santaPersonalizationRedaction())
          .eq("order_id", job.order_id);
        actions.push("personalization");
      }

      const jobPatch: Record<string, unknown> = {
        metadata: {
          ...meta,
          retention: {
            last_run_at: nowIso,
            actions,
            removed,
            dry_run: false,
          },
        },
      };
      if (due.intermediates || due.finalVideo) {
        jobPatch.intermediates_purged_at = nowIso;
        jobPatch.source_audio_path = null;
        jobPatch.santa_still_path = null;
      }
      if (due.personalization) {
        jobPatch.personalization_purged_at = nowIso;
      }
      if (due.finalVideo) {
        jobPatch.final_purged_at = nowIso;
        jobPatch.result_video_path = null;
        jobPatch.result_asset_id = null;
      }
      await service.from("christmas_santa_video_jobs").update(jobPatch).eq("order_id", job.order_id);

      if (due.finalVideo && job.result_asset_id) {
        await service.from("christmas_order_assets").delete().eq("id", job.result_asset_id);
        await service
          .from("christmas_orders")
          .update({ result_asset_id: null })
          .eq("id", job.order_id);
      }

      results.push({ order_id: job.order_id, actions, removed });
    }

    return jsonResponse({
      ok: true,
      dry_run: dryRun,
      scanned: (jobs || []).length,
      processed: results.length,
      policy,
      results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});
