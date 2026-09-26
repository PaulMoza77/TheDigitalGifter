import { getServiceClient } from "../christmas/supabaseClient";
import type { ContentAutopilotSettings } from "./types";

function mapRow(row: Record<string, unknown>): ContentAutopilotSettings {
  return {
    enabled: Boolean(row.enabled),
    generationPaused: Boolean(row.generation_paused),
    researchCandidatesPerDay: Number(row.research_candidates_per_day || 25),
    productionConceptsPerDay: Number(row.production_concepts_per_day || 5),
    clipsPerReel: Number(row.clips_per_reel || 4),
    maxImagesPerDay: Number(row.max_images_per_day || 30),
    maxImageRetriesPerDay: Number(row.max_image_retries_per_day || 10),
    maxVideosPerDay: Number(row.max_videos_per_day || 25),
    maxVideoRetriesPerDay: Number(row.max_video_retries_per_day || 8),
    maxImageAttemptsPerClip: Number(row.max_image_attempts_per_clip || 2),
    maxDailySpendUsd: Number(row.max_daily_spend_usd || 15),
  };
}

export async function loadSettings(): Promise<ContentAutopilotSettings> {
  const service = getServiceClient();
  const { data, error } = await service.from("content_autopilot_settings").select("*").eq("id", "default").maybeSingle();
  if (error) throw error;
  if (!data) {
    return mapRow({});
  }
  return mapRow(data as Record<string, unknown>);
}

export async function updateSettings(patch: Partial<ContentAutopilotSettings>): Promise<ContentAutopilotSettings> {
  const service = getServiceClient();
  const body: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.enabled !== undefined) body.enabled = patch.enabled;
  if (patch.generationPaused !== undefined) body.generation_paused = patch.generationPaused;
  if (patch.researchCandidatesPerDay !== undefined) body.research_candidates_per_day = patch.researchCandidatesPerDay;
  if (patch.productionConceptsPerDay !== undefined) body.production_concepts_per_day = patch.productionConceptsPerDay;
  if (patch.clipsPerReel !== undefined) body.clips_per_reel = patch.clipsPerReel;
  if (patch.maxImagesPerDay !== undefined) body.max_images_per_day = patch.maxImagesPerDay;
  if (patch.maxImageRetriesPerDay !== undefined) body.max_image_retries_per_day = patch.maxImageRetriesPerDay;
  if (patch.maxVideosPerDay !== undefined) body.max_videos_per_day = patch.maxVideosPerDay;
  if (patch.maxVideoRetriesPerDay !== undefined) body.max_video_retries_per_day = patch.maxVideoRetriesPerDay;
  if (patch.maxImageAttemptsPerClip !== undefined) body.max_image_attempts_per_clip = patch.maxImageAttemptsPerClip;
  if (patch.maxDailySpendUsd !== undefined) body.max_daily_spend_usd = patch.maxDailySpendUsd;
  const { data, error } = await service.from("content_autopilot_settings").update(body).eq("id", "default").select("*").single();
  if (error) throw error;
  return mapRow(data as Record<string, unknown>);
}

export function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function ensureDailyUsage(date = utcToday()) {
  const service = getServiceClient();
  const { data } = await service.from("content_autopilot_daily_usage").select("*").eq("usage_date", date).maybeSingle();
  if (data) return data as Record<string, unknown>;
  const inserted = await service
    .from("content_autopilot_daily_usage")
    .insert({ usage_date: date })
    .select("*")
    .single();
  if (inserted.error) throw inserted.error;
  return inserted.data as Record<string, unknown>;
}

export async function logEvent(kind: string, detail: Record<string, unknown>, conceptId?: string | null) {
  const service = getServiceClient();
  await service.from("content_autopilot_events").insert({
    kind,
    detail,
    concept_id: conceptId || null,
    usage_date: utcToday(),
  });
}

type UsagePatch = Partial<{
  research_candidates: number;
  production_concepts: number;
  images_generated: number;
  image_retries: number;
  videos_generated: number;
  video_retries: number;
  estimated_spend_usd: number;
  research_completed: boolean;
}>;

export async function bumpUsage(patch: UsagePatch, date = utcToday()) {
  const service = getServiceClient();
  const { data, error } = await service.rpc("content_autopilot_bump_usage", {
    p_usage_date: date,
    p_research_candidates: patch.research_candidates ?? 0,
    p_production_concepts: patch.production_concepts ?? 0,
    p_images_generated: patch.images_generated ?? 0,
    p_image_retries: patch.image_retries ?? 0,
    p_videos_generated: patch.videos_generated ?? 0,
    p_video_retries: patch.video_retries ?? 0,
    p_estimated_spend_usd: patch.estimated_spend_usd ?? 0,
    p_research_completed: patch.research_completed ?? null,
  });
  if (error) {
    const usage = await ensureDailyUsage(date);
    const next = {
      research_candidates: Number(usage.research_candidates || 0) + Number(patch.research_candidates || 0),
      production_concepts: Number(usage.production_concepts || 0) + Number(patch.production_concepts || 0),
      images_generated: Number(usage.images_generated || 0) + Number(patch.images_generated || 0),
      image_retries: Number(usage.image_retries || 0) + Number(patch.image_retries || 0),
      videos_generated: Number(usage.videos_generated || 0) + Number(patch.videos_generated || 0),
      video_retries: Number(usage.video_retries || 0) + Number(patch.video_retries || 0),
      estimated_spend_usd: Number(usage.estimated_spend_usd || 0) + Number(patch.estimated_spend_usd || 0),
      research_completed: patch.research_completed ?? Boolean(usage.research_completed),
      updated_at: new Date().toISOString(),
    };
    const { error: updateError } = await service.from("content_autopilot_daily_usage").update(next).eq("usage_date", date);
    if (updateError) throw updateError;
    return next;
  }
  return (data || {}) as Record<string, unknown>;
}

export async function tryReserveSpend(settings: ContentAutopilotSettings, additionalUsd: number, date = utcToday()): Promise<boolean> {
  const service = getServiceClient();
  const { data, error } = await service.rpc("content_autopilot_try_reserve_spend", {
    p_usage_date: date,
    p_additional_usd: additionalUsd,
    p_max_daily_usd: settings.maxDailySpendUsd,
  });
  if (error) {
    return budgetAllowsFallback(settings, additionalUsd, date);
  }
  return Boolean(data);
}

async function budgetAllowsFallback(settings: ContentAutopilotSettings, additionalUsd: number, date: string): Promise<boolean> {
  const usage = await ensureDailyUsage(date);
  const spent = Number(usage.estimated_spend_usd || 0) + additionalUsd;
  return spent <= settings.maxDailySpendUsd;
}

export async function budgetAllows(settings: ContentAutopilotSettings, additionalUsd = 0): Promise<boolean> {
  if (additionalUsd <= 0) {
    const usage = await ensureDailyUsage();
    return Number(usage.estimated_spend_usd || 0) <= settings.maxDailySpendUsd;
  }
  return tryReserveSpend(settings, additionalUsd);
}

export async function beginResearchLock(date = utcToday()): Promise<boolean> {
  const service = getServiceClient();
  const { data, error } = await service.rpc("content_autopilot_begin_research", { p_usage_date: date });
  if (error) {
    const usage = await ensureDailyUsage(date);
    if (Boolean(usage.research_completed)) return false;
    await bumpUsage({ research_completed: true }, date);
    return true;
  }
  return Boolean(data);
}

export async function dailyLimitOk(
  settings: ContentAutopilotSettings,
  key:
    | "images"
    | "image_retries"
    | "videos"
    | "video_retries"
    | "production_concepts",
): Promise<boolean> {
  const usage = await ensureDailyUsage();
  if (key === "images") return Number(usage.images_generated || 0) < settings.maxImagesPerDay;
  if (key === "image_retries") return Number(usage.image_retries || 0) < settings.maxImageRetriesPerDay;
  if (key === "videos") return Number(usage.videos_generated || 0) < settings.maxVideosPerDay;
  if (key === "video_retries") return Number(usage.video_retries || 0) < settings.maxVideoRetriesPerDay;
  if (key === "production_concepts") return Number(usage.production_concepts || 0) < settings.productionConceptsPerDay;
  return true;
}
