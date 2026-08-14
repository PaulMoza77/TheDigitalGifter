import { jsonResponse } from "../_shared/cors.ts";
import { getServiceClient, readJson } from "../_shared/supabase.ts";
import { requireFulfillmentSecret } from "../_shared/stripe.ts";
import { mvpProduct } from "../_shared/mvpProduct.ts";

type ClaimedJob = {
  kind?: string;
  job?: {
    id: string;
    order_id: string;
    generation_id: string;
  };
};

Deno.serve(async (req) => {
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
  if (!requireFulfillmentSecret(req)) {
    return jsonResponse({ error: "Forbidden" }, 403);
  }

  await readJson(req);

  const service = getServiceClient();
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const secret = Deno.env.get("FULFILLMENT_SECRET") || "";
  if (!url || !anon) return jsonResponse({ error: "Missing SUPABASE_URL/ANON" }, 500);

  const processed: Array<{ jobId: string; ok: boolean }> = [];

  for (let i = 0; i < 5; i += 1) {
    const { data, error } = await service.rpc("claim_next_fulfillment_job");
    if (error) return jsonResponse({ error: error.message, processed }, 500);

    const claimed = data as ClaimedJob | null;
    if (!claimed?.job?.id || claimed.kind === "empty") break;

    const job = claimed.job;
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
      }),
    });
    const payload = await fulfillRes.json().catch(() => ({}));
    const ok = fulfillRes.ok && payload?.ok === true;

    await service.rpc("finish_fulfillment_job", {
      p_job_id: job.id,
      p_ok: ok,
      p_error: ok ? null : String(payload?.error || `fulfill failed (${fulfillRes.status})`).slice(0, 500),
    });

    processed.push({ jobId: job.id, ok });
  }

  return jsonResponse({
    processed,
    maxAttempts: mvpProduct.maxGenerationAttempts,
  });
});
