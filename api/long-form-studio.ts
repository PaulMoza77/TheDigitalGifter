import type { NodeApiRequest, NodeApiResponse } from "./_lib/nodeHandler";
import { createReadStream, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { requireClipFactoryAdmin } from "./_lib/clip-factory/admin";
import {
  createAndRenderProduction,
  getProduction,
  kickLongFormWorker,
  listLibraryVideos,
  listStudioBootstrap,
  resolveMediaRedirect,
  retryProduction,
  seedDemoMusicIfMissing,
  tickLongForm,
} from "./_lib/long-form-studio/worker";
import { verifyLongFormSignature } from "./_lib/long-form-studio/mediaSign";
import { buildPlaylist } from "../src/features/long-form-studio/playlist";
import { animateStillToAmbience } from "./_lib/long-form-studio/animate";
import { LIBRARY_VIDEOS, isLibraryPhoto } from "../src/features/admin-library/catalog";
import { beginYalUpload, completeYalImport } from "./_lib/long-form-studio/musicImport";
import { assertCreatePayload } from "./_lib/long-form-studio/validateInput";
import { longFormLocalAllowed } from "./_lib/long-form-studio/storage";

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

async function adminOrSigned(req: NodeApiRequest, kind: string, id: string): Promise<boolean> {
  const exp = asString(req.query.exp);
  const sig = asString(req.query.sig);
  if (exp && sig && verifyLongFormSignature(`${kind}:${id}`, exp, sig)) return true;
  try {
    await requireClipFactoryAdmin(req.headers.authorization);
    return true;
  } catch {
    return false;
  }
}

function sendLocalFile(req: NodeApiRequest, res: NodeApiResponse, path: string, contentType: string) {
  if (!existsSync(path)) {
    apiError(res, 404, "not_found", "This media is not available.");
    return;
  }
  const stat = statSync(path);
  const range = String(req.headers.range || "");
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", "private, max-age=60");
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (match) {
    const start = match[1] ? Number(match[1]) : 0;
    const end = match[2] ? Number(match[2]) : stat.size - 1;
    if (start >= stat.size || end >= stat.size || start > end) {
      res.status(416);
      res.setHeader("Content-Range", `bytes */${stat.size}`);
      res.end();
      return;
    }
    res.status(206);
    res.setHeader("Content-Range", `bytes ${start}-${end}/${stat.size}`);
    res.setHeader("Content-Length", String(end - start + 1));
    if (req.method === "HEAD") return res.end();
    createReadStream(path, { start, end }).pipe(res);
    return;
  }
  res.status(200);
  res.setHeader("Content-Length", String(stat.size));
  if (req.method === "HEAD") return res.end();
  createReadStream(path).pipe(res);
}

export default async function handler(req: NodeApiRequest, res: NodeApiResponse) {
  const action = asString(req.query.action);

  if ((req.method === "GET" || req.method === "HEAD") && action === "media") {
    const kind = asString(req.query.kind);
    const id = asString(req.query.id);
    if (!(await adminOrSigned(req, kind, id))) {
      return apiError(res, 401, "unauthorized", "This media link is not valid.");
    }
    try {
      const resolved = await resolveMediaRedirect(kind, id);
      if ("url" in resolved) {
        res.status(302);
        res.setHeader("Location", resolved.url);
        res.setHeader("Cache-Control", "private, no-store");
        return res.end();
      }
      return sendLocalFile(req, res, resolved.localPath, resolved.contentType);
    } catch (error) {
      const status = (error as Error & { status?: number }).status || 404;
      return apiError(res, status, "not_found", error instanceof Error ? error.message : "Media is not available.");
    }
  }

  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "authorization, content-type");
    return res.status(200).send("ok");
  }

  if (req.method !== "POST") return apiError(res, 405, "method", "Method not allowed");

  try {
    await requireClipFactoryAdmin(req.headers.authorization);
  } catch (error) {
    const status = (error as Error & { status?: number }).status || 401;
    return apiError(res, status, "auth", error instanceof Error ? error.message : "Unauthorized");
  }

  const body = parseBody(req);
  const postAction = asString(body.action);

  try {
    if (postAction === "bootstrap") {
      await seedDemoMusicIfMissing();
      const data = await listStudioBootstrap();
      return res.status(200).json(data);
    }

    if (postAction === "list_music") {
      const data = await listStudioBootstrap();
      return res.status(200).json({ tracks: data.music });
    }

    if (postAction === "preview_playlist") {
      const data = await listStudioBootstrap();
      const built = buildPlaylist({
        tracks: data.music,
        mood: asString(body.mood) || "cozy_instrumental",
        targetSeconds: Number(body.duration_seconds || 3600),
        shuffle: body.shuffle !== false,
        seed: Number(body.seed || 1),
        includeDemo: true,
      });
      return res.status(200).json(built);
    }

    if (postAction === "begin_yal_upload") {
      const purpose = asString(body.purpose) === "proof" ? "proof" : "audio";
      const started = await beginYalUpload({ filename: asString(body.filename), purpose });
      return res.status(200).json(started);
    }

    if (postAction === "import_youtube_audio_library") {
      const imported = await completeYalImport(body);
      return res.status(200).json(imported);
    }

    if (postAction === "animate_scene") {
      const sceneId = asString(body.scene_id);
      const scene = LIBRARY_VIDEOS.find((item) => item.id === sceneId);
      if (!scene || !isLibraryPhoto(scene)) {
        return apiError(res, 400, "scene", "Choose a still image from the Library to animate.");
      }
      const destDir = join(process.cwd(), "output/long-form/productions");
      const dest = join(destDir, `animated-${scene.id}.mp4`);
      const imagePath = join(process.cwd(), "public", scene.src.replace(/^\//, ""));
      await animateStillToAmbience({ imagePath, outputPath: dest, seconds: 16 });
      return res.status(200).json({
        note: "Subtle ambience motion from your still. Loop-friendly.",
      });
    }

    if (postAction === "create_video") {
      const parsed = assertCreatePayload({
        sceneIds: Array.isArray(body.scene_ids) ? body.scene_ids.map((id) => String(id)) : [],
        mood: asString(body.mood) || "cozy_instrumental",
        style: asString(body.style) || "cozy",
        durationSeconds: Number(body.duration_seconds || 3600),
      });
      const payload = {
        sceneIds: parsed.sceneIds,
        mood: parsed.mood,
        style: parsed.style,
        durationSeconds: parsed.durationSeconds,
        shuffle: body.shuffle !== false,
        seed: Number(body.seed || Date.now() % 999983),
        createdBy: "admin",
      };
      const wait = body.wait === true && longFormLocalAllowed();
      if (wait) {
        const result = await createAndRenderProduction(payload);
        return res.status(200).json(result);
      }
      const queued = await createAndRenderProduction(payload, { skipRender: true });
      kickLongFormWorker();
      return res.status(200).json({ ...queued, queued: true });
    }

    if (postAction === "retry_production") {
      const result = await retryProduction(asString(body.production_id));
      return res.status(200).json(result);
    }

    if (postAction === "get_production") {
      const production = await getProduction(asString(body.production_id));
      if (!production) return apiError(res, 404, "not_found", "Production not found.");
      return res.status(200).json({ production });
    }

    if (postAction === "list_productions") {
      const data = await listStudioBootstrap();
      return res.status(200).json({ productions: data.productions });
    }

    if (postAction === "library_videos") {
      const videos = await listLibraryVideos();
      return res.status(200).json({ videos });
    }

    if (postAction === "seed_music") {
      const tracks = await seedDemoMusicIfMissing();
      return res.status(200).json({ tracks });
    }

    if (postAction === "tick") {
      const result = await tickLongForm("api");
      return res.status(200).json(result);
    }

    return apiError(res, 400, "unknown_action", "Unknown request.");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = (error as Error & { status?: number }).status || 500;
    console.error(JSON.stringify({ source: "long-form-studio", message: message.slice(0, 400) }));
    return apiError(res, status, "failed", message.slice(0, 400));
  }
}
