/**
 * Scheduler recovery for fulfillment jobs.
 *
 * Official installer: supabase/migrations/20260817_fulfillment_schedules.sql
 * and docs/fulfillment-schedules.md (pg_cron + Vault names, no secrets in Git).
 * config.toml comments are not a scheduler. PGlite tests do not cover cron.
 *
 * Processes at most one job per invocation. Backoff (`run_after`) and stale
 * `running` jobs are reclaimed by claim_next_fulfillment_job — no new webhook
 * is required. kickFulfillmentWorker() is only a waitUntil optimization.
 */
import { jsonResponse } from "../_shared/cors.ts";
import { getServiceClient, readJson } from "../_shared/supabase.ts";
import { mvpProduct } from "../_shared/mvpProduct.ts";
import { requireSchedulerAuth } from "../_shared/access.ts";

type ClaimedJob = {
  kind?: string;
  job?: {
    id: string;
    order_id: string;
    generation_id: string;
    kind?: string;
  };
};

Deno.serve(async (req) => {
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
  if (!requireSchedulerAuth(req)) {
    return jsonResponse({ error: "Forbidden" }, 403);
  }

  await readJson(req);

  const service = getServiceClient();
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const secret = Deno.env.get("FULFILLMENT_SECRET") || "";
  if (!url || !anon) return jsonResponse({ error: "Missing SUPABASE_URL/ANON" }, 500);

  const { data, error } = await service.rpc("claim_next_fulfillment_job");
  if (error) return jsonResponse({ error: error.message, processed: 0 }, 500);

  const claimed = data as ClaimedJob | null;
  if (!claimed?.job?.id || claimed.kind === "empty") {
    return jsonResponse({
      processed: 0,
      maxAttempts: mvpProduct.maxGenerationAttempts,
    });
  }

  const job = claimed.job;
  const emailOnly = job.kind === "result_email";
  const fulfillRes = await fetch(`${url}/functions/v1/fulfill-paid-order`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anon,
      Authorization: `Bearer ${anon}`,
      "x-fulfillment-secret": secret,
    },
    body: JSON.stringify({
      order_id: job.order_id,
      generation_id: job.generation_id,
      job_id: job.id,
      email_only: emailOnly,
    }),
  });
  const payload = await fulfillRes.json().catch(() => ({}));
  const ok = fulfillRes.ok && payload?.ok === true;

  await service.rpc("finish_fulfillment_job", {
    p_job_id: job.id,
    p_ok: ok,
    p_error: ok ? null : String(payload?.error || `fulfill failed (${fulfillRes.status})`).slice(0, 500),
  });

  if (!emailOnly && ok && payload?.email_ok !== true) {
    await service.rpc("enqueue_result_email_job", {
      p_order_id: job.order_id,
      p_generation_id: job.generation_id,
    });
  }

  return jsonResponse({
    processed: 1,
    job_id: job.id,
    ok,
    email_ok: payload?.email_ok === true,
    maxAttempts: mvpProduct.maxGenerationAttempts,
  });
});
