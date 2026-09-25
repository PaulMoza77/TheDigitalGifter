import { maxAutopilotDurationSeconds, socialPlatformsForDestinations } from "./destinations";
import type {
  PublisherContentType,
  PublisherDestination,
  PublisherLibraryAsset,
  PublisherPublication,
} from "./types";

export type AssignmentSkipReason =
  | "auto_assign_disabled"
  | "asset_missing"
  | "asset_not_ready"
  | "type_mismatch"
  | "excluded"
  | "already_assigned"
  | "reuse_cooldown"
  | "no_eligible_content"
  | "long_form"
  | "not_short_form";

export type AssignmentDecision =
  | { ok: true; assetId: string; reason: null }
  | { ok: false; assetId: null; reason: AssignmentSkipReason; detail: string };

function assetReady(asset: PublisherLibraryAsset): boolean {
  return asset.exists && asset.ready && !asset.processing && !asset.failed;
}

function typeMatches(asset: PublisherLibraryAsset, contentType: PublisherContentType): boolean {
  return asset.contentType === contentType;
}

function inCooldown(
  asset: PublisherLibraryAsset,
  destinations: PublisherDestination[],
  nowMs: number,
  cooldownDays: number,
): boolean {
  if (cooldownDays <= 0) return false;
  const windowMs = cooldownDays * 24 * 60 * 60 * 1000;
  return destinations.some((destination) => {
    const last = asset.lastUsedByDestination[destination];
    if (!last) return false;
    const usedMs = Date.parse(last);
    return Number.isFinite(usedMs) && nowMs - usedMs < windowMs;
  });
}

function neverUsed(asset: PublisherLibraryAsset): boolean {
  return Object.keys(asset.lastUsedByDestination).length === 0;
}

function isLongFormAsset(asset: PublisherLibraryAsset): boolean {
  return asset.kind === "long_form" || asset.category === "long_form";
}

function mediaExtension(asset: PublisherLibraryAsset): string {
  const fromName = String(asset.filename || "").toLowerCase().match(/\.([a-z0-9]+)(?:\?|$)/);
  if (fromName) return fromName[1];
  const fromSrc = String(asset.src || "").toLowerCase().match(/\.([a-z0-9]+)(?:\?|$)/);
  return fromSrc?.[1] || "";
}

export function assetFitsAutopilotDestinations(
  asset: PublisherLibraryAsset,
  destinations: PublisherDestination[],
): boolean {
  if (!socialPlatformsForDestinations(destinations).length) return true;
  if (isLongFormAsset(asset)) return false;
  if (asset.contentType !== "video") return false;
  const ext = mediaExtension(asset);
  if (ext && !["mp4", "mov"].includes(ext)) return false;
  const maxDuration = maxAutopilotDurationSeconds(destinations);
  if (maxDuration != null && asset.durationSeconds != null && asset.durationSeconds > maxDuration) return false;
  if (asset.width && asset.height) {
    if (Math.abs(asset.width / asset.height - 9 / 16) > 0.08) return false;
  }
  return true;
}

function leastRecentUsedMs(asset: PublisherLibraryAsset): number {
  const times = Object.values(asset.lastUsedByDestination)
    .map((value) => Date.parse(value))
    .filter((ms) => Number.isFinite(ms));
  if (!times.length) return 0;
  return Math.max(...times);
}

export function eligibleAssets(input: {
  assets: PublisherLibraryAsset[];
  contentType: PublisherContentType;
  destinations: PublisherDestination[];
  nowMs: number;
  cooldownDays: number;
  assignedFutureAssetIds: Set<string>;
  category?: string | null;
  tags?: string[];
}): PublisherLibraryAsset[] {
  return input.assets.filter((asset) => {
    if (!asset.exists) return false;
    if (!assetReady(asset)) return false;
    if (!typeMatches(asset, input.contentType)) return false;
    if (asset.excluded || !asset.eligible) return false;
    if (input.assignedFutureAssetIds.has(asset.id)) return false;
    if (!assetFitsAutopilotDestinations(asset, input.destinations)) return false;
    if (inCooldown(asset, input.destinations, input.nowMs, input.cooldownDays)) return false;
    if (input.category && asset.category !== input.category) return false;
    if (input.tags?.length) {
      const have = new Set(asset.tags.map((tag) => tag.toLowerCase()));
      if (!input.tags.every((tag) => have.has(tag.toLowerCase()))) return false;
    }
    return true;
  });
}

export function selectLibraryAsset(input: {
  assets: PublisherLibraryAsset[];
  contentType: PublisherContentType;
  destinations: PublisherDestination[];
  nowMs: number;
  cooldownDays: number;
  assignedFutureAssetIds: Set<string>;
  autoAssign: boolean;
  category?: string | null;
  tags?: string[];
}): AssignmentDecision {
  if (!input.autoAssign) {
    return { ok: false, assetId: null, reason: "auto_assign_disabled", detail: "Automatic Library assignment is off." };
  }
  const eligible = eligibleAssets(input);
  if (!eligible.length) {
    const anyType = input.assets.filter((asset) => typeMatches(asset, input.contentType));
    if (!anyType.length) {
      return { ok: false, assetId: null, reason: "type_mismatch", detail: "No Library assets match this content type." };
    }
    if (anyType.every((asset) => asset.excluded || !asset.eligible)) {
      return { ok: false, assetId: null, reason: "excluded", detail: "Matching assets are excluded from Publisher." };
    }
    if (anyType.every((asset) => !assetReady(asset) || !asset.exists)) {
      return { ok: false, assetId: null, reason: "asset_not_ready", detail: "Matching assets are still processing or failed." };
    }
    if (anyType.some((asset) => input.assignedFutureAssetIds.has(asset.id))) {
      return {
        ok: false,
        assetId: null,
        reason: "already_assigned",
        detail: "Eligible assets are already assigned to another future publication.",
      };
    }
    if (anyType.some((asset) => inCooldown(asset, input.destinations, input.nowMs, input.cooldownDays))) {
      return {
        ok: false,
        assetId: null,
        reason: "reuse_cooldown",
        detail: "Eligible assets are inside the reuse cooldown for these destinations.",
      };
    }
    if (anyType.some((asset) => isLongFormAsset(asset))) {
      return {
        ok: false,
        assetId: null,
        reason: "long_form",
        detail: "Long-form videos are never selected for Shorts Autopilot.",
      };
    }
    if (anyType.some((asset) => !assetFitsAutopilotDestinations(asset, input.destinations))) {
      return {
        ok: false,
        assetId: null,
        reason: "not_short_form",
        detail: "No vertical Reel ≤60s (MP4/MOV) is available for the selected destinations.",
      };
    }
    return { ok: false, assetId: null, reason: "no_eligible_content", detail: "No eligible Library asset is available." };
  }

  eligible.sort((a, b) => {
    const aNever = neverUsed(a) ? 0 : 1;
    const bNever = neverUsed(b) ? 0 : 1;
    if (aNever !== bNever) return aNever - bNever;
    const usedDelta = leastRecentUsedMs(a) - leastRecentUsedMs(b);
    if (usedDelta !== 0) return usedDelta;
    return a.id.localeCompare(b.id);
  });

  return { ok: true, assetId: eligible[0].id, reason: null };
}

export function futureAssignedAssetIds(
  publications: Array<Pick<PublisherPublication, "id" | "libraryAssetId" | "status" | "scheduledAt">>,
  nowMs: number,
  exceptPublicationId?: string,
): Set<string> {
  const ids = new Set<string>();
  for (const publication of publications) {
    if (exceptPublicationId && publication.id === exceptPublicationId) continue;
    if (!publication.libraryAssetId) continue;
    if (publication.status === "cancelled" || publication.status === "completed" || publication.status === "failed") {
      continue;
    }
    const scheduled = Date.parse(publication.scheduledAt);
    if (!Number.isFinite(scheduled) || scheduled < nowMs) continue;
    ids.add(publication.libraryAssetId);
  }
  return ids;
}

export function publicationDuplicateKey(
  libraryAssetId: string,
  scheduledAt: string,
  destinations: PublisherDestination[],
): string {
  const dest = [...destinations].sort().join(",");
  return `${libraryAssetId}|${scheduledAt}|${dest}`;
}
