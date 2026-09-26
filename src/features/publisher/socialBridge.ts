import type { PlatformMetadata } from "../../../api/_lib/christmas-reel-pipeline/types";
import type { SocialPlatform } from "../social-publisher/types";
import {
  isAutopilotDestination,
  mapPublisherDestinationToSocialPlatform,
  socialPlatformsForDestinations,
} from "./destinations";
import type { PublisherDestination } from "./types";

export const YOUTUBE_SHORTS_TITLE_MAX = 100;
export const YOUTUBE_SHORTS_DEFAULT_CATEGORY = "24";
export const PRE_ACTIVATION_SKIP_REASON = "pre_activation";

export type SocialSyncSkipReason =
  | "needs_approval"
  | "no_asset"
  | "cancelled"
  | "no_mapped_platforms"
  | "needs_content";

export type PlannedSocialTarget = {
  platform: SocialPlatform;
  provider: "meta" | "youtube";
  status: "scheduled";
  idempotencyKeySuffix: string;
  platformTitle: string | null;
  platformOptions: Record<string, unknown>;
};

export type PlannedSocialPublication = {
  publisherPublicationId: string;
  libraryAssetId: string;
  assetTitle: string;
  assetSrc: string;
  caption: string;
  scheduledAt: string;
  timezone: string;
  platforms: SocialPlatform[];
  targets: PlannedSocialTarget[];
};

export type ExistingSocialTarget = {
  platform: SocialPlatform;
  status: string;
  remotePostId: string | null;
};

export type ExistingSocialPublication = {
  id: string;
  publisherPublicationId: string;
  targets: ExistingSocialTarget[];
};

export type SocialSyncPlan =
  | { action: "skip"; reason: SocialSyncSkipReason; publisherPublicationId: string }
  | { action: "cancel"; publisherPublicationId: string; socialPublicationId: string | null }
  | {
      action: "upsert";
      publisherPublicationId: string;
      socialPublicationId: string | null;
      publication: PlannedSocialPublication;
      addPlatforms: SocialPlatform[];
      cancelPlatforms: SocialPlatform[];
      preservePlatforms: SocialPlatform[];
    };

function providerForPlatform(platform: SocialPlatform): "meta" | "youtube" {
  return platform === "youtube_shorts" ? "youtube" : "meta";
}

export function youtubeShortsTitle(assetTitle: string): string {
  const title = String(assetTitle || "TDG Short").trim() || "TDG Short";
  return title.slice(0, YOUTUBE_SHORTS_TITLE_MAX);
}

export function youtubeShortsDescription(caption: string): string {
  const base = String(caption || "").trim();
  if (/#shorts\b/i.test(base)) return base.slice(0, 5000);
  return `${base}${base ? "\n\n" : ""}#Shorts`.slice(0, 5000);
}

export function youtubeShortsAutopilotOptions(existingCategory?: string | null): Record<string, unknown> {
  return {
    privacyStatus: "public",
    madeForKids: false,
    categoryId: String(existingCategory || YOUTUBE_SHORTS_DEFAULT_CATEGORY),
    tags: [],
    publishAt: null,
  };
}

export function planTargetsForPlatforms(input: {
  publisherPublicationId: string;
  assetTitle: string;
  caption: string;
  platforms: SocialPlatform[];
  platformMetadata?: PlatformMetadata | null;
}): PlannedSocialTarget[] {
  return input.platforms.map((platform) => ({
    platform,
    provider: providerForPlatform(platform),
    status: "scheduled" as const,
    idempotencyKeySuffix: platform,
    platformTitle:
      platform === "youtube_shorts"
        ? (input.platformMetadata?.youtube?.title || youtubeShortsTitle(input.assetTitle))
        : null,
    platformOptions:
      platform === "youtube_shorts"
        ? {
            ...youtubeShortsAutopilotOptions(),
            description: input.platformMetadata?.youtube?.description || youtubeShortsDescription(input.caption || input.assetTitle),
            tags: input.platformMetadata?.youtube?.tags || [],
          }
        : {},
  }));
}

export function planSocialSync(input: {
  publication: {
    id: string;
    libraryAssetId: string | null;
    caption: string;
    approved: boolean;
    status: string;
    scheduledAt: string;
    timezone: string;
    destinations: PublisherDestination[];
  };
  asset: { id: string; title: string; src: string; platformMetadata?: PlatformMetadata | null } | null;
  existingSocial: ExistingSocialPublication | null;
}): SocialSyncPlan {
  const publisherPublicationId = input.publication.id;
  if (input.publication.status === "cancelled") {
    return {
      action: "cancel",
      publisherPublicationId,
      socialPublicationId: input.existingSocial?.id || null,
    };
  }
  if (!input.publication.libraryAssetId || !input.asset) {
    if (input.existingSocial) {
      return { action: "cancel", publisherPublicationId, socialPublicationId: input.existingSocial.id };
    }
    return { action: "skip", reason: "no_asset", publisherPublicationId };
  }
  if (!input.publication.approved) {
    return { action: "skip", reason: "needs_approval", publisherPublicationId };
  }
  const platforms = socialPlatformsForDestinations(input.publication.destinations);
  if (!platforms.length) {
    return { action: "skip", reason: "no_mapped_platforms", publisherPublicationId };
  }

  const publication: PlannedSocialPublication = {
    publisherPublicationId,
    libraryAssetId: input.asset.id,
    assetTitle: input.asset.title,
    assetSrc: input.asset.src,
    caption: input.publication.caption || input.asset.title,
    scheduledAt: input.publication.scheduledAt,
    timezone: input.publication.timezone,
    platforms,
    targets: planTargetsForPlatforms({
      publisherPublicationId,
      assetTitle: input.asset.title,
      caption: input.publication.caption || input.asset.title,
      platforms,
      platformMetadata: input.asset.platformMetadata || null,
    }),
  };

  const existingPlatforms = new Set((input.existingSocial?.targets || []).map((target) => target.platform));
  const wanted = new Set(platforms);
  const addPlatforms = platforms.filter((platform) => !existingPlatforms.has(platform));
  const cancelPlatforms = [...existingPlatforms].filter((platform) => !wanted.has(platform));
  const preservePlatforms = platforms.filter((platform) => {
    const current = input.existingSocial?.targets.find((target) => target.platform === platform);
    return Boolean(current?.remotePostId) || current?.status === "published";
  });

  return {
    action: "upsert",
    publisherPublicationId,
    socialPublicationId: input.existingSocial?.id || null,
    publication,
    addPlatforms,
    cancelPlatforms,
    preservePlatforms,
  };
}

export function syncIsIdempotent(first: SocialSyncPlan, second: SocialSyncPlan): boolean {
  return JSON.stringify(first) === JSON.stringify(second);
}

export function isLiveDispatchAllowed(input: {
  livePostsEnabled: boolean;
  livePostsEnabledAtMs: number | null;
  scheduledAtMs: number;
  skipReason?: string | null;
  remotePostId?: string | null;
  nowMs: number;
}): boolean {
  if (input.remotePostId) return false;
  if (input.skipReason) return false;
  if (!input.livePostsEnabled) return false;
  if (input.livePostsEnabledAtMs == null) return false;
  if (input.scheduledAtMs < input.livePostsEnabledAtMs) return false;
  if (input.scheduledAtMs > input.nowMs) return false;
  return true;
}

export function shouldMarkPreActivation(input: {
  livePostsEnabledAtMs: number;
  scheduledAtMs: number;
  remotePostId?: string | null;
  skipReason?: string | null;
  status: string;
}): boolean {
  if (input.remotePostId) return false;
  if (input.skipReason) return false;
  if (input.status === "published" || input.status === "cancelled") return false;
  return input.scheduledAtMs <= input.livePostsEnabledAtMs;
}

export function mappedAutopilotDestinations(destinations: PublisherDestination[]): PublisherDestination[] {
  return destinations.filter(isAutopilotDestination);
}

export function platformCountForDestinations(destinations: PublisherDestination[]): number {
  return socialPlatformsForDestinations(destinations).length;
}

export function expectedTargetCount(destinations: PublisherDestination[]): number {
  return socialPlatformsForDestinations(destinations).length;
}

export { mapPublisherDestinationToSocialPlatform, socialPlatformsForDestinations };
