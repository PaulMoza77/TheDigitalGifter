export type AdapterResult =
  | { ok: true; remotePostId: string; remoteUrl?: string | null; provider: "meta" | "tiktok" | "youtube" }
  | {
      ok: false;
      code: string;
      message: string;
      retryable: boolean;
      waitingForApproval?: boolean;
      containerId?: string | null;
    };

type Account = {
  provider: "meta" | "tiktok" | "youtube";
  accountId: string;
  status: string;
  accessToken: string;
  metadata: Record<string, unknown>;
};

function asString(value: unknown): string {
  return String(value ?? "").trim();
}

function waiting(message: string): AdapterResult {
  const safe = String(message || "")
    .replace(/access_token=[^&\s]+/gi, "access_token=[redacted]")
    .replace(/EAA[A-Za-z0-9]{10,}/g, "[redacted]")
    .slice(0, 240);
  return {
    ok: false,
    code: "waiting_for_provider_approval",
    message: `IMPLEMENTED — WAITING FOR PROVIDER APPROVAL. ${safe}`,
    retryable: true,
    waitingForApproval: true,
  };
}

function fail(code: string, message: string, retryable = true, containerId?: string | null): AdapterResult {
  const messageSafe = String(message || "provider_error")
    .replace(/access_token=[^&\s]+/gi, "access_token=[redacted]")
    .replace(/EAA[A-Za-z0-9]{10,}/g, "[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 280);
  return { ok: false, code, message: messageSafe || "provider_error", retryable, containerId: containerId || null };
}

async function instagramPermalink(mediaId: string, token: string): Promise<string | null> {
  const status = await graphGet(mediaId, token, { fields: "permalink" });
  const permalink = asString(status.json.permalink);
  return permalink || null;
}

async function graphGet(path: string, token: string, params: Record<string, string> = {}) {
  const url = new URL(`https://graph.facebook.com/v21.0/${path.replace(/^\//, "")}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const json = (await res.json()) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, json };
}

async function graphPost(path: string, token: string, body: Record<string, string>) {
  const url = new URL(`https://graph.facebook.com/v21.0/${path.replace(/^\//, "")}`);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body),
  });
  const json = (await res.json()) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, json };
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

function metaToken(account: Account): string {
  return asString(account.metadata.page_access_token) || account.accessToken;
}

export async function publishInstagram(input: {
  videoUrl: string;
  caption: string;
  account: Account;
  mediaKind?: "photo" | "video" | "reel";
  containerId?: string | null;
}): Promise<AdapterResult> {
  const igUserId = asString(input.account.metadata.instagram_user_id) || asString(input.account.metadata.ig_user_id);
  const token = metaToken(input.account);
  if (!igUserId) {
    return fail(
      "missing_instagram_user",
      "Instagram professional account id is missing. Reconnect Meta and select a Page with an Instagram account.",
    );
  }
  const kind = input.mediaKind || "reel";
  let creationId = asString(input.containerId);
  if (!creationId) {
    const body: Record<string, string> =
      kind === "photo"
        ? { image_url: input.videoUrl, caption: input.caption }
        : kind === "video"
          ? {
              media_type: "VIDEO",
              video_url: input.videoUrl,
              caption: input.caption,
              share_to_feed: "true",
            }
          : {
              media_type: "REELS",
              video_url: input.videoUrl,
              caption: input.caption,
              share_to_feed: "true",
            };
    const create = await graphPost(`${igUserId}/media`, token, body);
    creationId = asString(create.json.id);
    if (!create.ok || !creationId) {
      const err = asString((create.json.error as { message?: string } | undefined)?.message) || "instagram_create_failed";
      if (/permission|not been authorized|insufficient/i.test(err)) {
        return waiting(`Instagram Graph publish: ${err}`);
      }
      return fail("instagram_create_failed", err);
    }
  }

  if (kind !== "photo") {
    for (let i = 0; i < 12; i++) {
      const status = await graphGet(creationId, token, { fields: "status_code" });
      const code = asString(status.json.status_code);
      if (code === "FINISHED") break;
      if (code === "ERROR") return fail("instagram_processing_failed", "Instagram could not process the media.", false, creationId);
      if (i === 11) return fail("instagram_processing_timeout", "Instagram is still processing the media.", true, creationId);
      await sleep(5000);
    }
  }

  const publish = await graphPost(`${igUserId}/media_publish`, token, {
    creation_id: creationId,
  });
  const postId = asString(publish.json.id);
  if (!publish.ok || !postId) {
    const err = asString((publish.json.error as { message?: string } | undefined)?.message) || "instagram_publish_failed";
    return fail("instagram_publish_failed", err, true, creationId);
  }
  const permalink = await instagramPermalink(postId, token);
  return {
    ok: true,
    remotePostId: postId,
    remoteUrl: permalink || (kind === "reel" ? `https://www.instagram.com/reel/${postId}/` : null),
    provider: "meta",
  };
}

export async function publishFacebookPhoto(input: {
  imageUrl: string;
  caption: string;
  account: Account;
}): Promise<AdapterResult> {
  const pageId = asString(input.account.metadata.facebook_page_id) || asString(input.account.metadata.page_id);
  const pageToken = metaToken(input.account);
  if (!pageId) return fail("missing_facebook_page", "Facebook Page id is missing. Reconnect Meta and choose a Page.");
  const posted = await graphPost(`${pageId}/photos`, pageToken, {
    url: input.imageUrl,
    caption: input.caption,
    published: "true",
  });
  const postId = asString(posted.json.post_id) || asString(posted.json.id);
  if (!posted.ok || !postId) {
    const err = asString((posted.json.error as { message?: string } | undefined)?.message) || "facebook_photo_failed";
    if (/permission|not been authorized|insufficient/i.test(err)) return waiting(`Facebook photo: ${err}`);
    return fail("facebook_photo_failed", err);
  }
  return {
    ok: true,
    remotePostId: postId,
    remoteUrl: `https://www.facebook.com/${postId}`,
    provider: "meta",
  };
}

export async function publishFacebookVideo(input: {
  videoUrl: string;
  caption: string;
  account: Account;
}): Promise<AdapterResult> {
  const pageId = asString(input.account.metadata.facebook_page_id) || asString(input.account.metadata.page_id);
  const pageToken = metaToken(input.account);
  if (!pageId) return fail("missing_facebook_page", "Facebook Page id is missing. Reconnect Meta and choose a Page.");
  const posted = await graphPost(`${pageId}/videos`, pageToken, {
    file_url: input.videoUrl,
    description: input.caption,
    published: "true",
  });
  const videoId = asString(posted.json.id);
  if (!posted.ok || !videoId) {
    const err = asString((posted.json.error as { message?: string } | undefined)?.message) || "facebook_video_failed";
    if (/permission|not been authorized|insufficient/i.test(err)) return waiting(`Facebook video: ${err}`);
    return fail("facebook_video_failed", err);
  }
  return {
    ok: true,
    remotePostId: videoId,
    remoteUrl: `https://www.facebook.com/${pageId}/videos/${videoId}`,
    provider: "meta",
  };
}

export async function publishFacebook(input: {
  videoUrl: string;
  caption: string;
  account: Account;
}): Promise<AdapterResult> {
  const pageId = asString(input.account.metadata.facebook_page_id) || asString(input.account.metadata.page_id);
  const pageToken = metaToken(input.account);
  if (!pageId) {
    return fail("missing_facebook_page", "Facebook Page id is missing. Reconnect Meta and choose a Page.");
  }
  const start = await graphPost(`${pageId}/video_reels`, pageToken, {
    upload_phase: "start",
  });
  const videoId = asString(start.json.video_id);
  const uploadUrl = asString(start.json.upload_url);
  if (!start.ok || !videoId || !uploadUrl) {
    const err = asString((start.json.error as { message?: string } | undefined)?.message) || JSON.stringify(start.json);
    if (/permission|not been authorized|insufficient/i.test(err)) {
      return waiting(`Facebook Reels: ${err}`);
    }
    return fail("facebook_start_failed", err);
  }

  const fileRes = await fetch(input.videoUrl);
  if (!fileRes.ok) return fail("media_fetch_failed", `Could not fetch Reel bytes (${fileRes.status}).`, false);
  const bytes = new Uint8Array(await fileRes.arrayBuffer());
  const upload = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `OAuth ${pageToken}`,
      offset: "0",
      file_size: String(bytes.byteLength),
      "Content-Type": "application/octet-stream",
    },
    body: bytes,
  });
  if (!upload.ok) {
    const text = await upload.text();
    return fail("facebook_upload_failed", text.slice(0, 500));
  }

  const finish = await graphPost(`${pageId}/video_reels`, pageToken, {
    upload_phase: "finish",
    video_id: videoId,
    video_state: "PUBLISHED",
    description: input.caption,
  });
  if (!finish.ok) {
    const err = asString((finish.json.error as { message?: string } | undefined)?.message) || JSON.stringify(finish.json);
    return fail("facebook_finish_failed", err);
  }
  const remoteId = asString(finish.json.post_id) || videoId;
  return {
    ok: true,
    remotePostId: remoteId,
    remoteUrl: `https://www.facebook.com/reel/${videoId}`,
    provider: "meta",
  };
}

export async function publishTikTok(input: {
  videoUrl: string;
  caption: string;
  account: Account;
}): Promise<AdapterResult> {
  const init = await fetch("https://open.tiktokapis.com/v2/post/publish/video/init/", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.account.accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({
      post_info: {
        title: input.caption.slice(0, 150),
        privacy_level: "PUBLIC_TO_EVERYONE",
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false,
      },
      source_info: {
        source: "PULL_FROM_URL",
        video_url: input.videoUrl,
      },
    }),
  });
  const json = (await init.json()) as {
    error?: { code?: string; message?: string };
    data?: { publish_id?: string };
  };
  const errCode = asString(json.error?.code);
  if (!init.ok || errCode && errCode !== "ok") {
    const message = asString(json.error?.message) || JSON.stringify(json);
    if (/scope_not_authorized|unaudited|not approved|forbidden/i.test(message + errCode)) {
      return waiting(`TikTok Content Posting API: ${message || errCode}`);
    }
    return fail("tiktok_init_failed", message || errCode);
  }
  const publishId = asString(json.data?.publish_id);
  if (!publishId) return fail("tiktok_init_failed", "TikTok did not return publish_id.");
  return {
    ok: true,
    remotePostId: publishId,
    remoteUrl: null,
    provider: "tiktok",
  };
}

function youtubePrivacy(value: unknown): "private" | "unlisted" | "public" {
  const raw = asString(value).toLowerCase();
  if (raw === "public" || raw === "unlisted" || raw === "private") return raw;
  return "private";
}

function youtubeTags(value: unknown, hashtags: string): string[] {
  const fromInput = Array.isArray(value)
    ? value.map((item) => asString(item)).filter(Boolean)
    : asString(value)
        .split(/[,#]+/)
        .map((item) => item.trim().replace(/^#+/, ""))
        .filter(Boolean);
  const fromHashtags = hashtags
    .split(/[\s,#]+/)
    .map((item) => item.trim().replace(/^#+/, ""))
    .filter(Boolean);
  return [...new Set([...fromInput, ...fromHashtags])].slice(0, 30);
}

export async function publishYouTube(input: {
  videoUrl: string;
  caption: string;
  title: string;
  account: Account;
  platform?: "youtube_shorts" | "youtube_video";
  tags?: string[] | string | null;
  categoryId?: string | null;
  privacyStatus?: string | null;
  madeForKids?: boolean | null;
  publishAt?: string | null;
  uploadSessionUri?: string | null;
  persistUploadSession?: (uploadUri: string) => Promise<void>;
}): Promise<AdapterResult> {
  const platform = input.platform === "youtube_video" ? "youtube_video" : "youtube_shorts";
  const fileRes = await fetch(input.videoUrl);
  if (!fileRes.ok) return fail("media_fetch_failed", `Could not fetch video bytes (${fileRes.status}).`, false);
  const bytes = new Uint8Array(await fileRes.arrayBuffer());
  const title = (input.title || input.caption || "TDG Video").slice(0, 100);
  const descriptionBase = input.caption || "";
  const description =
    platform === "youtube_shorts"
      ? `${descriptionBase}${descriptionBase.includes("#Shorts") ? "" : "\n\n#Shorts"}`.slice(0, 5000)
      : descriptionBase.slice(0, 5000);
  const privacyStatus = youtubePrivacy(input.privacyStatus);
  const madeForKids = input.madeForKids === true;
  const categoryId = asString(input.categoryId) || "24";
  const tags = youtubeTags(input.tags, "");
  const publishAt = asString(input.publishAt);
  // YouTube only accepts publishAt with private videos.
  const statusBody: Record<string, unknown> = {
    privacyStatus: publishAt && privacyStatus !== "private" ? "private" : privacyStatus,
    selfDeclaredMadeForKids: madeForKids,
  };
  if (publishAt) {
    statusBody.publishAt = publishAt;
    statusBody.privacyStatus = "private";
  }

  let uploadUri = asString(input.uploadSessionUri);
  if (!uploadUri) {
    const start = await fetch(
      "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${input.account.accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Type": "video/mp4",
          "X-Upload-Content-Length": String(bytes.byteLength),
        },
        body: JSON.stringify({
          snippet: {
            title,
            description,
            categoryId,
            tags,
          },
          status: statusBody,
        }),
      },
    );
    if (start.status === 401 || start.status === 403) {
      const text = await start.text();
      return fail(
        start.status === 401 ? "youtube_unauthorized" : "youtube_forbidden",
        `YouTube Data API upload: HTTP ${start.status} ${text.slice(0, 300)}`,
        start.status === 401,
      );
    }
    uploadUri = start.headers.get("location") || "";
    if (!start.ok || !uploadUri) {
      const text = await start.text();
      return fail("youtube_init_failed", text.slice(0, 500), true);
    }
    // Persist the resumable session before PUT so a crash cannot start a second init.
    if (input.persistUploadSession) {
      await input.persistUploadSession(uploadUri);
    }
  }

  const upload = await fetch(uploadUri, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${input.account.accessToken}`,
      "Content-Type": "video/mp4",
      "Content-Length": String(bytes.byteLength),
    },
    body: bytes,
  });
  const json = (await upload.json()) as {
    id?: string;
    status?: { uploadStatus?: string; privacyStatus?: string };
    error?: { message?: string };
  };
  const videoId = asString(json.id);
  if (!upload.ok || !videoId) {
    return fail(
      "youtube_upload_failed",
      asString(json.error?.message) || JSON.stringify(json),
      true,
      uploadUri,
    );
  }
  const remoteUrl =
    platform === "youtube_shorts"
      ? `https://www.youtube.com/shorts/${videoId}`
      : `https://www.youtube.com/watch?v=${videoId}`;
  return {
    ok: true,
    remotePostId: videoId,
    remoteUrl,
    provider: "youtube",
  };
}

export async function dispatchPublish(input: {
  platform:
    | "instagram_reels"
    | "instagram_photo"
    | "instagram_video"
    | "facebook_reels"
    | "facebook_photo"
    | "facebook_video"
    | "tiktok"
    | "youtube_shorts"
    | "youtube_video";
  videoUrl: string;
  caption: string;
  hashtags: string;
  title?: string | null;
  containerId?: string | null;
  account: Account;
  youtube?: {
    tags?: string[] | string | null;
    categoryId?: string | null;
    privacyStatus?: string | null;
    madeForKids?: boolean | null;
    publishAt?: string | null;
  } | null;
  persistYouTubeUploadSession?: (uploadUri: string) => Promise<void>;
}): Promise<AdapterResult> {
  const caption = [input.caption, input.hashtags].filter(Boolean).join("\n\n").trim();
  if (input.platform === "instagram_reels" || input.platform === "instagram_photo" || input.platform === "instagram_video") {
    const mediaKind = input.platform === "instagram_photo" ? "photo" : input.platform === "instagram_video" ? "video" : "reel";
    return publishInstagram({
      videoUrl: input.videoUrl,
      caption,
      account: input.account,
      mediaKind,
      containerId: input.containerId,
    });
  }
  if (input.platform === "facebook_photo") {
    return publishFacebookPhoto({ imageUrl: input.videoUrl, caption, account: input.account });
  }
  if (input.platform === "facebook_video") {
    return publishFacebookVideo({ videoUrl: input.videoUrl, caption, account: input.account });
  }
  if (input.platform === "facebook_reels") {
    return publishFacebook({ videoUrl: input.videoUrl, caption, account: input.account });
  }
  if (input.platform === "tiktok") {
    return publishTikTok({ videoUrl: input.videoUrl, caption, account: input.account });
  }
  return publishYouTube({
    videoUrl: input.videoUrl,
    caption,
    title: asString(input.title) || caption.slice(0, 80),
    account: input.account,
    platform: input.platform === "youtube_video" ? "youtube_video" : "youtube_shorts",
    tags: input.youtube?.tags ?? youtubeTags(null, input.hashtags),
    categoryId: input.youtube?.categoryId,
    privacyStatus: input.youtube?.privacyStatus,
    madeForKids: input.youtube?.madeForKids,
    publishAt: input.youtube?.publishAt,
    uploadSessionUri: input.containerId,
    persistUploadSession: input.persistYouTubeUploadSession,
  });
}
