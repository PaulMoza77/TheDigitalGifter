import { describe, expect, it } from "vitest";

import { previewBulkSchedule } from "./bulkSchedule";
import {
  buildMetaBusinessLoginUrl,
  diffMetaPermissions,
  isAllowedAdminReturn,
  metaRetryPlan,
  publicPageSummary,
  sanitizeProviderError,
  selectLinkedProfessionalPage,
} from "./meta";
import { isAllowedAdminReturn as originAdminReturn } from "../../../api/_lib/metaAdminReturn";
import { buildMetaAuthorizeUrl, buildTikTokAuthorizeUrl, buildYouTubeAuthorizeUrl } from "./oauth";
import {
  diffYouTubeScopes,
  isExactYouTubeRedirectUri,
  youtubeOauthRedirectUri,
  youtubeQueueState,
  youtubeRetryPlan,
} from "./youtube";
import { PLATFORM_CONSTRAINTS } from "./platforms";
import {
  canRetryTarget,
  isDueForClaim,
  rollupPublicationStatus,
  shouldSkipPublish,
  targetIdempotencyKey,
} from "./status";
import { resolveDefaultTimezone, zonedWallTimeToUtcMs } from "./timezone";
import { snapshotFromCatalog, validateLibraryAssetForPlatforms } from "./validateMedia";
import { executeTargetPublish, selectClaimable } from "./worker";
import type { LibraryAssetSnapshot, SocialPlatform } from "./types";

const ALL: SocialPlatform[] = ["instagram_reels", "facebook_reels", "tiktok", "youtube_shorts"];

const reel: LibraryAssetSnapshot = {
  id: "reel-cut3",
  title: "Christmas Reel 23",
  src: "/assets/christmas/instagram-reel-cut3/final_christmas_reel_cut3.mp4",
  filename: "final_christmas_reel_cut3.mp4",
  kind: "reel",
  durationSeconds: 15,
  width: 1080,
  height: 1920,
  container: "mp4",
  codec: "h264",
  exists: true,
};

describe("timezone", () => {
  it("converts Europe/Bucharest wall time without hardcoding it as the app default", () => {
    const ms = zonedWallTimeToUtcMs("2026-09-20", "19:00", "Europe/Bucharest");
    expect(new Date(ms).toISOString()).toBe("2026-09-20T16:00:00.000Z");
    expect(resolveDefaultTimezone({})).toBe("UTC");
    expect(resolveDefaultTimezone({ settingsTimezone: "America/New_York" })).toBe("America/New_York");
    expect(resolveDefaultTimezone({ plannerTimezone: "Europe/Bucharest" })).toBe("Europe/Bucharest");
    expect(resolveDefaultTimezone({ settingsTimezone: "not-a-zone", browserTimezone: "UTC" })).toBe("UTC");
  });
});

describe("media validation", () => {
  it("accepts a vertical 1080x1920 H.264 MP4 Reel for all four platforms", () => {
    const result = validateLibraryAssetForPlatforms(reel, ALL);
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("rejects missing media, photos, landscape, long duration, and oversized files", () => {
    expect(validateLibraryAssetForPlatforms({ ...reel, exists: false }, ["tiktok"]).ok).toBe(false);
    expect(
      validateLibraryAssetForPlatforms({ ...reel, kind: "photo", filename: "still.jpg" }, ["instagram_reels"]).issues[0]
        ?.code,
    ).toBe("not_a_reel");
    expect(
      validateLibraryAssetForPlatforms({ ...reel, width: 1920, height: 1080 }, ["youtube_shorts"]).issues.some(
        (i) => i.code === "aspect_ratio",
      ),
    ).toBe(true);
    expect(
      validateLibraryAssetForPlatforms({ ...reel, durationSeconds: 90 }, ["tiktok", "youtube_shorts"]).issues.some(
        (i) => i.platform === "tiktok" && i.code === "too_long",
      ),
    ).toBe(true);
    expect(
      validateLibraryAssetForPlatforms({ ...reel, fileSizeBytes: 2 * 1024 * 1024 * 1024 }, ["instagram_reels"]).issues.some(
        (i) => i.code === "file_size",
      ),
    ).toBe(true);
  });

  it("snapshots catalog reels as 9:16 H.264 by default", () => {
    const snap = snapshotFromCatalog({
      id: "reel-final",
      title: "Final",
      src: "/x.mp4",
      filename: "x.mp4",
      kind: "reel",
      durationSeconds: 13,
    });
    expect(snap.width).toBe(1080);
    expect(snap.height).toBe(1920);
    expect(snap.codec).toBe("h264");
  });
});

describe("publication status", () => {
  it("marks partial when one target fails and does not treat published targets as retryable", () => {
    expect(
      rollupPublicationStatus([
        { status: "published" },
        { status: "published" },
        { status: "published" },
        { status: "failed" },
      ]),
    ).toBe("partial");
    expect(rollupPublicationStatus([{ status: "published" }, { status: "published" }])).toBe("published");
    expect(rollupPublicationStatus([{ status: "failed" }, { status: "failed" }])).toBe("failed");
    expect(rollupPublicationStatus([{ status: "scheduled" }, { status: "scheduled" }])).toBe("scheduled");
    expect(canRetryTarget({ status: "failed", remotePostId: null })).toBe(true);
    expect(canRetryTarget({ status: "published", remotePostId: "ig_1" })).toBe(false);
    expect(shouldSkipPublish({ status: "published", remotePostId: "ig_1" })).toBe(true);
    expect(targetIdempotencyKey("pub-1", "tiktok")).toBe("pub-1:tiktok");
  });

  it("claims only due scheduled targets whose lease expired", () => {
    const base = {
      remotePostId: null as string | null,
      scheduledAtMs: 1000,
      publicationStatus: "scheduled" as const,
      nextRetryAtMs: null as number | null,
      leaseExpiresAtMs: null as number | null,
      nowMs: 2000,
      status: "scheduled" as const,
    };
    expect(isDueForClaim(base)).toBe(true);
    expect(isDueForClaim({ ...base, scheduledAtMs: 5000 })).toBe(false);
    expect(isDueForClaim({ ...base, remotePostId: "x" })).toBe(false);
    expect(isDueForClaim({ ...base, status: "published" })).toBe(false);
    expect(isDueForClaim({ ...base, leaseExpiresAtMs: 3000 })).toBe(false);
    expect(isDueForClaim({ ...base, publicationStatus: "cancelled" })).toBe(false);
  });
});

describe("bulk scheduler", () => {
  it("spreads 20 reels across 3 posts/day without publishing immediately", () => {
    const ids = Array.from({ length: 20 }, (_, i) => `reel-${i + 1}`);
    const preview = previewBulkSchedule({
      assetIds: ids,
      platforms: ALL,
      startDate: "2026-09-20",
      times: ["10:00", "15:00", "20:00"],
      postsPerDay: 3,
      timezone: "UTC",
      nowMs: Date.parse("2026-09-19T12:00:00.000Z"),
    });
    expect(preview.ok).toBe(true);
    expect(preview.slots).toHaveLength(20);
    expect(preview.slots[0]).toMatchObject({ assetId: "reel-1", localDate: "2026-09-20", localTime: "10:00" });
    expect(preview.slots[2]).toMatchObject({ localDate: "2026-09-20", localTime: "20:00" });
    expect(preview.slots[3]).toMatchObject({ localDate: "2026-09-21", localTime: "10:00" });
    expect(preview.slots.at(-1)?.localDate).toBe("2026-09-26");
    expect(preview.slots.every((slot) => Date.parse(slot.scheduledAtIso) > Date.parse("2026-09-19T12:00:00.000Z"))).toBe(
      true,
    );
  });

  it("skips wall-clock times that are already past", () => {
    const preview = previewBulkSchedule({
      assetIds: ["a", "b"],
      platforms: ["tiktok"],
      startDate: "2026-09-20",
      times: ["10:00", "15:00"],
      postsPerDay: 2,
      timezone: "UTC",
      nowMs: Date.parse("2026-09-20T12:00:00.000Z"),
    });
    expect(preview.slots[0]?.localTime).toBe("15:00");
    expect(preview.slots[1]?.localDate).toBe("2026-09-21");
  });
});

describe("worker locking and adapters", () => {
  it("selects a stable claim set so two workers cannot take the same ids from one snapshot", () => {
    const rows = [
      { id: "b", scheduledAtMs: 20 },
      { id: "a", scheduledAtMs: 10 },
      { id: "c", scheduledAtMs: 30 },
    ];
    const first = selectClaimable(rows, 2, () => true);
    const second = selectClaimable(
      rows.filter((row) => !first.some((taken) => taken.id === row.id)),
      2,
      () => true,
    );
    expect(first.map((r) => r.id)).toEqual(["a", "b"]);
    expect(second.map((r) => r.id)).toEqual(["c"]);
  });

  it("does not call the adapter again when a target already has a remote post id", async () => {
    let called = 0;
    const result = await executeTargetPublish({
      target: {
        id: "t1",
        platform: "tiktok",
        status: "failed",
        remotePostId: "tt_already",
      },
      caption: "hi",
      hashtags: "",
      videoUrl: "https://example.com/a.mp4",
      account: {
        provider: "tiktok",
        accountId: "1",
        status: "connected",
        accessToken: "secret",
        metadata: {},
      },
      allowLivePosts: true,
      adapter: async () => {
        called += 1;
        return { ok: true, remotePostId: "nope", provider: "tiktok" };
      },
    });
    expect(called).toBe(0);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.remotePostId).toBe("tt_already");
  });

  it("retries only disconnected/failed targets and never invents a live post", async () => {
    const disconnected = await executeTargetPublish({
      target: { id: "t2", platform: "instagram_reels", status: "scheduled" },
      caption: "c",
      hashtags: "",
      videoUrl: "https://example.com/a.mp4",
      account: null,
      allowLivePosts: true,
      adapter: async () => ({ ok: true, remotePostId: "x", provider: "meta" }),
    });
    expect(disconnected.ok).toBe(false);
    if (!disconnected.ok) expect(disconnected.code).toBe("account_disconnected");

    const dry = await executeTargetPublish({
      target: { id: "t3", platform: "youtube_shorts", status: "scheduled" },
      caption: "c",
      hashtags: "",
      videoUrl: "https://example.com/a.mp4",
      account: {
        provider: "youtube",
        accountId: "1",
        status: "connected",
        accessToken: "tok",
        metadata: {},
      },
      allowLivePosts: false,
      adapter: async () => ({ ok: true, remotePostId: "should-not", provider: "youtube" }),
    });
    expect(dry.ok).toBe(false);
    if (!dry.ok) {
      expect(dry.code).toBe("live_posting_disabled");
      expect(dry.waitingForApproval).toBe(true);
    }
  });
});

describe("oauth builders", () => {
  it("points at official authorize endpoints and never embeds client secrets", () => {
    const meta = buildMetaAuthorizeUrl({
      appId: "app",
      redirectUri: "https://example.com/cb",
      state: "s",
    });
    expect(meta).toContain("facebook.com/v21.0/dialog/oauth");
    expect(meta).toContain("instagram_content_publish");
    const business = buildMetaAuthorizeUrl({
      appId: "1771898293934621",
      redirectUri: "https://www.thedigitalgifter.com/api/meta-oauth/callback",
      state: "csrf-state",
      configurationId: "1117038350677281",
    });
    expect(business).toContain("config_id=1117038350677281");
    expect(business).toContain("state=csrf-state");
    expect(business).toContain("response_type=code");
    expect(business).not.toContain("client_secret");
    expect(business).not.toContain("scope=");
    expect(buildMetaBusinessLoginUrl({
      appId: "app",
      redirectUri: "https://www.thedigitalgifter.com/api/meta-oauth/callback",
      state: "s",
      configurationId: "cfg",
    })).toContain("override_default_response_type=true");
    expect(buildTikTokAuthorizeUrl({ clientKey: "k", redirectUri: "https://example.com/cb", state: "s" })).toContain(
      "tiktok.com/v2/auth/authorize",
    );
    expect(buildYouTubeAuthorizeUrl({ clientId: "id", redirectUri: "https://example.com/cb", state: "s" })).toContain(
      "accounts.google.com/o/oauth2/v2/auth",
    );
    const yt = buildYouTubeAuthorizeUrl({
      clientId: "id",
      redirectUri: "https://www.thedigitalgifter.com/api/admin/social/youtube/callback",
      state: "s",
    });
    expect(yt).toContain("youtube.upload");
    expect(yt).toContain("youtube.readonly");
    expect(yt).toContain("youtube.force-ssl");
    expect(yt).toContain("access_type=offline");
    expect(yt).toContain("prompt=consent");
    expect(yt).not.toContain("client_secret");
    expect(
      youtubeOauthRedirectUri({
        publicBaseUrl: "https://www.thedigitalgifter.com",
      }),
    ).toBe("https://www.thedigitalgifter.com/api/admin/social/youtube/callback");
    expect(
      isExactYouTubeRedirectUri(
        "https://www.thedigitalgifter.com/api/admin/social/youtube/callback",
        "https://www.thedigitalgifter.com/api/admin/social/youtube/callback",
      ),
    ).toBe(true);
    expect(
      isExactYouTubeRedirectUri(
        "https://evil.example/api/admin/social/youtube/callback",
        "https://www.thedigitalgifter.com/api/admin/social/youtube/callback",
      ),
    ).toBe(false);
    expect(diffYouTubeScopes(["https://www.googleapis.com/auth/youtube.upload"]).missing).toContain(
      "https://www.googleapis.com/auth/youtube.readonly",
    );
    expect(diffYouTubeScopes(["https://www.googleapis.com/auth/youtube.upload"]).missing).toContain(
      "https://www.googleapis.com/auth/youtube.force-ssl",
    );
    expect(youtubeQueueState("scheduled")).toBe("queued");
    expect(youtubeQueueState("uploading")).toBe("uploading");
    expect(
      youtubeRetryPlan({
        platform: "youtube_shorts",
        attempts: 1,
        retryable: true,
        remotePostId: null,
        nowMs: Date.parse("2026-09-23T12:00:00.000Z"),
      }).status,
    ).toBe("scheduled");
    expect(
      youtubeRetryPlan({
        platform: "youtube_shorts",
        attempts: 1,
        retryable: true,
        remotePostId: "yt_123",
        nowMs: Date.parse("2026-09-23T12:00:00.000Z"),
      }).nextRetryAt,
    ).toBeNull();
    expect(JSON.stringify(PLATFORM_CONSTRAINTS)).not.toMatch(/sk_|secret|EAA/);
  });
});

describe("meta account selection", () => {
  it("keeps the Facebook Page that has a linked professional Instagram account", () => {
    const selected = selectLinkedProfessionalPage([
      { id: "page-a", name: "Other", accessToken: "page-token-a" },
      {
        id: "page-b",
        name: "The Digital Gifter",
        accessToken: "page-token-b",
        instagram: { id: "ig-1", username: "thedigitalgifter", accountType: "BUSINESS" },
      },
    ]);
    expect(selected.reason).toBe("ok");
    expect(selected.page?.id).toBe("page-b");
    expect(JSON.stringify(publicPageSummary(selected.page))).not.toContain("page-token");
  });

  it("rejects a personal Instagram account and an open redirect", () => {
    const personal = selectLinkedProfessionalPage([
      {
        id: "page-a",
        name: "Page",
        instagram: { id: "ig-1", username: "personal", accountType: "PERSONAL" },
      },
    ]);
    expect(personal.reason).toBe("instagram_not_professional");
    const permissions = diffMetaPermissions(["pages_show_list", "instagram_content_publishing"]);
    expect(permissions.granted).toContain("instagram_content_publish");
    expect(permissions.missing).toContain("pages_manage_posts");
    expect(isAllowedAdminReturn("https://evil.example/admin/social-accounts", "https://www.thedigitalgifter.com")).toBe(
      false,
    );
    expect(
      isAllowedAdminReturn("https://www.thedigitalgifter.com/admin/social-accounts", "https://www.thedigitalgifter.com"),
    ).toBe(true);
    expect(originAdminReturn("https://evil.example/admin/social-accounts", "https://www.thedigitalgifter.com")).toBe(false);
    expect(
      originAdminReturn(
        "https://www.thedigitalgifter.com/admin/social-accounts?oauth=error&message=oauth_failed",
        "https://www.thedigitalgifter.com",
      ),
    ).toBe(true);
    const sanitized = sanitizeProviderError("failed access_token=EAABsecretvalue1234567890 extra");
    expect(sanitized).not.toContain("EAABsecret");
    expect(sanitized).toContain("[redacted]");
  });

  it("retries a Meta target without creating a second post after the remote id exists", () => {
    expect(
      metaRetryPlan({
        platform: "instagram_reels",
        attempts: 1,
        retryable: true,
        remotePostId: null,
        nowMs: Date.parse("2026-09-23T12:00:00.000Z"),
      }).status,
    ).toBe("scheduled");
    expect(
      metaRetryPlan({
        platform: "instagram_photo",
        attempts: 3,
        retryable: true,
        remotePostId: null,
        nowMs: Date.parse("2026-09-23T12:00:00.000Z"),
      }).status,
    ).toBe("failed");
    expect(
      metaRetryPlan({
        platform: "facebook_video",
        attempts: 1,
        retryable: true,
        remotePostId: "fb_123",
        nowMs: Date.parse("2026-09-23T12:00:00.000Z"),
      }).nextRetryAt,
    ).toBeNull();
    expect(
      metaRetryPlan({
        platform: "youtube_shorts",
        attempts: 1,
        retryable: true,
        remotePostId: null,
        nowMs: Date.parse("2026-09-23T12:00:00.000Z"),
      }).status,
    ).toBe("failed");
    expect(
      youtubeRetryPlan({
        platform: "youtube_video",
        attempts: 1,
        retryable: true,
        remotePostId: null,
        nowMs: Date.parse("2026-09-23T12:00:00.000Z"),
      }).status,
    ).toBe("scheduled");
  });
});
