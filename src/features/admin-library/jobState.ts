export const HIGGSFIELD_JOB_STATUSES = [
  "created",
  "estimated",
  "submitting",
  "queued",
  "in_progress",
  "completed",
  "importing",
  "imported",
  "import_failed",
  "failed",
  "nsfw",
  "canceled",
] as const;

export type HiggsfieldJobStatus = (typeof HIGGSFIELD_JOB_STATUSES)[number];

const TERMINAL_PROVIDER = new Set(["completed", "failed", "nsfw", "canceled"]);
const OPEN_PROVIDER = new Set(["queued", "in_progress"]);

export function mapProviderStatus(status: string): HiggsfieldJobStatus | null {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "queued") return "queued";
  if (normalized === "in_progress" || normalized === "in-progress" || normalized === "processing") {
    return "in_progress";
  }
  if (normalized === "completed" || normalized === "succeeded" || normalized === "success") return "completed";
  if (normalized === "failed" || normalized === "error") return "failed";
  if (normalized === "nsfw") return "nsfw";
  if (normalized === "canceled" || normalized === "cancelled") return "canceled";
  return null;
}

export function shouldPollProvider(status: HiggsfieldJobStatus, providerRequestId: string | null): boolean {
  if (!providerRequestId) return false;
  return OPEN_PROVIDER.has(status) || status === "submitting";
}

export function shouldRetryImport(status: HiggsfieldJobStatus): boolean {
  return status === "completed" || status === "import_failed" || status === "importing";
}

export function isProviderTerminal(status: string): boolean {
  const mapped = mapProviderStatus(status);
  return mapped != null && TERMINAL_PROVIDER.has(mapped);
}

export function resumeAction(status: HiggsfieldJobStatus, providerRequestId: string | null): "poll" | "import" | "submit" | "none" {
  if (status === "imported") return "none";
  if (shouldRetryImport(status) && providerRequestId) return "import";
  if (providerRequestId && (shouldPollProvider(status, providerRequestId) || status === "created" || status === "estimated")) {
    return "poll";
  }
  if (!providerRequestId && (status === "created" || status === "estimated" || status === "submitting")) {
    return "submit";
  }
  return "none";
}

/** Never submit a second paid generation for a job that already has a provider id. */
export function canSubmitPaidGeneration(status: HiggsfieldJobStatus, providerRequestId: string | null): boolean {
  if (providerRequestId) return false;
  return status === "created" || status === "estimated" || status === "submitting";
}
