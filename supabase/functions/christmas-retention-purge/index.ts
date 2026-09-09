import { optionsResponse, jsonResponse } from "../_shared/cors.ts";
import { getServiceClient, isServiceRoleRequest, readJson } from "../_shared/supabase.ts";
import {
  CHRISTMAS_MEDIA_RETENTION,
  CHRISTMAS_SOURCE_BUCKET,
  UNPAID_UPLOAD_PREFIX,
  planRetentionPurge,
  resolveUnpaidUploadTtlDays,
  type OrderSourceRef,
  type StorageObjectRef,
} from "../_shared/christmas/retentionPolicy.ts";

/**
 * Scheduled ops purge: delete abandoned unpaid objects under christmas-source/uploads/.
 * Paid sources are retained. Generated / Santa / kids paid media are never deleted here.
 * Live deletes require CHRISTMAS_RETENTION_PURGE_APPLY=true (founder gate; default dry-run).
 */

type Body = {
  action?: string;
  dry_run?: boolean;
  apply?: boolean;
  unpaid_ttl_days?: number;
};

const LIST_PAGE = 100;
const DELETE_BATCH = 50;
const MAX_OBJECTS_PER_RUN = 2000;

function asString(value: unknown): string {
  return String(value ?? "").trim();
}

function cronAuthorized(req: Request): boolean {
  const secret = asString(
    Deno.env.get("CHRISTMAS_RETENTION_CRON_SECRET") || Deno.env.get("CRON_SECRET"),
  );
  if (!secret) return false;
  const header = asString(req.headers.get("x-cron-secret") || req.headers.get("x-christmas-retention-cron-secret"));
  if (header && header === secret) return true;
  const auth = asString(req.headers.get("Authorization")).replace(/^Bearer\s+/i, "");
  return Boolean(auth && auth === secret);
}

function applyEnabled(): boolean {
  return asString(Deno.env.get("CHRISTMAS_RETENTION_PURGE_APPLY")).toLowerCase() === "true";
}

function isFolderEntry(item: { id?: string | null; metadata?: unknown }): boolean {
  return !item.id && item.metadata == null;
}

async function listUploadObjects(
  service: ReturnType<typeof getServiceClient>,
): Promise<StorageObjectRef[]> {
  const objects: StorageObjectRef[] = [];
  let offset = 0;
  const folder = UNPAID_UPLOAD_PREFIX.replace(/\/$/, "");
  while (objects.length < MAX_OBJECTS_PER_RUN) {
    const { data, error } = await service.storage.from(CHRISTMAS_SOURCE_BUCKET).list(folder, {
      limit: LIST_PAGE,
      offset,
      sortBy: { column: "created_at", order: "asc" },
    });
    if (error) throw error;
    if (!data?.length) break;
    for (const item of data) {
      if (!item.name || isFolderEntry(item)) continue;
      objects.push({
        bucket: CHRISTMAS_SOURCE_BUCKET,
        path: `${UNPAID_UPLOAD_PREFIX}${item.name}`,
        createdAt: item.created_at || item.updated_at || new Date(0).toISOString(),
      });
      if (objects.length >= MAX_OBJECTS_PER_RUN) break;
    }
    if (data.length < LIST_PAGE) break;
    offset += LIST_PAGE;
  }
  return objects;
}

async function listPaidOrderSources(
  service: ReturnType<typeof getServiceClient>,
): Promise<OrderSourceRef[]> {
  const orders: OrderSourceRef[] = [];
  let from = 0;
  const page = 500;
  while (true) {
    const { data, error } = await service
      .from("christmas_orders")
      .select("source_path, source_bucket, payment_status")
      .eq("payment_status", "paid")
      .not("source_path", "is", null)
      .range(from, from + page - 1);
    if (error) throw error;
    if (!data?.length) break;
    for (const row of data) {
      orders.push({
        sourcePath: row.source_path ?? null,
        sourceBucket: row.source_bucket ?? CHRISTMAS_SOURCE_BUCKET,
        paymentStatus: row.payment_status ?? "paid",
      });
    }
    if (data.length < page) break;
    from += page;
  }
  return orders;
}

async function removePaths(
  service: ReturnType<typeof getServiceClient>,
  paths: string[],
): Promise<{ deleted: string[]; errors: Array<{ path: string; error: string }> }> {
  const deleted: string[] = [];
  const errors: Array<{ path: string; error: string }> = [];
  for (let i = 0; i < paths.length; i += DELETE_BATCH) {
    const batch = paths.slice(i, i + DELETE_BATCH);
    const { error } = await service.storage.from(CHRISTMAS_SOURCE_BUCKET).remove(batch);
    if (error) {
      for (const path of batch) errors.push({ path, error: error.message });
      continue;
    }
    deleted.push(...batch);
  }
  return { deleted, errors };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST" && req.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  if (!cronAuthorized(req) && !isServiceRoleRequest(req)) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  try {
    const body = req.method === "POST" ? await readJson<Body>(req) : {};
    const action = asString(body.action) || "purge";
    if (action !== "purge" && action !== "plan") {
      return jsonResponse({ error: "Unknown action" }, 400);
    }

    const unpaidTtlDays = resolveUnpaidUploadTtlDays(
      body.unpaid_ttl_days ?? Deno.env.get(CHRISTMAS_MEDIA_RETENTION.unpaidUploadTtlDaysEnv),
    );
    const wantApply = body.apply === true || body.dry_run === false;
    const dryRun = !applyEnabled() || !wantApply || action === "plan";

    const service = getServiceClient();
    const [objects, orders] = await Promise.all([
      listUploadObjects(service),
      listPaidOrderSources(service),
    ]);
    const plan = planRetentionPurge({
      objects,
      orders,
      nowMs: Date.now(),
      unpaidTtlDays,
    });
    const purgePaths = plan.purge.map((row) => row.path);

    let deleted: string[] = [];
    let deleteErrors: Array<{ path: string; error: string }> = [];
    if (!dryRun && purgePaths.length) {
      const result = await removePaths(service, purgePaths);
      deleted = result.deleted;
      deleteErrors = result.errors;
    }

    return jsonResponse({
      ok: true,
      dry_run: dryRun,
      apply_enabled: applyEnabled(),
      legal_ttl: CHRISTMAS_MEDIA_RETENTION.policy,
      unpaid_ttl_days: unpaidTtlDays,
      prefix: UNPAID_UPLOAD_PREFIX,
      bucket: CHRISTMAS_SOURCE_BUCKET,
      scanned: objects.length,
      paid_sources: orders.length,
      keep: plan.keep.length,
      purge_candidates: purgePaths,
      deleted,
      delete_errors: deleteErrors,
      note: CHRISTMAS_MEDIA_RETENTION.note,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});
