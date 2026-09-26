import { createReadStream, existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import type { NodeApiRequest, NodeApiResponse } from "./_lib/nodeHandler";
import { requireClipFactoryAdmin } from "./_lib/clip-factory/admin";
import { resolveVpsAbsolutePath } from "./_lib/long-form-studio/storage";
import {
  enqueueFinishJob,
  listAllMusic,
  tickReelFinishWorker,
} from "./_lib/christmas-reel-pipeline/worker";
import { importCc0ChristmasTracks } from "./_lib/christmas-reel-pipeline/importCc0";

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

function asString(value: unknown): string {
  return String(value ?? "").trim();
}

export default async function handler(req: NodeApiRequest, res: NodeApiResponse) {
  const action = asString(req.query.action) || asString(parseBody(req).action) || "bootstrap";
  const cronSecret = asString(
    process.env.CHRISTMAS_REEL_CRON_SECRET ||
      process.env.PUBLISHER_CRON_SECRET ||
      process.env.CLIP_FACTORY_CRON_SECRET ||
      process.env.CRON_SECRET,
  );
  const providedCron = asString(
    req.headers["x-cron-secret"] || req.headers.authorization?.toString().replace(/^Bearer\s+/i, "") || req.query.secret,
  );

  if (action === "tick") {
    if (!cronSecret || providedCron !== cronSecret) return res.status(401).json({ error: "Unauthorized" });
    try {
      const result = await tickReelFinishWorker("christmas-reel-cron", 2);
      return res.status(200).json({ ok: true, ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return res.status(500).json({ error: "tick_failed", message: message.slice(0, 300) });
    }
  }

  if (action === "media") {
    const id = asString(req.query.id);
    if (!id) return res.status(400).json({ error: "missing_id" });
    try {
      const objectPath = `productions/reel-finish-${id}/master.mp4`;
      const abs = resolveVpsAbsolutePath(objectPath);
      if (!existsSync(abs)) return res.status(404).json({ error: "not_found" });
      const stat = statSync(abs);
      res.setHeader("Content-Type", "video/mp4");
      res.setHeader("Accept-Ranges", "bytes");
      res.setHeader("Cache-Control", "private, max-age=120");
      res.setHeader("Content-Length", String(stat.size));
      if (asString(req.query.download) === "1") {
        res.setHeader("Content-Disposition", `attachment; filename=\"reel-${id.slice(0, 8)}.mp4\"`);
      }
      createReadStream(abs).pipe(res);
      return;
    } catch {
      return res.status(404).json({ error: "not_found" });
    }
  }

  try {
    await requireClipFactoryAdmin(req.headers.authorization);
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const body = parseBody(req);

  if (action === "list_music") {
    const tracks = await listAllMusic();
    return res.status(200).json({ tracks });
  }

  if (action === "queue_finish") {
    const libraryAssetId = asString(body.library_asset_id || body.libraryAssetId);
    if (!libraryAssetId) return res.status(400).json({ error: "missing_library_asset_id" });
    const result = await enqueueFinishJob(libraryAssetId);
    return res.status(200).json(result);
  }

  if (action === "import_cc0") {
    const dryRun = body.dry_run === true || body.dryRun === true;
    const result = await importCc0ChristmasTracks({ dryRun });
    return res.status(200).json(result);
  }

  if (action === "tick_admin") {
    const result = await tickReelFinishWorker("admin", 2);
    return res.status(200).json({ ok: true, ...result });
  }

  return res.status(400).json({ error: "unknown_action" });
}
