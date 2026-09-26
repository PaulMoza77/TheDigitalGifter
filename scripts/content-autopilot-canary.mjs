#!/usr/bin/env node
/**
 * Content Autopilot canary: enable autopilot, run one worker tick chain, report pipeline state.
 * Full paid generation requires OPENAI_API_KEY + HF_CREDENTIALS on the origin.
 */
const ORIGIN = String(process.env.TDG_PUBLIC_ORIGIN || "https://www.thedigitalgifter.com").replace(/\/$/, "");
const CRON_SECRET = String(
  process.env.CONTENT_AUTOPILOT_CRON_SECRET ||
    process.env.CLIP_FACTORY_CRON_SECRET ||
    process.env.CRON_SECRET ||
    "",
).trim();
const SERVICE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

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
  console.log(JSON.stringify({ step: "canary_start", origin: ORIGIN }));
  console.log(JSON.stringify({ step: "enable", ...(await post("/api/content-autopilot?action=update_settings", { enabled: true })) }));
  console.log(JSON.stringify({ step: "research", ...(await post("/api/content-autopilot?action=run_research")) }));
  for (let i = 0; i < 3; i += 1) {
    console.log(JSON.stringify({ step: "tick", attempt: i + 1, ...(await post("/api/content-autopilot?action=tick")) }));
  }
  console.log(JSON.stringify({ step: "dashboard", ...(await post("/api/content-autopilot?action=dashboard")) }));
  console.log(JSON.stringify({ step: "reel_finish_tick", ...(await post("/api/christmas-reel-pipeline?action=tick")) }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
