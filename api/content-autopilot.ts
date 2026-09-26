import type { NodeApiRequest, NodeApiResponse } from "./_lib/nodeHandler";
import { requireClipFactoryAdmin } from "./_lib/clip-factory/admin";
import {
  getDashboardSnapshot,
  retryConcept,
  streamConceptMedia,
  tickContentAutopilot,
} from "./_lib/content-autopilot/worker";
import { runDailyResearch } from "./_lib/content-autopilot/research";
import { updateSettings } from "./_lib/content-autopilot/settings";

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
  const action = asString(req.query.action) || asString(parseBody(req).action) || "dashboard";
  const cronSecret = asString(
    process.env.CONTENT_AUTOPILOT_CRON_SECRET ||
      process.env.CLIP_FACTORY_CRON_SECRET ||
      process.env.CRON_SECRET,
  );
  const providedCron = asString(
    req.headers["x-cron-secret"] || req.headers.authorization?.toString().replace(/^Bearer\s+/i, "") || req.query.secret,
  );

  if (action === "tick") {
    if (!cronSecret || providedCron !== cronSecret) return res.status(401).json({ error: "Unauthorized" });
    try {
      const result = await tickContentAutopilot("content-autopilot-cron");
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
      await streamConceptMedia(id, res);
      return;
    } catch (error) {
      const status = (error as { status?: number }).status || 404;
      return res.status(status).json({ error: "not_found" });
    }
  }

  try {
    await requireClipFactoryAdmin(req.headers.authorization);
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const body = parseBody(req);

  if (action === "dashboard") {
    const snapshot = await getDashboardSnapshot();
    return res.status(200).json(snapshot);
  }

  if (action === "update_settings") {
    const settings = await updateSettings({
      enabled: body.enabled === undefined ? undefined : Boolean(body.enabled),
      generationPaused: body.generation_paused === undefined ? undefined : Boolean(body.generation_paused),
      researchCandidatesPerDay:
        body.research_candidates_per_day === undefined ? undefined : Number(body.research_candidates_per_day),
      productionConceptsPerDay:
        body.production_concepts_per_day === undefined ? undefined : Number(body.production_concepts_per_day),
      clipsPerReel: body.clips_per_reel === undefined ? undefined : Number(body.clips_per_reel),
      maxDailySpendUsd: body.max_daily_spend_usd === undefined ? undefined : Number(body.max_daily_spend_usd),
    });
    return res.status(200).json({ settings });
  }

  if (action === "run_research") {
    const snapshot = await getDashboardSnapshot();
    const research = await runDailyResearch({
      candidateLimit: snapshot.settings.researchCandidatesPerDay,
      performanceHints: "",
    });
    return res.status(200).json({ research });
  }

  if (action === "tick_admin") {
    const result = await tickContentAutopilot("content-autopilot-admin");
    return res.status(200).json({ ok: true, ...result });
  }

  if (action === "retry") {
    const conceptId = asString(body.concept_id || body.conceptId);
    if (!conceptId) return res.status(400).json({ error: "missing_concept_id" });
    await retryConcept(conceptId);
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: "unknown_action" });
}
