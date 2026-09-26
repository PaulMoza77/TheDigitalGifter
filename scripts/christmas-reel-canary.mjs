#!/usr/bin/env node
/**
 * Queue finish + worker tick for three Christmas canary assets, then run publisher/social crons.
 */
const ORIGIN = String(process.env.TDG_PUBLIC_ORIGIN || "https://www.thedigitalgifter.com").replace(/\/$/, "");
const CRON_SECRET = String(
  process.env.CHRISTMAS_REEL_CRON_SECRET ||
    process.env.PUBLISHER_CRON_SECRET ||
    process.env.CLIP_FACTORY_CRON_SECRET ||
    process.env.CRON_SECRET ||
    "",
).trim();
const SERVICE_KEY = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

const CANARY_CATALOG_IDS = [
  "reel-christmas-express",
  "reel-cozy-atmosphere-02",
  "reel-north-pole-santa",
];

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
  console.log(JSON.stringify({ step: "canary_start", origin: ORIGIN, assets: CANARY_CATALOG_IDS }));
  for (const id of CANARY_CATALOG_IDS) {
    const queue = await post("/api/christmas-reel-pipeline?action=queue_finish", { library_asset_id: id });
    console.log(JSON.stringify({ step: "queue_finish", id, ...queue }));
  }
  console.log(JSON.stringify({ step: "tick_reel_finish", ...(await post("/api/christmas-reel-pipeline?action=tick")) }));
  console.log(JSON.stringify({ step: "publisher_tick", ...(await post("/api/publisher-cron")) }));
  console.log(JSON.stringify({ step: "social_tick", ...(await post("/api/social-publisher-cron")) }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
