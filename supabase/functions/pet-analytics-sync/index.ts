import { optionsResponse, jsonResponse } from "../_shared/cors.ts";
import { assertAdmin, getAuthUser, getServiceClient, isServiceRoleRequest, readJson } from "../_shared/supabase.ts";
import {
  defaultPetAdsSyncStartDate,
  discoverMetaCampaignEarliestDate,
  fetchMetaAdsDailyInsights,
  META_CUSTOM_EVENT_RECOVERY,
  metaAdsConfigStatus,
  resolvePetMetaCampaignAllowlist,
} from "../_shared/pet/metaAds.ts";
import { BUILTIN_PET_META_CAMPAIGN_LABELS } from "../_shared/pet/metaCampaignAllowlist.ts";
import { fetchGa4DailyMetrics, ga4ConfigStatus } from "../_shared/pet/ga4Data.ts";

type Body = {
  action?: string;
  mode?: string;
  from?: string;
  to?: string;
  source?: string;
};

function asString(value: unknown): string {
  return String(value ?? "").trim();
}

function utcDay(offset = 0): string {
  const d = new Date();
  const fixed = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + offset));
  return fixed.toISOString().slice(0, 10);
}

function resolveRange(mode: string, from?: string, to?: string): { from: string; to: string; mode: string } {
  if (mode === "today") {
    const day = utcDay(0);
    return { from: day, to: day, mode: "today" };
  }
  if (mode === "yesterday") {
    const day = utcDay(-1);
    return { from: day, to: day, mode: "yesterday" };
  }
  if (mode === "range" && from && to) {
    return { from, to, mode: "range" };
  }
  // historical
  return { from: from || defaultPetAdsSyncStartDate(), to: to || utcDay(0), mode: "historical" };
}

function cronAuthorized(req: Request): boolean {
  const secret = asString(Deno.env.get("PET_ANALYTICS_CRON_SECRET") || Deno.env.get("CRON_SECRET"));
  if (!secret) return false;
  const header = asString(req.headers.get("x-cron-secret") || req.headers.get("x-pet-analytics-cron-secret"));
  if (header && header === secret) return true;
  const auth = asString(req.headers.get("Authorization")).replace(/^Bearer\s+/i, "");
  return Boolean(auth && auth === secret);
}

async function beginRun(
  service: ReturnType<typeof getServiceClient>,
  source: "meta" | "ga4",
  mode: string,
  rangeFrom: string,
  rangeTo: string,
) {
  const { data, error } = await service
    .from("pet_analytics_sync_runs")
    .insert({
      source,
      mode,
      range_from: rangeFrom,
      range_to: rangeTo,
      status: "running",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function finishRun(
  service: ReturnType<typeof getServiceClient>,
  id: string,
  status: "success" | "error" | "skipped_unconfigured",
  rowsUpserted: number,
  errorMessage?: string,
) {
  await service
    .from("pet_analytics_sync_runs")
    .update({
      status,
      rows_upserted: rowsUpserted,
      error_message: errorMessage ? errorMessage.slice(0, 500) : null,
      finished_at: new Date().toISOString(),
    })
    .eq("id", id);
}

async function syncMeta(
  service: ReturnType<typeof getServiceClient>,
  mode: string,
  from: string,
  to: string,
) {
  const status = metaAdsConfigStatus();
  const runId = await beginRun(service, "meta", mode, from, to);
  if (!status.configured) {
    await finishRun(service, runId, "skipped_unconfigured", 0, `Missing ${status.missing.join(", ")}`);
    return {
      source: "meta",
      status: "skipped_unconfigured",
      missing: status.missing,
      rowsUpserted: 0,
      customEventRecovery: META_CUSTOM_EVENT_RECOVERY,
    };
  }

  try {
    const { data: allowRows, error: allowError } = await service
      .from("pet_meta_campaign_allowlist")
      .select("campaign_id")
      .eq("enabled", true);
    if (allowError) throw allowError;
    const campaignIds = resolvePetMetaCampaignAllowlist((allowRows || []).map((row) => String(row.campaign_id || "")));
    if (!campaignIds.length) {
      throw new Error("Pet Meta campaign allowlist is empty; refusing to sync the entire ad account");
    }
    const allowlistUpsert = campaignIds.map((campaign_id) => ({
      campaign_id,
      label: BUILTIN_PET_META_CAMPAIGN_LABELS[campaign_id] || "",
      enabled: true,
    }));
    const { error: persistAllowError } = await service
      .from("pet_meta_campaign_allowlist")
      .upsert(allowlistUpsert, { onConflict: "campaign_id", ignoreDuplicates: true });
    if (persistAllowError) throw persistAllowError;

    let since = from;
    if (mode === "historical") {
      const discovered = await discoverMetaCampaignEarliestDate(campaignIds);
      const configuredStart = defaultPetAdsSyncStartDate();
      // Prefer the earliest truthful start we can determine.
      since = [from, configuredStart, discovered].filter(Boolean).sort()[0] as string;
    }

    const { rows, customEvents } = await fetchMetaAdsDailyInsights({ since, until: to, campaignIds });
    const { data, error } = await service.rpc("upsert_pet_meta_daily_metrics", { p_rows: rows });
    if (error) throw error;
    await service.rpc("purge_unallowlisted_pet_meta_metrics");
    const upserted = Number(data) || rows.length;
    await finishRun(service, runId, "success", upserted);
    return {
      source: "meta",
      status: "success",
      from: since,
      to,
      rowsUpserted: upserted,
      customEvents,
      customEventRecovery: Object.fromEntries(
        Object.entries(META_CUSTOM_EVENT_RECOVERY).filter(([name]) => {
          if (name === "PetNameSubmitted") return !customEvents.pet_name_submitted;
          if (name === "PhotoUploadCompleted") return !customEvents.photo_upload_completed;
          if (name === "PetOrderReviewViewed") return !customEvents.order_review_viewed;
          if (name === "PetDetailsCompleted") return !customEvents.pet_details_completed;
          return true;
        }),
      ),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Meta sync failed";
    await finishRun(service, runId, "error", 0, message);
    return { source: "meta", status: "error", error: message, rowsUpserted: 0 };
  }
}

async function syncGa4(
  service: ReturnType<typeof getServiceClient>,
  mode: string,
  from: string,
  to: string,
) {
  const status = ga4ConfigStatus();
  const runId = await beginRun(service, "ga4", mode, from, to);
  if (!status.configured) {
    await finishRun(service, runId, "skipped_unconfigured", 0, `Missing ${status.missing.join(", ")}`);
    return {
      source: "ga4",
      status: "skipped_unconfigured",
      missing: status.missing,
      measurementId: status.measurementId,
      rowsUpserted: 0,
    };
  }

  try {
    const rows = await fetchGa4DailyMetrics({ since: from, until: to });
    const { data, error } = await service.rpc("upsert_pet_ga4_daily_metrics", { p_rows: rows });
    if (error) throw error;
    const upserted = Number(data) || rows.length;
    await finishRun(service, runId, "success", upserted);
    return { source: "ga4", status: "success", from, to, rowsUpserted: upserted };
  } catch (err) {
    const message = err instanceof Error ? err.message : "GA4 sync failed";
    await finishRun(service, runId, "error", 0, message);
    return { source: "ga4", status: "error", error: message, rowsUpserted: 0 };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse(req);
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const body = await readJson<Body>(req);
    const action = asString(body.action) || "sync";
    const isCron = cronAuthorized(req);
    const isService = isServiceRoleRequest(req);

    if (!isCron && !isService) {
      const { user } = await getAuthUser(req);
      await assertAdmin(user?.email);
    }

    const service = getServiceClient();

    if (action === "status") {
      const meta = metaAdsConfigStatus();
      const ga4 = ga4ConfigStatus();
      const { data: runs } = await service
        .from("pet_analytics_sync_runs")
        .select("source, status, finished_at, mode, rows_upserted, error_message")
        .order("started_at", { ascending: false })
        .limit(20);
      const lastMeta = (runs || []).find((r) => r.source === "meta" && r.status === "success");
      const lastGa4 = (runs || []).find((r) => r.source === "ga4" && r.status === "success");
      return jsonResponse({
        meta: {
          configured: meta.configured,
          missing: meta.missing,
          lastSyncedAt: lastMeta?.finished_at ?? null,
          customEventRecovery: META_CUSTOM_EVENT_RECOVERY,
        },
        ga4: {
          configured: ga4.configured,
          missing: ga4.missing,
          measurementId: ga4.measurementId,
          lastSyncedAt: lastGa4?.finished_at ?? null,
        },
        defaultStartDate: defaultPetAdsSyncStartDate(),
        recentRuns: runs || [],
      });
    }

    if (action === "sync" || action === "sync_historical" || action === "sync_today" || action === "sync_yesterday") {
      const requestedMode =
        action === "sync_historical"
          ? "historical"
          : action === "sync_today"
            ? "today"
            : action === "sync_yesterday"
              ? "yesterday"
              : asString(body.mode) || (isCron ? "today_yesterday" : "yesterday");

      const sourceFilter = asString(body.source) || "both";
      const results: unknown[] = [];

      if (requestedMode === "today_yesterday" || (isCron && !asString(body.mode))) {
        for (const mode of ["yesterday", "today"] as const) {
          const range = resolveRange(mode);
          if (sourceFilter === "both" || sourceFilter === "meta") {
            results.push(await syncMeta(service, mode, range.from, range.to));
          }
          if (sourceFilter === "both" || sourceFilter === "ga4") {
            results.push(await syncGa4(service, mode, range.from, range.to));
          }
        }
        return jsonResponse({ ok: true, results });
      }

      const range = resolveRange(requestedMode, asString(body.from) || undefined, asString(body.to) || undefined);
      if (sourceFilter === "both" || sourceFilter === "meta") {
        results.push(await syncMeta(service, range.mode, range.from, range.to));
      }
      if (sourceFilter === "both" || sourceFilter === "ga4") {
        results.push(await syncGa4(service, range.mode, range.from, range.to));
      }
      return jsonResponse({ ok: true, results });
    }

    return jsonResponse({ error: "Unknown action" }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    const status = /admin|forbidden|authentication/i.test(message) ? 403 : 500;
    return jsonResponse({ error: message }, status);
  }
});
