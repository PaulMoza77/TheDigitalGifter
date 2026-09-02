#!/usr/bin/env node
/**
 * Live smoke against production pet-v2-preview after identity deploy.
 *
 * Usage:
 *   PET_PREVIEW_SMOKE=1 node scripts/pet-preview-live-smoke.mjs
 *
 * Requires public Supabase URL (default TDG) + anon key via:
 *   VITE_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY
 * Optional: PET_PREVIEW_SMOKE_OUT dir (default /opt/cursor/artifacts/pet-preview-qa)
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const enabled = String(process.env.PET_PREVIEW_SMOKE || "") === "1";
const outDir = resolve(
  process.env.PET_PREVIEW_SMOKE_OUT || "/opt/cursor/artifacts/pet-preview-qa",
);
const projectRef = process.env.SUPABASE_PROJECT_REF || "kjlsocejpmnzhhduyumy";
const edgeUrl =
  process.env.PET_PREVIEW_EDGE_URL ||
  `https://${projectRef}.supabase.co/functions/v1/pet-v2-preview`;

const EXPECTED_BUILD_PREFIX = "pet-preview-identity-";

function fail(msg) {
  console.error(`SMOKE_FAIL: ${msg}`);
  process.exit(2);
}

function loadAnon() {
  const fromEnv =
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.PET_PREVIEW_ANON_KEY ||
    "";
  if (fromEnv.trim()) return fromEnv.trim();
  if (existsSync("/tmp/anon.txt")) return readFileSync("/tmp/anon.txt", "utf8").trim();
  fail("Missing anon key (SUPABASE_ANON_KEY / /tmp/anon.txt)");
}

function findChow() {
  const candidates = [
    join(outDir, "chow-chow.jpg"),
    join(root, "output/pet-preview-qa/fixtures/chow-chow.jpg"),
    "/home/ubuntu/.cursor/projects/workspace/assets/a6360567-6055-4ced-85a6-b1e3f90651ae.jpg",
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  fail("Chow Chow fixture not found");
}

async function main() {
  if (!enabled) {
    console.log("Set PET_PREVIEW_SMOKE=1 to run live smoke.");
    process.exit(0);
  }

  mkdirSync(outDir, { recursive: true });
  const anon = loadAnon();

  const versionRes = await fetch(edgeUrl, { method: "GET" });
  const versionJson = await versionRes.json().catch(() => ({}));
  console.log("GET identityBuild:", versionJson.identityBuild || "(missing)");
  if (
    !versionJson.identityBuild ||
    !String(versionJson.identityBuild).startsWith(EXPECTED_BUILD_PREFIX)
  ) {
    fail(
      `Live edge is not on the identity build yet (got ${JSON.stringify(versionJson.identityBuild)}). Deploy pet-v2-preview first.`,
    );
  }

  const chowPath = findChow();
  const bytes = readFileSync(chowPath);
  const imageDataUrl = `data:image/jpeg;base64,${bytes.toString("base64")}`;
  const attempt = `smoke:chow:${createHash("sha256").update(bytes).digest("hex").slice(0, 12)}:${Date.now()}`;

  const res = await fetch(edgeUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${anon}`,
      apikey: anon,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      funnel_version: "v2",
      species: "dog",
      scene: "formula-racer",
      session_id: "00000000-0000-4000-8000-00000000sm01",
      imageDataUrl,
      idempotency_key: attempt,
      preview_attempt_id: attempt,
    }),
  });
  const json = await res.json();
  console.log("POST", res.status, {
    ok: json.ok,
    mode: json.mode,
    errorCode: json.errorCode,
    identityBuild: json.identityBuild,
  });

  if (!json.ok || !json.imageDataUrl) {
    fail(`Generation failed: ${json.errorCode || json.error || res.status}`);
  }
  if (!String(json.identityBuild || "").startsWith(EXPECTED_BUILD_PREFIX)) {
    fail("Generation succeeded but identityBuild missing — wrong/old edge revision");
  }

  const outFile = join(outDir, "prod-after-chow.jpg");
  writeFileSync(outFile, Buffer.from(String(json.imageDataUrl).split(",")[1], "base64"));
  writeFileSync(
    join(outDir, "smoke-after.json"),
    JSON.stringify(
      {
        identityBuild: json.identityBuild,
        mode: json.mode,
        outFile,
        attempt,
        visualGate: "manual_or_vision_review_required",
        note: "Human/agent must confirm Chow mane, no closed helmet, no logos, same pet.",
      },
      null,
      2,
    ),
  );
  console.log("SMOKE_OK wrote", outFile);
  console.log("VISUAL_GATE: confirm Chow identity before marking goal complete.");
}

main().catch((err) => {
  fail(err instanceof Error ? err.message : String(err));
});
