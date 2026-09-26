#!/usr/bin/env node
/**
 * Production canary: enable autopilot with 1 production concept, run ticks until ready or timeout.
 * Does NOT enable full 5/day until CONTENT_AUTOPILOT_ENABLE_AFTER=1 env is set at end.
 */
const ORIGIN = String(process.env.TDG_PUBLIC_ORIGIN || "https://www.thedigitalgifter.com").replace(/\/$/, "");
const CRON_SECRET = String(
  process.env.CONTENT_AUTOPILOT_CRON_SECRET ||
    process.env.CLIP_FACTORY_CRON_SECRET ||
    process.env.CRON_SECRET ||
    "",
).trim();
const SERVICE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const MAX_TICKS = Number(process.env.CONTENT_AUTOPILOT_CANARY_TICKS || 120);

async function post(path, body) {
  const response = await fetch(`${ORIGIN}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(CRON_SECRET ? { "x-cron-secret": CRON_SECRET } : {}),
      ...(SERVICE_KEY ? { Authorization: `Bearer ${SERVICE_KEY}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 400) };
  }
  return { status: response.status, json };
}

async function main() {
  console.log(JSON.stringify({ step: "canary_start", origin: ORIGIN, maxTicks: MAX_TICKS }));
  console.log(
    JSON.stringify({
      step: "configure_canary_limits",
      ...(await post("/api/content-autopilot?action=update_settings", {
        enabled: true,
        generation_paused: false,
        production_concepts_per_day: 1,
        research_candidates_per_day: 10,
      })),
    }),
  );
  console.log(JSON.stringify({ step: "research", ...(await post("/api/content-autopilot?action=run_research")) }));
  for (let i = 0; i < MAX_TICKS; i += 1) {
    const tick = await post("/api/content-autopilot?action=tick");
    console.log(JSON.stringify({ step: "content_autopilot_tick", attempt: i + 1, ...tick }));
    const dashboard = await post("/api/content-autopilot?action=dashboard");
    const concepts = dashboard.json?.concepts || [];
    const ready = concepts.find((row) => row.pipeline_status === "ready");
    const failed = concepts.find((row) => row.pipeline_status === "failed");
    if (ready) {
      console.log(JSON.stringify({ step: "canary_ready", concept: ready }));
      break;
    }
    if (failed && !concepts.some((row) => ["selected", "generating_assets", "qc_review", "assembling_reel", "library_pending_finish"].includes(row.pipeline_status))) {
      console.log(JSON.stringify({ step: "canary_failed", concept: failed }));
      process.exit(2);
    }
    const finish = await post("/api/christmas-reel-pipeline?action=tick");
    console.log(JSON.stringify({ step: "reel_finish_tick", attempt: i + 1, ...finish }));
    const dash2 = await post("/api/content-autopilot?action=dashboard");
    const readyAfterFinish = (dash2.json?.concepts || []).find((row) => row.pipeline_status === "ready");
    if (readyAfterFinish) {
      console.log(JSON.stringify({ step: "canary_ready_after_finish", concept: readyAfterFinish }));
      break;
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  console.log(JSON.stringify({ step: "final_dashboard", ...(await post("/api/content-autopilot?action=dashboard")) }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
