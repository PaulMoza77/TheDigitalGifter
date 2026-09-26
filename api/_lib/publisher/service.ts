import { randomUUID } from "node:crypto";
import { futureAssignedAssetIds, publicationDuplicateKey, selectLibraryAsset } from "../../../src/features/publisher/assignment";
import { normalizeTimes, normalizeWeekdays } from "../../../src/features/publisher/destinations";
import { planSlotsForRule } from "../../../src/features/publisher/slotGeneration";
import { publicationStatusFromParts, slotIsEditableFuture } from "../../../src/features/publisher/status";
import type {
  PublisherContentType,
  PublisherDestination,
  PublisherLibraryAsset,
  PublisherScheduleRule,
  PublisherStatus,
} from "../../../src/features/publisher/types";
import { DEFAULT_PUBLISHER_TIMEZONE, ROLLING_HORIZON_DAYS } from "../../../src/features/publisher/types";
import { getServiceClient } from "../christmas/supabaseClient";
import { tickSocialPublisher } from "../social-publisher/invoke";
import { loadAutopilotSettings, loadPlatformConnectionLabels, reflectSocialTargetStatus, syncPublisherSocialBridge } from "./bridge";
import { loadPublisherAssets } from "./library";
import type { PlatformMetadata } from "./_lib/christmas-reel-pipeline/types";
import { autopilotCaption } from "./_lib/christmas-reel-pipeline/metadata";

type DbClient = ReturnType<typeof getServiceClient>;

async function bridgeAfterChange(publicationId?: string) {
  try {
    await syncPublisherSocialBridge(publicationId ? [publicationId] : undefined);
  } catch (error) {
    console.error(
      JSON.stringify({
        source: "publisher",
        event: "social_bridge_failed",
        message: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}

function mapRule(row: Record<string, unknown>): PublisherScheduleRule {
  return {
    id: String(row.id),
    name: String(row.name),
    timezone: String(row.timezone || DEFAULT_PUBLISHER_TIMEZONE),
    weekdays: normalizeWeekdays((row.weekdays as number[]) || []),
    times: normalizeTimes((row.times as string[]) || []),
    contentType: (row.content_type as PublisherContentType) || "video",
    destinations: asDestinations(row.destinations),
    libraryCategory: row.library_category ? String(row.library_category) : null,
    libraryTags: (row.library_tags as string[]) || [],
    autoAssign: row.auto_assign !== false,
    reuseCooldownDays: Number(row.reuse_cooldown_days ?? 14),
    approvalRequired: row.approval_required !== false,
    active: row.active !== false,
    deletedAt: row.deleted_at ? String(row.deleted_at) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

async function loadRules(service: DbClient, activeOnly = false): Promise<PublisherScheduleRule[]> {
  let query = service.from("publisher_schedule_rules").select("*").is("deleted_at", null);
  if (activeOnly) query = query.eq("active", true);
  const { data, error } = await query.order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []).map((row) => mapRule(row as Record<string, unknown>));
}

async function syncPublicationStatus(service: DbClient, publicationId: string) {
  const [{ data: publication }, { data: jobs }, { data: slot }] = await Promise.all([
    service.from("publisher_publications").select("*").eq("id", publicationId).maybeSingle(),
    service.from("publisher_destination_jobs").select("*").eq("publication_id", publicationId),
    service.from("publisher_slots").select("*").eq("publication_id", publicationId).maybeSingle(),
  ]);
  if (!publication) return null;
  let approvalRequired = true;
  if (slot?.rule_id) {
    const { data: rule } = await service.from("publisher_schedule_rules").select("approval_required").eq("id", slot.rule_id).maybeSingle();
    if (rule) approvalRequired = rule.approval_required !== false;
  }
  const status = publicationStatusFromParts({
    libraryAssetId: publication.library_asset_id,
    approved: Boolean(publication.approved),
    approvalRequired,
    jobs: (jobs || []).map((job) => ({ status: job.status as PublisherStatus })),
    cancelled: publication.status === "cancelled",
  });
  await service.from("publisher_publications").update({ status, updated_at: new Date().toISOString() }).eq("id", publicationId);
  if (publication.slot_id) {
    await service
      .from("publisher_slots")
      .update({ status, publication_id: publicationId, updated_at: new Date().toISOString() })
      .eq("id", publication.slot_id);
  }
  return status;
}

async function ensureJobs(service: DbClient, publication: {
  id: string;
  destinations: PublisherDestination[];
  library_asset_id: string | null;
  approved: boolean;
}) {
  const { data: existing } = await service.from("publisher_destination_jobs").select("*").eq("publication_id", publication.id);
  const have = new Set((existing || []).map((row) => String(row.destination)));
  const status: PublisherStatus = !publication.library_asset_id
    ? "needs_content"
    : publication.approved
      ? "scheduled"
      : "needs_approval";
  for (const destination of publication.destinations) {
    if (have.has(destination)) continue;
    await service.from("publisher_destination_jobs").insert({
      publication_id: publication.id,
      destination,
      status,
    });
  }
}

async function assignEmptySlot(
  service: DbClient,
  slot: { id: string; rule_id: string; scheduled_at: string; timezone: string },
  rule: PublisherScheduleRule,
  assets: PublisherLibraryAsset[],
  publications: Array<{ id: string; libraryAssetId: string | null; status: PublisherStatus; scheduledAt: string }>,
) {
  const { data: existing } = await service.from("publisher_publications").select("*").eq("slot_id", slot.id).maybeSingle();
  let publication = existing;
  if (!publication) {
    const inserted = await service
      .from("publisher_publications")
      .insert({
        slot_id: slot.id,
        library_asset_id: null,
        caption: "",
        content_type: rule.contentType,
        assignment_source: "none",
        approved: !rule.approvalRequired,
        approved_at: rule.approvalRequired ? null : new Date().toISOString(),
        status: "needs_content",
        scheduled_at: slot.scheduled_at,
        timezone: slot.timezone,
        destinations: rule.destinations,
      })
      .select("*")
      .single();
    if (inserted.error) throw inserted.error;
    publication = inserted.data;
    await service.from("publisher_slots").update({ publication_id: publication.id }).eq("id", slot.id);
  }
  await ensureJobs(service, {
    id: publication.id,
    destinations: rule.destinations,
    library_asset_id: publication.library_asset_id,
    approved: Boolean(publication.approved),
  });
  if (publication.library_asset_id) return;
  const assigned = futureAssignedAssetIds(publications, Date.now(), publication.id);
  const decision = selectLibraryAsset({
    assets,
    contentType: rule.contentType,
    destinations: rule.destinations,
    nowMs: Date.now(),
    cooldownDays: rule.reuseCooldownDays,
    assignedFutureAssetIds: assigned,
    autoAssign: rule.autoAssign,
    category: rule.libraryCategory,
    tags: rule.libraryTags,
  });
  if (!decision.ok) {
    await service.from("publisher_slots").update({
      status: "needs_content",
      content_reason: decision.detail,
      publication_id: publication.id,
    }).eq("id", slot.id);
    await service.from("publisher_publications").update({ status: "needs_content", assignment_source: "none" }).eq("id", publication.id);
    return;
  }
  const duplicateKey = publicationDuplicateKey(decision.assetId, publication.scheduled_at, rule.destinations);
  const pickedAsset = assets.find((asset) => asset.id === decision.assetId);
  const caption =
    pickedAsset?.platformMetadata && typeof pickedAsset.platformMetadata === "object"
      ? autopilotCaption(pickedAsset.platformMetadata as PlatformMetadata, pickedAsset.title)
      : pickedAsset?.title || "";
  await service.from("publisher_publications").update({
    library_asset_id: decision.assetId,
    assignment_source: "auto",
    caption,
    approved: !rule.approvalRequired,
    approved_at: rule.approvalRequired ? null : new Date().toISOString(),
    duplicate_key: duplicateKey,
    status: rule.approvalRequired ? "needs_approval" : "scheduled",
  }).eq("id", publication.id);
  const jobStatus = rule.approvalRequired ? "needs_approval" : "scheduled";
  await service.from("publisher_destination_jobs").update({ status: jobStatus }).eq("publication_id", publication.id);
  publications.push({
    id: publication.id,
    libraryAssetId: decision.assetId,
    status: rule.approvalRequired ? "needs_approval" : "scheduled",
    scheduledAt: publication.scheduled_at,
  });
  await service.from("publisher_slots").update({
    status: jobStatus,
    content_reason: null,
    publication_id: publication.id,
  }).eq("id", slot.id);
}

export async function generatePublisherSlots() {
  const service = getServiceClient();
  const [rules, assets, { data: existingPubs }] = await Promise.all([
    loadRules(service, true),
    loadPublisherAssets(),
    service.from("publisher_publications").select("id, library_asset_id, status, scheduled_at"),
  ]);
  const publications = (existingPubs || []).map((row) => ({
    id: String(row.id),
    libraryAssetId: row.library_asset_id ? String(row.library_asset_id) : null,
    status: row.status as PublisherStatus,
    scheduledAt: String(row.scheduled_at),
  }));
  let created = 0;
  const now = Date.now();
  for (const rule of rules) {
    const planned = planSlotsForRule(rule, now, ROLLING_HORIZON_DAYS);
    for (const item of planned) {
      const inserted = await service
        .from("publisher_slots")
        .upsert(
          {
            rule_id: item.ruleId,
            scheduled_at: item.scheduledAt,
            timezone: item.timezone,
            status: "needs_content",
          },
          { onConflict: "rule_id,scheduled_at", ignoreDuplicates: true },
        )
        .select("*")
        .maybeSingle();
      if (inserted.error) throw inserted.error;
      if (!inserted.data) continue;
      created += 1;
      await assignEmptySlot(service, inserted.data, rule, assets, publications);
    }
    const { data: emptySlots } = await service
      .from("publisher_slots")
      .select("*")
      .eq("rule_id", rule.id)
      .is("publication_id", null)
      .neq("status", "cancelled");
    for (const slot of emptySlots || []) {
      await assignEmptySlot(service, slot, rule, assets, publications);
    }
  }
  return { created, horizonDays: ROLLING_HORIZON_DAYS };
}

export async function tickPublisherWorker(workerId = "publisher-origin") {
  const generated = await generatePublisherSlots();
  let sync: { ok: boolean; synced?: number; result?: Record<string, unknown> } = { ok: true, synced: 0 };
  try {
    sync = await syncPublisherSocialBridge();
  } catch (error) {
    sync = { ok: false, result: { error: error instanceof Error ? error.message : String(error) } };
  }
  let socialTick: { ok: boolean; status: number; json: Record<string, unknown> } = { ok: true, status: 200, json: {} };
  try {
    socialTick = await tickSocialPublisher();
  } catch (error) {
    socialTick = { ok: false, status: 0, json: { error: error instanceof Error ? error.message : String(error) } };
  }
  const reflected = await reflectSocialTargetStatus();
  const settings = await loadAutopilotSettings();
  return {
    ok: true,
    workerId,
    slotsCreated: generated.created,
    claimed: 0,
    processed: reflected.updated,
    sync,
    socialTick: socialTick.json,
    reflected,
    dryRun: false,
    livePosts: settings.livePostsEnabled,
  };
}

export async function publisherBootstrap() {
  const service = getServiceClient();
  await generatePublisherSlots();
  const [{ data: settings }, rules, { data: publications }, { data: slots }, { data: jobs }, assets, autopilot, platforms] = await Promise.all([
    service.from("publisher_settings").select("*").eq("id", 1).maybeSingle(),
    loadRules(service, false),
    service.from("publisher_publications").select("*").order("scheduled_at", { ascending: true }).limit(400),
    service.from("publisher_slots").select("*").order("scheduled_at", { ascending: true }).limit(400),
    service.from("publisher_destination_jobs").select("*").limit(2000),
    loadPublisherAssets(),
    loadAutopilotSettings(service),
    loadPlatformConnectionLabels(service),
  ]);
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  const jobsByPub = new Map<string, typeof jobs>();
  for (const job of jobs || []) {
    const list = jobsByPub.get(job.publication_id) || [];
    list.push(job);
    jobsByPub.set(job.publication_id, list);
  }
  const overview = {
    needs_content: 0,
    needs_approval: 0,
    scheduled: 0,
    published: 0,
    partial: 0,
    failed: 0,
    dry_run_completed: 0,
  };
  const hydrated = (publications || []).map((row) => {
    const pubJobs = jobsByPub.get(row.id) || [];
    const jobStatuses = pubJobs.map((job) => String(job.status));
    const completed = jobStatuses.filter((status) => status === "completed").length;
    const failedJobs = jobStatuses.filter((status) => status === "failed").length;
    const activeJobs = jobStatuses.filter((status) => status !== "cancelled");
    if (row.status === "needs_content") overview.needs_content += 1;
    else if (row.status === "needs_approval") overview.needs_approval += 1;
    else if (row.status === "scheduled") overview.scheduled += 1;
    else if (row.status === "completed" || (activeJobs.length > 0 && completed === activeJobs.length)) overview.published += 1;
    else if (row.status === "failed") overview.failed += 1;
    if (completed > 0 && failedJobs > 0) overview.partial += 1;
    else if (row.status === "completed") overview.dry_run_completed += 1;
    const asset = row.library_asset_id ? assetById.get(row.library_asset_id) : null;
    return {
      ...row,
      asset_title: asset?.title || null,
      asset_src: asset?.src || null,
      asset_poster: asset?.poster || null,
      jobs: pubJobs,
    };
  });
  return {
    timezone: settings?.timezone || DEFAULT_PUBLISHER_TIMEZONE,
    livePostsEnabled: autopilot.livePostsEnabled,
    livePostsEnabledAt: autopilot.livePostsEnabledAt,
    autopilot,
    platforms,
    connections: [
      { provider: "meta", status: platforms.instagram.status === "connected" || platforms.facebook.status === "connected" ? "connected" : "not_connected" },
      { provider: "threads", status: "not_connected" },
      { provider: "youtube", status: platforms.youtube_shorts.status === "connected" ? "connected" : "not_connected" },
      { provider: "tiktok", status: "not_connected" },
      { provider: "dry_run", status: "connected" },
    ],
    overview,
    rules,
    slots: slots || [],
    publications: hydrated,
    assets: assets.map((asset) => ({
      id: asset.id,
      title: asset.title,
      src: asset.src,
      poster: asset.poster,
      kind: asset.kind,
      category: asset.category,
      contentType: asset.contentType,
      excluded: asset.excluded,
      tags: asset.tags,
      durationSeconds: asset.durationSeconds,
      width: asset.width,
      height: asset.height,
    })),
  };
}

export async function savePublisherRule(input: Record<string, unknown>, id?: string) {
  const service = getServiceClient();
  const payload = {
    name: String(input.name || "").trim() || "Untitled schedule",
    timezone: String(input.timezone || DEFAULT_PUBLISHER_TIMEZONE),
    weekdays: normalizeWeekdays((input.weekdays as number[]) || []),
    times: normalizeTimes((input.times as string[]) || []),
    content_type: input.contentType === "image" ? "image" : "video",
    destinations: asDestinations(input.destinations),
    library_category: input.libraryCategory ? String(input.libraryCategory) : null,
    library_tags: Array.isArray(input.libraryTags) ? input.libraryTags.map(String) : [],
    auto_assign: input.autoAssign !== false,
    reuse_cooldown_days: Number(input.reuseCooldownDays ?? 14),
    approval_required: input.approvalRequired !== false,
    active: input.active !== false,
    updated_at: new Date().toISOString(),
  };
  if (!payload.weekdays.length) throw new Error("Select at least one weekday");
  if (!payload.times.length) throw new Error("Add at least one publishing time");
  if (!payload.destinations.length) throw new Error("Select at least one destination");
  let ruleId = id;
  if (id) {
    const { error } = await service.from("publisher_schedule_rules").update(payload).eq("id", id);
    if (error) throw error;
    const { data: slots } = await service.from("publisher_slots").select("*").eq("rule_id", id);
    const rule = mapRule({ id, ...payload, deleted_at: null, created_at: new Date().toISOString() });
    const planned = new Set(planSlotsForRule(rule, Date.now()).map((item) => `${item.ruleId}:${item.scheduledAt}`));
    for (const slot of slots || []) {
      if (!slotIsEditableFuture(slot, Date.now())) continue;
      const key = `${slot.rule_id}:${new Date(slot.scheduled_at).toISOString()}`;
      if (!payload.active || !planned.has(key)) {
        if (slot.publication_id) {
          const { data: pub } = await service.from("publisher_publications").select("approved, locked, status").eq("id", slot.publication_id).maybeSingle();
          if (pub?.approved || pub?.locked || pub?.status === "completed") continue;
          await service.from("publisher_publications").update({ status: "cancelled" }).eq("id", slot.publication_id);
          await service.from("publisher_destination_jobs").update({ status: "cancelled" }).eq("publication_id", slot.publication_id);
        }
        await service.from("publisher_slots").delete().eq("id", slot.id);
      }
    }
  } else {
    const inserted = await service.from("publisher_schedule_rules").insert(payload).select("id").single();
    if (inserted.error) throw inserted.error;
    ruleId = inserted.data.id;
  }
  await generatePublisherSlots();
  await bridgeAfterChange();
  return { id: ruleId };
}

export async function previewPublisherRule(input: Record<string, unknown>) {
  const rule: PublisherScheduleRule = {
    id: "preview",
    name: String(input.name || "Preview"),
    timezone: String(input.timezone || DEFAULT_PUBLISHER_TIMEZONE),
    weekdays: normalizeWeekdays((input.weekdays as number[]) || []),
    times: normalizeTimes((input.times as string[]) || []),
    contentType: input.contentType === "image" ? "image" : "video",
    destinations: asDestinations(input.destinations),
    libraryCategory: null,
    libraryTags: [],
    autoAssign: true,
    reuseCooldownDays: 14,
    approvalRequired: true,
    active: true,
    deletedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return { slots: planSlotsForRule(rule, Date.now()) };
}

export async function setRuleActive(id: string, active: boolean) {
  const service = getServiceClient();
  const { error } = await service.from("publisher_schedule_rules").update({ active, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
  if (active) {
    await generatePublisherSlots();
    await bridgeAfterChange();
  }
  return { ok: true };
}

export async function deletePublisherRule(id: string) {
  const service = getServiceClient();
  const { error } = await service
    .from("publisher_schedule_rules")
    .update({ active: false, deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
  return { ok: true };
}

export async function mutatePublication(action: string, body: Record<string, unknown>) {
  const service = getServiceClient();
  const id = String(body.publication_id || body.id || "");
  const { data: publication } = await service.from("publisher_publications").select("*").eq("id", id).maybeSingle();
  if (!publication) throw new Error("Publication not found");

  if (action === "approve") {
    if (!publication.library_asset_id) throw new Error("Attach Library content before approving");
    await service.from("publisher_publications").update({
      approved: true,
      approved_at: new Date().toISOString(),
      status: "scheduled",
    }).eq("id", id);
    await service.from("publisher_destination_jobs").update({ status: "scheduled" }).eq("publication_id", id).in("status", ["needs_approval", "needs_content"]);
    await syncPublicationStatus(service, id);
    await bridgeAfterChange(id);
    return { ok: true };
  }
  if (action === "cancel") {
    await service.from("publisher_publications").update({ status: "cancelled" }).eq("id", id);
    await service.from("publisher_destination_jobs").update({ status: "cancelled" }).eq("publication_id", id).neq("status", "completed");
    if (publication.slot_id) await service.from("publisher_slots").update({ status: "cancelled" }).eq("id", publication.slot_id);
    await bridgeAfterChange(id);
    return { ok: true };
  }
  if (action === "lock") {
    await service.from("publisher_publications").update({ locked: true }).eq("id", id);
    if (publication.slot_id) await service.from("publisher_slots").update({ locked: true, assignment_locked: true }).eq("id", publication.slot_id);
    return { ok: true };
  }
  if (action === "return_to_pool") {
    await service.from("publisher_publications").update({
      library_asset_id: null,
      assignment_source: "none",
      approved: false,
      approved_at: null,
      duplicate_key: null,
      locked: false,
      status: "needs_content",
    }).eq("id", id);
    await service.from("publisher_destination_jobs").update({ status: "needs_content" }).eq("publication_id", id).neq("status", "completed");
    if (publication.slot_id) {
      await service.from("publisher_slots").update({
        status: "needs_content",
        assignment_locked: false,
        content_reason: "Content returned to the Library pool.",
      }).eq("id", publication.slot_id);
    }
    await bridgeAfterChange(id);
    return { ok: true };
  }
  if (action === "replace_content") {
    const assetId = String(body.library_asset_id || "");
    const assets = await loadPublisherAssets();
    const asset = assets.find((item) => item.id === assetId);
    if (!asset) throw new Error("Library asset not found");
    if (asset.contentType !== publication.content_type) throw new Error("Asset type does not match this slot");
    const duplicateKey = publicationDuplicateKey(assetId, publication.scheduled_at, asDestinations(publication.destinations));
    await service.from("publisher_publications").update({
      library_asset_id: assetId,
      assignment_source: "manual",
      caption: body.caption != null ? String(body.caption) : publication.caption || asset.title,
      duplicate_key: duplicateKey,
      locked: Boolean(body.lock) || publication.locked,
    }).eq("id", id);
    if (publication.slot_id) {
      await service.from("publisher_slots").update({
        assignment_locked: Boolean(body.lock),
        manually_edited: true,
        content_reason: null,
      }).eq("id", publication.slot_id);
    }
    await ensureJobs(service, {
      id,
      destinations: asDestinations(publication.destinations),
      library_asset_id: assetId,
      approved: Boolean(publication.approved),
    });
    await syncPublicationStatus(service, id);
    await bridgeAfterChange(id);
    return { ok: true };
  }
  if (action === "reschedule") {
    const scheduledAt = String(body.scheduled_at || "");
    if (!scheduledAt) throw new Error("scheduled_at is required");
    const duplicateKey = publication.library_asset_id
      ? publicationDuplicateKey(publication.library_asset_id, scheduledAt, asDestinations(publication.destinations))
      : null;
    await service.from("publisher_publications").update({
      scheduled_at: scheduledAt,
      duplicate_key: duplicateKey,
    }).eq("id", id);
    if (publication.slot_id) {
      await service.from("publisher_slots").update({
        scheduled_at: scheduledAt,
        manually_edited: true,
        locked: true,
      }).eq("id", publication.slot_id);
    }
    await bridgeAfterChange(id);
    return { ok: true };
  }
  if (action === "exclude_asset") {
    const assetId = String(body.library_asset_id || publication.library_asset_id || "");
    await service.from("publisher_asset_state").upsert({
      library_asset_id: assetId,
      excluded: true,
      eligible: false,
      updated_at: new Date().toISOString(),
    });
    await service.from("library_assets").update({ publisher_excluded: true, publisher_eligible: false }).eq("id", assetId);
    return { ok: true };
  }
  throw new Error(`Unknown publication action: ${action}`);
}

export async function createManualPublisherPublication(body: Record<string, unknown>) {
  const service = getServiceClient();
  const assets = await loadPublisherAssets();
  const assetId = String(body.library_asset_id || "");
  const asset = assets.find((item) => item.id === assetId);
  if (!asset) throw new Error("Library asset not found");
  const destinations = asDestinations(body.destinations);
  if (!destinations.length) throw new Error("Select at least one destination");
  const scheduledAt = String(body.scheduled_at || "");
  if (!scheduledAt) throw new Error("Choose a date and time");
  const duplicateKey = publicationDuplicateKey(assetId, scheduledAt, destinations);
  const approve = Boolean(body.approve);
  const inserted = await service
    .from("publisher_publications")
    .insert({
      slot_id: null,
      library_asset_id: assetId,
      caption: String(body.caption || asset.title),
      content_type: asset.contentType,
      assignment_source: "manual",
      approved: approve,
      approved_at: approve ? new Date().toISOString() : null,
      status: approve ? "scheduled" : "needs_approval",
      scheduled_at: scheduledAt,
      timezone: String(body.timezone || DEFAULT_PUBLISHER_TIMEZONE),
      destinations,
      duplicate_key: duplicateKey,
    })
    .select("*")
    .single();
  if (inserted.error) {
    if (inserted.error.code === "23505") throw new Error("A publication with this asset, time, and destinations already exists");
    throw inserted.error;
  }
  await ensureJobs(service, {
    id: inserted.data.id,
    destinations,
    library_asset_id: assetId,
    approved: approve,
  });
  await bridgeAfterChange(inserted.data.id);
  return { publication: inserted.data };
}

export function newWorkerId(): string {
  return `publisher-${randomUUID().slice(0, 8)}`;
}
