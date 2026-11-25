export async function heartbeatJob(service, jobId, workerId, leaseSeconds = 180) {
  const { data, error } = await service.rpc("christmas_story_heartbeat_job", {
    p_job_id: jobId,
    p_worker_id: workerId,
    p_lease_seconds: leaseSeconds,
  });
  if (error) throw error;
  return Boolean(data);
}

export async function failJob(service, job, workerId, errorCode, errorClass = "worker") {
  const retryable = !["photo_magic_invalid", "photo_count_invalid", "cancelled"].includes(errorCode);
  const maxAttempts = job.max_attempts ?? 5;
  const attempts = job.attempts ?? 1;
  const patch = {
    worker_id: null,
    leased_until: null,
    error_code: String(errorCode).slice(0, 80),
    error_class: errorClass,
    updated_at: new Date().toISOString(),
  };
  if (retryable && attempts < maxAttempts) {
    const backoffSec = Math.min(900, 5 * 2 ** Math.max(0, attempts - 1));
    patch.status = "failed";
    patch.next_retry_at = new Date(Date.now() + backoffSec * 1000).toISOString();
    if (job.job_type === "film") patch.status = "queued";
    if (job.job_type === "song") {
      patch.status = "failed";
      patch.production_state = "awaiting_song_production";
    }
  } else {
    patch.status = "failed";
    patch.finished_at = new Date().toISOString();
    patch.next_retry_at = null;
    if (job.job_type === "song") patch.production_state = "failed";
  }
  await service.from("christmas_story_jobs").update(patch).eq("id", job.id).eq("worker_id", workerId);
}

export async function maybeAdvanceOrderReview(service, orderId) {
  const { data: jobs } = await service
    .from("christmas_story_jobs")
    .select("job_type,status,production_state")
    .eq("order_id", orderId);
  const list = jobs || [];
  const hasSong = list.some((j) => j.job_type === "song");
  const hasFilm = list.some((j) => j.job_type === "film");
  const songReady =
    !hasSong ||
    list.some(
      (j) =>
        j.job_type === "song" &&
        (j.status === "ready" ||
          j.production_state === "ready_for_buyer_review" ||
          j.production_state === "approved"),
    );
  const filmReady = !hasFilm || list.some((j) => j.job_type === "film" && j.status === "ready");
  if (!songReady || !filmReady) return false;
  const { data: order } = await service
    .from("christmas_story_orders")
    .select("status")
    .eq("id", orderId)
    .maybeSingle();
  if (order && ["GENERATING", "CONTENT_PENDING", "PAID", "RETRY"].includes(String(order.status))) {
    await service.rpc("christmas_story_transition_order", {
      p_order_id: orderId,
      p_to: "REVIEW_REQUIRED",
      p_actor: "contabo_worker",
      p_metadata: { media_ready: true },
    });
  }
  return true;
}