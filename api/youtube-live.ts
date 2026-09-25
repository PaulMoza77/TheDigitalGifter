import type { NodeApiRequest, NodeApiResponse } from "./_lib/nodeHandler";
import { requireClipFactoryAdmin } from "./_lib/clip-factory/admin";
import { invokeYouTubeLiveEdge, resumableUploadLocalMp4 } from "./_lib/youtube-live/edge";
import { listLiveSessions } from "./_lib/youtube-live/sessions";
import {
  startYoutubeLive,
  stopYoutubeLive,
  tickYoutubeLive,
  youtubeLiveReadiness,
} from "./_lib/youtube-live/worker";
import { resolveLongFormLocalSource } from "./_lib/youtube-live/source";
import { hasIngestionLeak, publicLiveSession } from "../src/features/youtube-live/policy";
import { normalizePrivacyStatus } from "../src/features/social-publisher/youtube";

function asString(value: unknown): string {
  return String(value ?? "").trim();
}

function apiError(res: NodeApiResponse, status: number, error: string, message: string) {
  return res.status(status).json({ error, message });
}

function parseBody(req: NodeApiRequest): Record<string, unknown> {
  const raw = req.body;
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (typeof raw === "object") return raw as Record<string, unknown>;
  return {};
}

function safeJson(res: NodeApiResponse, status: number, payload: Record<string, unknown>) {
  if (hasIngestionLeak(payload)) {
    return apiError(res, 500, "secret_leak", "Refusing to return ingestion secrets.");
  }
  return res.status(status).json(payload);
}

export default async function handler(req: NodeApiRequest, res: NodeApiResponse) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "authorization, content-type");
    return res.status(200).send("ok");
  }

  const cronSecret = String(process.env.CLIP_FACTORY_CRON_SECRET || process.env.CRON_SECRET || "").trim();
  const provided = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (req.method === "POST" && asString((parseBody(req) as { action?: string }).action) === "tick") {
    if (!cronSecret || provided !== cronSecret) {
      try {
        await requireClipFactoryAdmin(req.headers.authorization);
      } catch {
        return apiError(res, 401, "auth", "Unauthorized");
      }
    }
    const result = await tickYoutubeLive();
    return safeJson(res, 200, { ok: true, ...result });
  }

  if (req.method !== "POST") return apiError(res, 405, "method", "Method not allowed");

  try {
    await requireClipFactoryAdmin(req.headers.authorization);
  } catch (error) {
    const status = (error as Error & { status?: number }).status || 401;
    return apiError(res, status, "auth", error instanceof Error ? error.message : "Unauthorized");
  }

  const body = parseBody(req);
  const action = asString(body.action);

  try {
    if (action === "list" || action === "sessions") {
      const sessions = await listLiveSessions();
      return safeJson(res, 200, { sessions });
    }

    if (action === "readiness") {
      const readiness = await youtubeLiveReadiness();
      return safeJson(res, 200, readiness);
    }

    if (action === "start") {
      const session = await startYoutubeLive({
        libraryAssetId: asString(body.library_asset_id),
        productionId: asString(body.production_id) || undefined,
        title: asString(body.title) || undefined,
        description: asString(body.description) || undefined,
        privacyStatus: normalizePrivacyStatus(body.privacy_status, "private"),
        madeForKids: body.made_for_kids === true,
        durationHours: body.duration_hours,
      });
      return safeJson(res, 200, { session });
    }

    if (action === "stop") {
      const session = await stopYoutubeLive(asString(body.session_id));
      return safeJson(res, 200, { session });
    }

    if (action === "publish_video") {
      const source = await resolveLongFormLocalSource({
        libraryAssetId: asString(body.library_asset_id),
        productionId: asString(body.production_id) || undefined,
      });
      const token = await invokeYouTubeLiveEdge<{ ok: boolean; accessToken?: string; error?: string }>(
        "youtube_internal_access_token",
      );
      if (!token.ok || !token.accessToken) {
        throw Object.assign(new Error(token.error || "YouTube is not connected."), { status: 409 });
      }
      const uploaded = await resumableUploadLocalMp4({
        accessToken: token.accessToken,
        filePath: source.path,
        title: asString(body.title) || source.title,
        description: asString(body.description),
        privacyStatus: normalizePrivacyStatus(body.privacy_status, "private"),
        madeForKids: body.made_for_kids === true,
      });
      return safeJson(res, 200, {
        ok: true,
        platform: "youtube_video",
        videoId: uploaded.videoId,
        url: uploaded.watchUrl,
      });
    }

    return apiError(res, 400, "unknown_action", "Unknown request.");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = (error as Error & { status?: number }).status || 500;
    const existing = (error as Error & { existing?: Record<string, unknown> }).existing;
    console.error(JSON.stringify({ source: "youtube-live", message: message.slice(0, 400) }));
    return safeJson(res, status, {
      error: "failed",
      message: message.slice(0, 400),
      session: existing ? publicLiveSession(existing) : undefined,
    });
  }
}
