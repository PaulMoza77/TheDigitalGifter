import { getServiceClient } from "../christmas/supabaseClient";
import { invokeSocialPublisher } from "../social-publisher/invoke";
import { publisherDestinationForSocialPlatform } from "../../../src/features/publisher/destinations";
import { stableMediaRef } from "../../../src/features/publisher/mediaUrl";
import {
  PRE_ACTIVATION_SKIP_REASON,
  planSocialSync,
  shouldMarkPreActivation,
  type ExistingSocialPublication,
} from "../../../src/features/publisher/socialBridge";
import { asDestinations } from "./map";
import { loadPublisherAssets } from "./library";

type DbClient = ReturnType<typeof getServiceClient>;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export async function loadAutopilotSettings(service: DbClient = getServiceClient()) {
  const { data } = await service.from("social_publisher_settings").select("*").eq("id", 1).maybeSingle();
  return {
    timezone: String(data?.timezone || "UTC"),
    livePostsEnabled: Boolean(data?.live_posts_enabled),
    livePostsEnabledAt: data?.live_posts_enabled_at ? String(data.live_posts_enabled_at) : null,
  };
}

export async function setAutopilotLivePosts(enabled: boolean, confirmed: boolean) {
  if (enabled && !confirmed) {
    throw new Error("Autopilot real posting requires an explicit confirmation.");
  }
  const service = getServiceClient();
  const nowIso = new Date().toISOString();
  if (enabled) {
    const { error } = await service
      .from("social_publisher_settings")
      .update({
        live_posts_enabled: true,
        live_posts_enabled_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", 1);
    if (error) throw error;
    await service.from("publisher_settings").update({ live_posts_enabled: true, updated_at: nowIso }).eq("id", 1);
    const enabledAtMs = Date.parse(nowIso);
    const { data: targets } = await service
      .from("social_publication_targets")
      .select("id,status,remote_post_id,skip_reason,publication_id")
      .is("remote_post_id", null)
      .neq("status", "published")
      .neq("status", "cancelled");
    const pubIds = [...new Set((targets || []).map((row) => String(row.publication_id)))];
    const pubs = pubIds.length
      ? (
          await service
            .from("social_publications")
            .select("id,scheduled_at")
            .in("id", pubIds)
        ).data || []
      : [];
    const scheduledAt = new Map(pubs.map((row) => [String(row.id), Date.parse(String(row.scheduled_at))]));
    const markIds = (targets || [])
      .filter((row) =>
        shouldMarkPreActivation({
          livePostsEnabledAtMs: enabledAtMs,
          scheduledAtMs: scheduledAt.get(String(row.publication_id)) || 0,
          remotePostId: row.remote_post_id ? String(row.remote_post_id) : null,
          skipReason: row.skip_reason ? String(row.skip_reason) : null,
          status: String(row.status),
        }),
      )
      .map((row) => String(row.id));
    if (markIds.length) {
      await service
        .from("social_publication_targets")
        .update({
          skip_reason: PRE_ACTIVATION_SKIP_REASON,
          last_error: "pre_activation: scheduled before Autopilot was enabled. Not published.",
          updated_at: nowIso,
        })
        .in("id", markIds);
    }
    return { ok: true, livePostsEnabled: true, livePostsEnabledAt: nowIso, preActivationSkipped: markIds.length };
  }

  const { error } = await service
    .from("social_publisher_settings")
    .update({ live_posts_enabled: false, updated_at: nowIso })
    .eq("id", 1);
  if (error) throw error;
  await service.from("publisher_settings").update({ live_posts_enabled: false, updated_at: nowIso }).eq("id", 1);
  return { ok: true, livePostsEnabled: false };
}

function syncPayloadFromPlan(plan: ReturnType<typeof planSocialSync>) {
  if (plan.action === "skip") {
    return { publisher_publication_id: plan.publisherPublicationId, op: "skip", reason: plan.reason };
  }
  if (plan.action === "cancel") {
    return {
      publisher_publication_id: plan.publisherPublicationId,
      op: "cancel",
      social_publication_id: plan.socialPublicationId,
    };
  }
  return {
    publisher_publication_id: plan.publisherPublicationId,
    op: "upsert",
    social_publication_id: plan.socialPublicationId,
    publication: {
      ...plan.publication,
      assetSrc: stableMediaRef(plan.publication.assetSrc),
    },
    add_platforms: plan.addPlatforms,
    cancel_platforms: plan.cancelPlatforms,
    preserve_platforms: plan.preservePlatforms,
  };
}

export async function syncPublisherSocialBridge(publicationIds?: string[]) {
  const service = getServiceClient();
  const assets = await loadPublisherAssets();
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  let pubQuery = service.from("publisher_publications").select("*").limit(400);
  if (publicationIds?.length) pubQuery = pubQuery.in("id", publicationIds);
  const { data: publications, error } = await pubQuery;
  if (error) throw error;
  const ids = (publications || []).map((row) => String(row.id));
  const { data: existingSocial } = ids.length
    ? await service.from("social_publications").select("id,publisher_publication_id").in("publisher_publication_id", ids)
    : { data: [] as Array<{ id: string; publisher_publication_id: string }> };
  const socialIds = (existingSocial || []).map((row) => String(row.id));
  const { data: targets } = socialIds.length
    ? await service
        .from("social_publication_targets")
        .select("publication_id,platform,status,remote_post_id")
        .in("publication_id", socialIds)
    : { data: [] as Array<Record<string, unknown>> };
  const targetsBySocial = new Map<string, ExistingSocialPublication["targets"]>();
  for (const target of targets || []) {
    const list = targetsBySocial.get(String(target.publication_id)) || [];
    list.push({
      platform: target.platform as ExistingSocialPublication["targets"][number]["platform"],
      status: String(target.status),
      remotePostId: target.remote_post_id ? String(target.remote_post_id) : null,
    });
    targetsBySocial.set(String(target.publication_id), list);
  }
  const socialByPublisher = new Map<string, ExistingSocialPublication>();
  for (const row of existingSocial || []) {
    socialByPublisher.set(String(row.publisher_publication_id), {
      id: String(row.id),
      publisherPublicationId: String(row.publisher_publication_id),
      targets: targetsBySocial.get(String(row.id)) || [],
    });
  }

  const payloads = (publications || []).map((row) => {
    const assetId = row.library_asset_id ? String(row.library_asset_id) : null;
    const asset = assetId ? assetById.get(assetId) : null;
    const plan = planSocialSync({
      publication: {
        id: String(row.id),
        libraryAssetId: assetId,
        caption: String(row.caption || ""),
        approved: Boolean(row.approved),
        status: String(row.status),
        scheduledAt: String(row.scheduled_at),
        timezone: String(row.timezone || "Europe/Bucharest"),
        destinations: asDestinations(row.destinations),
      },
      asset: asset
        ? {
            id: asset.id,
            title: asset.title,
            src: stableMediaRef(asset.src),
            platformMetadata: (asset.platformMetadata as import("./_lib/christmas-reel-pipeline/types").PlatformMetadata | undefined) || null,
          }
        : null,
      existingSocial: socialByPublisher.get(String(row.id)) || null,
    });
    return syncPayloadFromPlan(plan);
  });

  if (!payloads.length) return { ok: true, synced: 0 };
  const result = await invokeSocialPublisher({ action: "publisher_sync", publications: payloads });
  if (!result.ok) {
    throw new Error(String(result.json.error || result.json.message || `publisher_sync failed (${result.status})`));
  }
  return { ok: true, synced: payloads.length, result: result.json };
}

const SOCIAL_TO_PUBLISHER_STATUS: Record<string, string> = {
  scheduled: "scheduled",
  queued: "scheduled",
  uploading: "processing",
  processing: "processing",
  published: "completed",
  failed: "failed",
  cancelled: "cancelled",
  draft: "needs_content",
};

export async function reflectSocialTargetStatus() {
  const service = getServiceClient();
  const { data: socialPubs } = await service
    .from("social_publications")
    .select("id,publisher_publication_id,status")
    .not("publisher_publication_id", "is", null)
    .limit(400);
  if (!socialPubs?.length) return { updated: 0 };
  const socialIds = socialPubs.map((row) => String(row.id));
  const { data: targets } = await service
    .from("social_publication_targets")
    .select("publication_id,platform,status,remote_post_id,remote_url,last_error,skip_reason")
    .in("publication_id", socialIds);
  const byPublisher = new Map<string, typeof targets>();
  const socialToPublisher = new Map(socialPubs.map((row) => [String(row.id), String(row.publisher_publication_id)]));
  for (const target of targets || []) {
    const publisherId = socialToPublisher.get(String(target.publication_id));
    if (!publisherId) continue;
    const list = byPublisher.get(publisherId) || [];
    list.push(target);
    byPublisher.set(publisherId, list);
  }
  let updated = 0;
  for (const [publisherId, rows] of byPublisher) {
    for (const target of rows || []) {
      const destination = publisherDestinationForSocialPlatform(target.platform as never);
      if (!destination) continue;
      const status = SOCIAL_TO_PUBLISHER_STATUS[String(target.status)] || "scheduled";
      const lastError = target.skip_reason
        ? `${target.skip_reason}: excluded from the live worker.`
        : target.last_error;
      await service
        .from("publisher_destination_jobs")
        .update({
          status,
          remote_post_id: target.remote_post_id || null,
          remote_url: target.remote_url || null,
          last_error: lastError || null,
          last_error_code: target.skip_reason || null,
          updated_at: new Date().toISOString(),
        })
        .eq("publication_id", publisherId)
        .eq("destination", destination);
      if (status === "completed" && target.remote_post_id) {
        const { data: pub } = await service
          .from("publisher_publications")
          .select("library_asset_id")
          .eq("id", publisherId)
          .maybeSingle();
        if (pub?.library_asset_id) {
          const { data: state } = await service
            .from("publisher_asset_state")
            .select("last_used_by_destination")
            .eq("library_asset_id", pub.library_asset_id)
            .maybeSingle();
          const lastUsed = { ...((state?.last_used_by_destination as Record<string, string>) || {}), [destination]: new Date().toISOString() };
          await service.from("publisher_asset_state").upsert({
            library_asset_id: pub.library_asset_id,
            last_used_by_destination: lastUsed,
            updated_at: new Date().toISOString(),
          });
        }
      }
      updated += 1;
    }
  }
  return { updated };
}

export async function loadPlatformConnectionLabels(service: DbClient) {
  const { data: accounts } = await service
    .from("social_accounts")
    .select("provider,status,metadata")
    .in("status", ["connected", "expired"])
    .order("updated_at", { ascending: false });
  const meta = (accounts || []).find((row) => row.provider === "meta" && row.status === "connected");
  const youtube = (accounts || []).find((row) => row.provider === "youtube" && row.status === "connected");
  const metaMeta = asRecord(meta?.metadata);
  const ytMeta = asRecord(youtube?.metadata);
  const missing = Array.isArray(metaMeta.missing_permissions)
    ? metaMeta.missing_permissions.map(String)
    : [];
  const igReady = Boolean(meta && metaMeta.instagram_user_id) && !missing.includes("instagram_content_publish") && !missing.includes("instagram_basic");
  const fbReady = Boolean(meta && (metaMeta.page_id || metaMeta.facebook_page_id)) && !missing.includes("pages_manage_posts");
  const ytReady = Boolean(youtube && ytMeta.youtube_upload_ready !== false && (ytMeta.youtube_channel_id || youtube?.status === "connected"));
  return {
    instagram: { status: igReady ? "connected" : "blocked", detail: String(metaMeta.instagram_username || "") },
    facebook: { status: fbReady ? "connected" : "blocked", detail: String(metaMeta.page_name || metaMeta.facebook_page_name || "") },
    youtube_shorts: {
      status: ytReady ? "connected" : "blocked",
      detail: String(ytMeta.youtube_channel_title || ytMeta.youtube_channel_handle || ""),
    },
  };
}
