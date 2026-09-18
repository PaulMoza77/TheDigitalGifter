export type AdapterResult =
  | { ok: true; remotePostId: string; remoteUrl?: string | null; provider: "meta" | "tiktok" | "youtube" }
  | { ok: false; code: string; message: string; retryable: boolean; waitingForApproval?: boolean };

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
  return {
    ok: false,
    code: "waiting_for_provider_approval",
    message: `IMPLEMENTED — WAITING FOR PROVIDER APPROVAL. ${message}`,
    retryable: true,
    waitingForApproval: true,
  };
}

function fail(code: string, message: string, retryable = true): AdapterResult {
  return { ok: false, code, message, retryable };
}

async function graphGet(path: string, token: string, params: Record<string, string> = {}) {
  const url = new URL(`https://graph.facebook.com/v21.0/${path.replace(/^\//, "")}`);
  url.searchParams.set("access_token", token);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url);
  const json = (await res.json()) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, json };
}

async function graphPost(path: string, token: string, body: Record<string, string>) {
  const url = new URL(`https://graph.facebook.com/v21.0/${path.replace(/^\//, "")}`);
  const params = new URLSearchParams({ access_token: token, ...body });
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  const json = (await res.json()) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, json };
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

export async function publishInstagram(input: {
  videoUrl: string;
  caption: string;
  account: Account;
}): Promise<AdapterResult> {
  const igUserId = asString(input.account.metadata.instagram_user_id) || asString(input.account.metadata.ig_user_id);
  if (!igUserId) {
    return fail(
      "missing_instagram_user",
      "Instagram professional account id is missing. Reconnect Meta and select a Page with an Instagram account.",
    );
  }
  const create = await graphPost(`${igUserId}/media`, input.account.accessToken, {
    media_type: "REELS",
    video_url: input.videoUrl,
    caption: input.caption,
    share_to_feed: "true",
  });
  const creationId = asString(create.json.id);
  if (!create.ok || !creationId) {
    const err = asString((create.json.error as { message?: string } | undefined)?.message) || JSON.stringify(create.json);
    if (/permission|not been authorized|insufficient/i.test(err)) {
      return waiting(`Instagram Graph publish: ${err}`);
    }
    return fail("instagram_create_failed", err);
  }

  for (let i = 0; i < 12; i++) {
    const status = await graphGet(creationId, input.account.accessToken, { fields: "status_code" });
    const code = asString(status.json.status_code);
    if (code === "FINISHED") break;
    if (code === "ERROR") return fail("instagram_processing_failed", JSON.stringify(status.json), false);
    await sleep(5000);
  }

  const publish = await graphPost(`${igUserId}/media_publish`, input.account.accessToken, {
    creation_id: creationId,
  });
  const postId = asString(publish.json.id);
  if (!publish.ok || !postId) {
    const err = asString((publish.json.error as { message?: string } | undefined)?.message) || JSON.stringify(publish.json);
    return fail("instagram_publish_failed", err);
  }
  return {
    ok: true,
    remotePostId: postId,
    remoteUrl: `https://www.instagram.com/reel/${postId}/`,
    provider: "meta",
  };
}

export async function publishFacebook(input: {
  videoUrl: string;
  caption: string;
  account: Account;
}): Promise<AdapterResult> {
  const pageId = asString(input.account.metadata.facebook_page_id) || asString(input.account.metadata.page_id);
  const pageToken = asString(input.account.metadata.page_access_token) || input.account.accessToken;
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

export async function publishYouTube(input: {
  videoUrl: string;
  caption: string;
  title: string;
  account: Account;
}): Promise<AdapterResult> {
  const fileRes = await fetch(input.videoUrl);
  if (!fileRes.ok) return fail("media_fetch_failed", `Could not fetch Reel bytes (${fileRes.status}).`, false);
  const bytes = new Uint8Array(await fileRes.arrayBuffer());
  const title = (input.title || input.caption || "TDG Short").slice(0, 100);
  const description = `${input.caption}\n\n#Shorts`.slice(0, 5000);

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
          categoryId: "24",
        },
        status: {
          privacyStatus: "public",
          selfDeclaredMadeForKids: false,
        },
      }),
    },
  );
  if (start.status === 401 || start.status === 403) {
    const text = await start.text();
    return waiting(`YouTube Data API upload: HTTP ${start.status} ${text.slice(0, 300)}`);
  }
  const uploadUri = start.headers.get("location");
  if (!start.ok || !uploadUri) {
    const text = await start.text();
    return fail("youtube_init_failed", text.slice(0, 500));
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
  const json = (await upload.json()) as { id?: string; error?: { message?: string } };
  const videoId = asString(json.id);
  if (!upload.ok || !videoId) {
    return fail("youtube_upload_failed", asString(json.error?.message) || JSON.stringify(json));
  }
  return {
    ok: true,
    remotePostId: videoId,
    remoteUrl: `https://www.youtube.com/shorts/${videoId}`,
    provider: "youtube",
  };
}

export async function dispatchPublish(input: {
  platform: "instagram_reels" | "facebook_reels" | "tiktok" | "youtube_shorts";
  videoUrl: string;
  caption: string;
  hashtags: string;
  title?: string | null;
  account: Account;
}): Promise<AdapterResult> {
  const caption = [input.caption, input.hashtags].filter(Boolean).join("\n\n").trim();
  if (input.platform === "instagram_reels") {
    return publishInstagram({ videoUrl: input.videoUrl, caption, account: input.account });
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
  });
}
