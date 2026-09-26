import { describe, expect, it } from "vitest";

import { DEFAULT_NEW_RULE_DESTINATIONS, mapPublisherDestinationToSocialPlatform, socialPlatformsForDestinations } from "./destinations";
import { assetFitsAutopilotDestinations, selectLibraryAsset } from "./assignment";
import { fixtureAsset } from "./memoryRepo";
import { stableMediaRef, needsProviderSignature, parseClipFactoryMediaRef } from "./mediaUrl";
import {
  expectedTargetCount,
  isLiveDispatchAllowed,
  planSocialSync,
  shouldMarkPreActivation,
  syncIsIdempotent,
  youtubeShortsAutopilotOptions,
  youtubeShortsDescription,
  youtubeShortsTitle,
} from "./socialBridge";

const DESTINATIONS = ["instagram_reel_post", "facebook_reel_post", "youtube_short"] as const;

function publication(overrides: Record<string, unknown> = {}) {
  return {
    id: "pub-1",
    libraryAssetId: "asset-1",
    caption: "Holiday reel",
    approved: true,
    status: "scheduled",
    scheduledAt: "2026-09-27T10:00:00.000Z",
    timezone: "Europe/Bucharest",
    destinations: [...DESTINATIONS],
    ...overrides,
  };
}

const asset = { id: "asset-1", title: "Christmas Reel 23", src: "/api/clip-factory?action=media&kind=render&id=abc" };

describe("destination mapping", () => {
  it("maps Publisher destinations to social-publisher platforms", () => {
    expect(mapPublisherDestinationToSocialPlatform("instagram_reel_post")).toBe("instagram_reels");
    expect(mapPublisherDestinationToSocialPlatform("facebook_reel_post")).toBe("facebook_reels");
    expect(mapPublisherDestinationToSocialPlatform("youtube_short")).toBe("youtube_shorts");
    expect(mapPublisherDestinationToSocialPlatform("tiktok")).toBeNull();
    expect(mapPublisherDestinationToSocialPlatform("instagram_story")).toBeNull();
    expect(DEFAULT_NEW_RULE_DESTINATIONS).toEqual([...DESTINATIONS]);
    expect(socialPlatformsForDestinations([...DESTINATIONS])).toEqual([
      "instagram_reels",
      "facebook_reels",
      "youtube_shorts",
    ]);
  });
});

describe("publisher → social sync", () => {
  it("creates one social publication and three targets for IG + FB + YT", () => {
    const plan = planSocialSync({ publication: publication(), asset, existingSocial: null });
    expect(plan.action).toBe("upsert");
    if (plan.action !== "upsert") return;
    expect(plan.socialPublicationId).toBeNull();
    expect(plan.publication.platforms).toHaveLength(3);
    expect(plan.publication.targets.map((target) => target.platform)).toEqual([
      "instagram_reels",
      "facebook_reels",
      "youtube_shorts",
    ]);
    expect(expectedTargetCount([...DESTINATIONS])).toBe(3);
    expect(plan.addPlatforms).toHaveLength(3);
  });

  it("is idempotent when the same publication is synced twice", () => {
    const first = planSocialSync({ publication: publication(), asset, existingSocial: null });
    const existing = {
      id: "social-1",
      publisherPublicationId: "pub-1",
      targets: [
        { platform: "instagram_reels" as const, status: "scheduled", remotePostId: null },
        { platform: "facebook_reels" as const, status: "scheduled", remotePostId: null },
        { platform: "youtube_shorts" as const, status: "scheduled", remotePostId: null },
      ],
    };
    const second = planSocialSync({ publication: publication(), asset, existingSocial: existing });
    expect(first.action).toBe("upsert");
    expect(second.action).toBe("upsert");
    if (second.action !== "upsert") return;
    expect(second.socialPublicationId).toBe("social-1");
    expect(second.addPlatforms).toEqual([]);
    expect(second.cancelPlatforms).toEqual([]);
    expect(syncIsIdempotent(second, planSocialSync({ publication: publication(), asset, existingSocial: existing }))).toBe(
      true,
    );
  });

  it("does not make approval-required publications eligible until approved", () => {
    const pending = planSocialSync({
      publication: publication({ approved: false, status: "needs_approval" }),
      asset,
      existingSocial: null,
    });
    expect(pending).toMatchObject({ action: "skip", reason: "needs_approval" });
    const afterApprove = planSocialSync({
      publication: publication({ approved: true, status: "scheduled" }),
      asset,
      existingSocial: null,
    });
    expect(afterApprove.action).toBe("upsert");
  });

  it("reschedules by updating the planned scheduled_at", () => {
    const existing = {
      id: "social-1",
      publisherPublicationId: "pub-1",
      targets: [{ platform: "instagram_reels" as const, status: "scheduled", remotePostId: null }],
    };
    const plan = planSocialSync({
      publication: publication({ scheduledAt: "2026-09-28T18:00:00.000Z" }),
      asset,
      existingSocial: existing,
    });
    expect(plan.action).toBe("upsert");
    if (plan.action !== "upsert") return;
    expect(plan.publication.scheduledAt).toBe("2026-09-28T18:00:00.000Z");
  });

  it("cancels the linked social publication", () => {
    const plan = planSocialSync({
      publication: publication({ status: "cancelled" }),
      asset,
      existingSocial: { id: "social-1", publisherPublicationId: "pub-1", targets: [] },
    });
    expect(plan).toMatchObject({ action: "cancel", socialPublicationId: "social-1" });
  });

  it("replacement updates the planned asset without adding duplicate platforms", () => {
    const existing = {
      id: "social-1",
      publisherPublicationId: "pub-1",
      targets: [
        { platform: "instagram_reels" as const, status: "scheduled", remotePostId: null },
        { platform: "facebook_reels" as const, status: "scheduled", remotePostId: null },
        { platform: "youtube_shorts" as const, status: "scheduled", remotePostId: null },
      ],
    };
    const plan = planSocialSync({
      publication: publication({ libraryAssetId: "asset-2" }),
      asset: { id: "asset-2", title: "Replacement", src: "/assets/r.mp4" },
      existingSocial: existing,
    });
    expect(plan.action).toBe("upsert");
    if (plan.action !== "upsert") return;
    expect(plan.publication.libraryAssetId).toBe("asset-2");
    expect(plan.publication.assetTitle).toBe("Replacement");
    expect(plan.addPlatforms).toEqual([]);
  });

  it("does not repost a successful IG/YT target when Facebook still needs a retry", () => {
    const existing = {
      id: "social-1",
      publisherPublicationId: "pub-1",
      targets: [
        { platform: "instagram_reels" as const, status: "published", remotePostId: "ig_1" },
        { platform: "facebook_reels" as const, status: "failed", remotePostId: null },
        { platform: "youtube_shorts" as const, status: "published", remotePostId: "yt_1" },
      ],
    };
    const plan = planSocialSync({ publication: publication(), asset, existingSocial: existing });
    expect(plan.action).toBe("upsert");
    if (plan.action !== "upsert") return;
    expect(plan.addPlatforms).toEqual([]);
    expect(plan.preservePlatforms).toEqual(["instagram_reels", "youtube_shorts"]);
    expect(plan.preservePlatforms).not.toContain("facebook_reels");
  });
});

describe("autopilot live gate", () => {
  it("never dispatches when Autopilot is OFF", () => {
    expect(
      isLiveDispatchAllowed({
        livePostsEnabled: false,
        livePostsEnabledAtMs: Date.parse("2026-09-25T18:00:00.000Z"),
        scheduledAtMs: Date.parse("2026-09-27T10:00:00.000Z"),
        nowMs: Date.parse("2026-09-27T10:00:01.000Z"),
      }),
    ).toBe(false);
  });

  it("does not backfill items scheduled before activation", () => {
    const enabledAt = Date.parse("2026-09-25T18:00:00.000Z");
    expect(
      isLiveDispatchAllowed({
        livePostsEnabled: true,
        livePostsEnabledAtMs: enabledAt,
        scheduledAtMs: Date.parse("2026-09-25T12:00:00.000Z"),
        nowMs: Date.parse("2026-09-25T18:01:00.000Z"),
      }),
    ).toBe(false);
    expect(
      shouldMarkPreActivation({
        livePostsEnabledAtMs: enabledAt,
        scheduledAtMs: Date.parse("2026-09-25T12:00:00.000Z"),
        status: "scheduled",
      }),
    ).toBe(true);
    expect(
      isLiveDispatchAllowed({
        livePostsEnabled: true,
        livePostsEnabledAtMs: enabledAt,
        scheduledAtMs: Date.parse("2026-09-27T10:00:00.000Z"),
        nowMs: Date.parse("2026-09-27T10:00:01.000Z"),
      }),
    ).toBe(true);
  });
});

describe("YouTube Shorts autopilot payload", () => {
  it("uses the asset title, caps at 100 chars, appends #Shorts, and is public at execution", () => {
    expect(youtubeShortsTitle("A".repeat(140)).length).toBe(100);
    expect(youtubeShortsDescription("Caption")).toContain("#Shorts");
    expect(youtubeShortsDescription("Already #Shorts here")).toBe("Already #Shorts here");
    expect(youtubeShortsAutopilotOptions()).toMatchObject({
      privacyStatus: "public",
      madeForKids: false,
      categoryId: "24",
    });
  });
});

describe("library eligibility", () => {
  it("never selects long-form for Shorts Autopilot", () => {
    const longForm = fixtureAsset("lf", { kind: "long_form", category: "long_form", durationSeconds: 420 });
    expect(assetFitsAutopilotDestinations(longForm, [...DESTINATIONS])).toBe(false);
    const result = selectLibraryAsset({
      assets: [longForm],
      contentType: "video",
      destinations: [...DESTINATIONS],
      nowMs: Date.now(),
      cooldownDays: 14,
      assignedFutureAssetIds: new Set(),
      autoAssign: true,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("long_form");
  });

  it("requires vertical 9:16 MP4/MOV ≤60s when YouTube Short is selected", () => {
    expect(
      assetFitsAutopilotDestinations(fixtureAsset("wide", { width: 1920, height: 1080 }), [...DESTINATIONS]),
    ).toBe(false);
    expect(
      assetFitsAutopilotDestinations(fixtureAsset("long", { durationSeconds: 75 }), [...DESTINATIONS]),
    ).toBe(false);
    expect(assetFitsAutopilotDestinations(fixtureAsset("ok"), [...DESTINATIONS])).toBe(true);
  });
});

describe("clip factory media refs", () => {
  it("stores a stable Clip Factory path without exp/sig", () => {
    const signed =
      "/api/clip-factory?action=media&kind=render&id=abc&exp=1730000000&sig=deadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
    expect(stableMediaRef(signed)).toBe("/api/clip-factory?action=media&kind=render&id=abc");
    expect(needsProviderSignature(signed)).toBe(true);
    expect(parseClipFactoryMediaRef(signed)).toEqual({ kind: "render", id: "abc" });
    expect(needsProviderSignature("/assets/christmas/reel.mp4")).toBe(false);
    expect(stableMediaRef("/assets/christmas/reel.mp4?cache=1")).toBe("/assets/christmas/reel.mp4");
    expect(stableMediaRef("/api/christmas-reel-pipeline?action=media&id=97112bbb-f5a6-450a-a84e-06b93e175f2d")).toBe(
      "/api/christmas-reel-pipeline?action=media&id=97112bbb-f5a6-450a-a84e-06b93e175f2d",
    );
  });
});
