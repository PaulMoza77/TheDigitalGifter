/** Pure YouTube Live Streaming API helpers. No tokens stored. */

export type YoutubeLivePrivacy = "private" | "unlisted" | "public";

export type YoutubeIngestion = {
  ingestionAddress: string;
  rtmpsIngestionAddress: string | null;
  streamName: string;
  ingestUrl: string;
};

export function preferRtmpsIngestUrl(ingestionAddress: string, streamName: string, rtmpsAddress?: string | null): string {
  const name = String(streamName || "").trim();
  const rtmps = String(rtmpsAddress || "").trim();
  const rtmp = String(ingestionAddress || "").trim().replace(/\/$/, "");
  const base = (rtmps || rtmp.replace("rtmp://a.rtmp.youtube.com", "rtmps://a.rtmps.youtube.com").replace(/^rtmp:\/\//i, "rtmps://"))
    .replace(/\/$/, "");
  if (!base || !name) throw new Error("YouTube did not return RTMP ingestion details.");
  return `${base}/${name}`;
}

export function buildLiveBroadcastInsertBody(input: {
  title: string;
  description: string;
  privacyStatus: YoutubeLivePrivacy;
  madeForKids?: boolean;
  scheduledStartTime: string;
}) {
  return {
    snippet: {
      title: String(input.title || "TDG Live").slice(0, 100),
      description: String(input.description || "").slice(0, 5000),
      scheduledStartTime: input.scheduledStartTime,
    },
    status: {
      privacyStatus: input.privacyStatus,
      selfDeclaredMadeForKids: input.madeForKids === true,
    },
    contentDetails: {
      enableAutoStart: false,
      enableAutoStop: true,
      enableDvr: true,
      recordFromStart: true,
      latencyPreference: "normal",
    },
  };
}

export function buildLiveStreamInsertBody(title: string) {
  return {
    snippet: { title: String(title || "TDG ingest").slice(0, 100) },
    cdn: {
      frameRate: "variable",
      ingestionType: "rtmp",
      resolution: "variable",
    },
  };
}

export function parseYouTubeLiveError(payload: unknown, status: number): string {
  const json = payload as {
    error?: { message?: string; errors?: Array<{ reason?: string; message?: string }> };
  };
  const reason = String(json?.error?.errors?.[0]?.reason || "").trim();
  const message = String(json?.error?.message || json?.error?.errors?.[0]?.message || "").trim();
  if (reason === "liveStreamingNotEnabled" || /live streaming/i.test(message)) {
    return message || "YouTube live streaming is not enabled on this channel yet.";
  }
  if (reason === "insufficientPermissions" || status === 403) {
    return message || "YouTube Live API permission was denied. Reconnect YouTube with Live scope.";
  }
  return message || `YouTube Live API HTTP ${status}`;
}

export function parseIngestion(stream: Record<string, unknown> | null | undefined): YoutubeIngestion {
  const cdn = (stream?.cdn || {}) as Record<string, unknown>;
  const info = (cdn.ingestionInfo || {}) as Record<string, unknown>;
  const ingestionAddress = String(info.ingestionAddress || "");
  const rtmpsIngestionAddress = String(info.rtmpsIngestionAddress || "") || null;
  const streamName = String(info.streamName || "");
  return {
    ingestionAddress,
    rtmpsIngestionAddress,
    streamName,
    ingestUrl: preferRtmpsIngestUrl(ingestionAddress, streamName, rtmpsIngestionAddress),
  };
}

export function parseStreamStatus(stream: Record<string, unknown> | null | undefined): string {
  const status = (stream?.status || {}) as Record<string, unknown>;
  return String(status.streamStatus || "").toLowerCase();
}

async function youtubeJson(
  accessToken: string,
  url: string,
  init: RequestInit = {},
): Promise<{ ok: boolean; status: number; json: Record<string, unknown> }> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, json };
}

export async function youtubeLiveBroadcastsInsert(
  accessToken: string,
  body: ReturnType<typeof buildLiveBroadcastInsertBody>,
) {
  return youtubeJson(
    accessToken,
    "https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet,status,contentDetails",
    { method: "POST", body: JSON.stringify(body) },
  );
}

export async function youtubeLiveStreamsInsert(
  accessToken: string,
  body: ReturnType<typeof buildLiveStreamInsertBody>,
) {
  return youtubeJson(
    accessToken,
    "https://www.googleapis.com/youtube/v3/liveStreams?part=snippet,cdn,status,contentDetails",
    { method: "POST", body: JSON.stringify(body) },
  );
}

export async function youtubeLiveBroadcastsBind(accessToken: string, broadcastId: string, streamId: string) {
  const url = new URL("https://www.googleapis.com/youtube/v3/liveBroadcasts/bind");
  url.searchParams.set("id", broadcastId);
  url.searchParams.set("streamId", streamId);
  url.searchParams.set("part", "id,contentDetails,status");
  return youtubeJson(accessToken, url.toString(), { method: "POST" });
}

export async function youtubeLiveBroadcastsTransition(
  accessToken: string,
  broadcastId: string,
  broadcastStatus: "testing" | "live" | "complete",
) {
  const url = new URL("https://www.googleapis.com/youtube/v3/liveBroadcasts/transition");
  url.searchParams.set("id", broadcastId);
  url.searchParams.set("broadcastStatus", broadcastStatus);
  url.searchParams.set("part", "id,status,snippet");
  return youtubeJson(accessToken, url.toString(), { method: "POST" });
}

export async function youtubeLiveStreamsList(accessToken: string, streamId: string) {
  const url = new URL("https://www.googleapis.com/youtube/v3/liveStreams");
  url.searchParams.set("part", "id,status,cdn");
  url.searchParams.set("id", streamId);
  return youtubeJson(accessToken, url.toString());
}

export async function youtubeLiveBroadcastsListMine(accessToken: string) {
  const url = new URL("https://www.googleapis.com/youtube/v3/liveBroadcasts");
  url.searchParams.set("part", "id,status");
  url.searchParams.set("mine", "true");
  url.searchParams.set("maxResults", "1");
  return youtubeJson(accessToken, url.toString());
}

export async function prepareYouTubeLive(accessToken: string, input: {
  title: string;
  description: string;
  privacyStatus: YoutubeLivePrivacy;
  madeForKids?: boolean;
}): Promise<
  | { ok: true; broadcastId: string; streamId: string; videoId: string; ingestion: YoutubeIngestion }
  | { ok: false; error: string; status: number }
> {
  const start = new Date(Date.now() + 15_000).toISOString();
  const broadcast = await youtubeLiveBroadcastsInsert(
    accessToken,
    buildLiveBroadcastInsertBody({ ...input, scheduledStartTime: start }),
  );
  if (!broadcast.ok) {
    return { ok: false, error: parseYouTubeLiveError(broadcast.json, broadcast.status), status: broadcast.status };
  }
  const broadcastId = String(broadcast.json.id || "");
  const videoId = broadcastId;
  const stream = await youtubeLiveStreamsInsert(accessToken, buildLiveStreamInsertBody(input.title));
  if (!stream.ok) {
    return { ok: false, error: parseYouTubeLiveError(stream.json, stream.status), status: stream.status };
  }
  const streamId = String(stream.json.id || "");
  const bind = await youtubeLiveBroadcastsBind(accessToken, broadcastId, streamId);
  if (!bind.ok) {
    return { ok: false, error: parseYouTubeLiveError(bind.json, bind.status), status: bind.status };
  }
  try {
    const ingestion = parseIngestion(stream.json);
    return { ok: true, broadcastId, streamId, videoId, ingestion };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "YouTube did not return ingestion details.",
      status: 502,
    };
  }
}
