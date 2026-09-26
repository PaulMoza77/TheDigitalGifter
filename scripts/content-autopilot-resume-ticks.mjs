#!/usr/bin/env node
/**
 * Run content-autopilot + reel-finish ticks until a concept reaches ready or max attempts.
 * Intended for Mozas: docker exec with CLIP_FACTORY_CRON_SECRET in env.
 */
const ORIGIN = String(process.env.TDG_INTERNAL_ORIGIN || "http://127.0.0.1:8080").replace(/\/$/, "");
const CRON_SECRET = String(
  process.env.CONTENT_AUTOPILOT_CRON_SECRET ||
    process.env.CLIP_FACTORY_CRON_SECRET ||
    process.env.CRON_SECRET ||
    "",
).trim();
const CONCEPT_ID = String(process.env.CONTENT_AUTOPILOT_CONCEPT_ID || "").trim();
const MAX = Number(process.env.CONTENT_AUTOPILOT_RESUME_TICKS || 180);
const PAUSE_MS = Number(process.env.CONTENT_AUTOPILOT_TICK_PAUSE_MS || 15000);

async function post(path) {
  const response = await fetch(`${ORIGIN}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(CRON_SECRET ? { "x-cron-secret": CRON_SECRET } : {}),
    },
  });
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 300) };
  }
  return { status: response.status, json };
}

async function conceptRow() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !CONCEPT_ID) return null;
  const r = await fetch(
    `${url}/rest/v1/content_concepts?id=eq.${CONCEPT_ID}&select=id,pipeline_status,failure_reason,library_asset_id,clips`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  );
  const rows = await r.json();
  return rows[0] || null;
}

function clipSummary(clips) {
  return (clips || []).map((c) => ({
    i: c.index,
    qc: c.imageQc,
    vid: Boolean(c.videoStoragePath),
    vreq: Boolean(c.higgsfieldVideoRequestId),
  }));
}

async function main() {
  console.log(JSON.stringify({ step: "resume_start", conceptId: CONCEPT_ID, max: MAX }));
  for (let attempt = 1; attempt <= MAX; attempt += 1) {
    const rowBefore = await conceptRow();
    if (rowBefore?.pipeline_status === "ready") {
      console.log(JSON.stringify({ step: "done", attempt, concept: rowBefore }));
      return;
    }
    const ca = await post("/api/content-autopilot?action=tick");
    const finish = await post("/api/christmas-reel-pipeline?action=tick");
    const row = await conceptRow();
    console.log(
      JSON.stringify({
        step: "tick",
        attempt,
        caStatus: ca.status,
        processedConceptId: ca.json?.processedConceptId,
        processError: ca.json?.processError,
        finishStatus: finish.status,
        pipeline: row?.pipeline_status,
        failure: row?.failure_reason,
        library: row?.library_asset_id,
        clips: clipSummary(row?.clips),
      }),
    );
    if (row?.pipeline_status === "ready") {
      console.log(JSON.stringify({ step: "done", attempt, concept: row }));
      return;
    }
    if (row?.pipeline_status === "failed") {
      console.log(JSON.stringify({ step: "failed", attempt, concept: row }));
      process.exit(2);
    }
    await new Promise((r) => setTimeout(r, PAUSE_MS));
  }
  console.log(JSON.stringify({ step: "timeout", max: MAX }));
  process.exit(3);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
