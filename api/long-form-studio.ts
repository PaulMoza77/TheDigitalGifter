import type { NodeApiRequest, NodeApiResponse } from "./_lib/nodeHandler";
import { createReadStream, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { requireClipFactoryAdmin } from "./_lib/clip-factory/admin";
import { createAndRenderProduction, listStudioBootstrap } from "./_lib/long-form-studio/worker";
import { loadLocalState, saveLocalState, newId } from "./_lib/long-form-studio/localState";
import { verifyLongFormSignature } from "./_lib/long-form-studio/mediaSign";
import { ORIGINAL_MUSIC_SEED } from "../src/features/long-form-studio/seedMusic";
import { isRightsComplete } from "../src/features/long-form-studio/musicRights";
import { youtubeAudioLibraryLicenseType } from "../src/features/long-form-studio/musicRights";
import { buildPlaylist } from "../src/features/long-form-studio/playlist";
import { animateStillToAmbience } from "./_lib/long-form-studio/animate";
import { LIBRARY_VIDEOS, isLibraryPhoto } from "../src/features/admin-library/catalog";
import { waitUntil } from "./_lib/nodeHandler";
import type { MusicTrack } from "../src/features/long-form-studio/types";

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

function productionsDir() {
  return join(process.cwd(), "output/long-form/productions");
}

export default async function handler(req: NodeApiRequest, res: NodeApiResponse) {
  const action = asString(req.query.action);

  if ((req.method === "GET" || req.method === "HEAD") && action === "file") {
    const name = asString(req.query.name).replace(/[^a-zA-Z0-9._-]/g, "");
    const path = join(productionsDir(), name);
    if (!name || !existsSync(path) || !path.startsWith(productionsDir())) {
      return apiError(res, 404, "not_found", "This video is not available.");
    }
    const stat = statSync(path);
    res.status(200);
    res.setHeader("Content-Type", name.endsWith(".jpg") ? "image/jpeg" : "video/mp4");
    res.setHeader("Content-Length", String(stat.size));
    res.setHeader("Cache-Control", "private, max-age=120");
    if (req.method === "HEAD") return res.end();
    createReadStream(path).pipe(res);
    return;
  }

  if ((req.method === "GET" || req.method === "HEAD") && action === "media") {
    const kind = asString(req.query.kind);
    const id = asString(req.query.id);
    const exp = asString(req.query.exp);
    const sig = asString(req.query.sig);
    if (!verifyLongFormSignature(`${kind}:${id}`, exp, sig)) {
      return apiError(res, 401, "unauthorized", "This media link has expired.");
    }
    const local = await loadLocalState();
    const production = local.productions.find((p) => p.id === id);
    const filename = kind === "thumb" ? `${id.slice(0, 8)}.jpg` : String(production?.storage_path || "").split("/").pop();
    const path = join(productionsDir(), filename || "");
    if (!existsSync(path)) return apiError(res, 404, "not_found", "Media is not available.");
    res.status(200);
    res.setHeader("Content-Type", kind === "thumb" ? "image/jpeg" : "video/mp4");
    if (req.method === "HEAD") return res.end();
    createReadStream(path).pipe(res);
    return;
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
      });
      return res.status(200).json(built);
    }

    if (postAction === "import_youtube_audio_library") {
      const attributionRequired = Boolean(body.attribution_required);
      const track: MusicTrack = {
        id: newId(),
        title: asString(body.title) || "Untitled",
        artistSource: asString(body.artist_source) || "YouTube Audio Library",
        durationSeconds: Number(body.duration_seconds || 0),
        genre: asString(body.genre),
        mood: asString(body.mood) || "cozy_instrumental",
        source: "youtube_audio_library",
        licenseType: youtubeAudioLibraryLicenseType(attributionRequired),
        commercialUseAllowed: body.commercial_use_allowed === true,
        youtubeMonetizationAllowed: body.youtube_monetization_allowed === "yes" || body.youtube_monetization_allowed === "no" ? body.youtube_monetization_allowed : "unknown",
        attributionRequired,
        attributionText: asString(body.attribution_text),
        licenseUrl: asString(body.license_url) || "https://www.youtube.com/audiolibrary",
        acquisitionDate: asString(body.acquisition_date) || new Date().toISOString().slice(0, 10),
        internalNotes: asString(body.internal_notes),
        filename: asString(body.filename) || null,
        publicSrc: asString(body.public_src) || null,
        compositionRights: "licensed",
        recordingRights: "licensed",
        rightsComplete: false,
      };
      track.rightsComplete = isRightsComplete(track);
      const local = await loadLocalState();
      local.music = [track, ...local.music.filter((t) => t.id !== track.id)];
      await saveLocalState(local);
      return res.status(200).json({ track });
    }

    if (postAction === "animate_scene") {
      const sceneId = asString(body.scene_id);
      const scene = LIBRARY_VIDEOS.find((item) => item.id === sceneId);
      if (!scene || !isLibraryPhoto(scene)) {
        return apiError(res, 400, "scene", "Choose a still image from the Library to animate.");
      }
      const dest = join(productionsDir(), `animated-${scene.id}.mp4`);
      const imagePath = join(process.cwd(), "public", scene.src.replace(/^\//, ""));
      await animateStillToAmbience({ imagePath, outputPath: dest, seconds: 16 });
      return res.status(200).json({
        src: `/api/long-form-studio?action=file&name=${encodeURIComponent(`animated-${scene.id}.mp4`)}`,
        note: "Subtle ambience motion from your still. Loop-friendly.",
      });
    }

    if (postAction === "create_video") {
      const sceneIds = Array.isArray(body.scene_ids) ? body.scene_ids.map((id) => String(id)) : [];
      if (!sceneIds.length) return apiError(res, 400, "scene", "Choose a scene first.");
      const duration = Number(body.duration_seconds || 3600);
      const payload = {
        sceneIds,
        mood: asString(body.mood) || "cozy_instrumental",
        style: (asString(body.style) || "cozy") as "cozy",
        durationSeconds: duration,
        shuffle: body.shuffle !== false,
        seed: Number(body.seed || Date.now() % 999983),
        createdBy: "admin",
      };
      const wait = body.wait === true || duration <= 30;
      if (wait) {
        const result = await createAndRenderProduction(payload);
        return res.status(200).json(result);
      }
      const queued = await createAndRenderProduction({ ...payload, durationSeconds: duration }, { skipRender: true });
      waitUntil(
        createAndRenderProduction(payload, { productionId: String(queued.production.id) }).catch((error) => {
          console.error(JSON.stringify({ source: "long-form-studio", event: "background_render_failed", message: String(error).slice(0, 300) }));
        }),
      );
      return res.status(200).json({ ...queued, queued: true });
    }

    if (postAction === "get_production") {
      const local = await loadLocalState();
      const production = local.productions.find((p) => p.id === asString(body.production_id));
      if (!production) return apiError(res, 404, "not_found", "Production not found.");
      return res.status(200).json({ production });
    }

    if (postAction === "list_productions") {
      const local = await loadLocalState();
      return res.status(200).json({ productions: local.productions });
    }

    if (postAction === "library_videos") {
      const local = await loadLocalState();
      const videos = local.productions
        .filter((p) => p.src)
        .map((p) => ({
          id: String(p.library_asset_id || p.id),
          title: String((p.title_suggestions as string[] | undefined)?.[0] || "Long-form"),
          description: String(p.description || ""),
          src: String(p.src),
          filename: `long-form-${String(p.id).slice(0, 8)}.mp4`,
          category: "long_form",
          kind: "long_form",
          durationSeconds: Number(p.duration_seconds || 0),
          poster: p.poster ? String(p.poster) : undefined,
          width: Number(p.width || 1920),
          height: Number(p.height || 1080),
        }));
      return res.status(200).json({ videos });
    }

    if (postAction === "seed_music") {
      const local = await loadLocalState();
      local.music = ORIGINAL_MUSIC_SEED;
      await saveLocalState(local);
      return res.status(200).json({ tracks: local.music });
    }

    return apiError(res, 400, "unknown_action", "Unknown request.");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({ source: "long-form-studio", message: message.slice(0, 400) }));
    return apiError(res, 500, "failed", message.slice(0, 400));
  }
}
