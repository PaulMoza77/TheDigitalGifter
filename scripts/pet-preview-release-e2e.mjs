#!/usr/bin/env node
/**
 * Release E2E against production pet-v2-preview (Replicate-only).
 * Records latency, identityBuild, provider, and session binding.
 *
 * Usage:
 *   SUPABASE_ANON_KEY=... node scripts/pet-preview-release-e2e.mjs
 */
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(
  process.env.PET_PREVIEW_SMOKE_OUT || "/opt/cursor/artifacts/pet-preview-qa",
);
const projectRef = process.env.SUPABASE_PROJECT_REF || "kjlsocejpmnzhhduyumy";
const edgeUrl =
  process.env.PET_PREVIEW_EDGE_URL ||
  `https://${projectRef}.supabase.co/functions/v1/pet-v2-preview`;
const EXPECTED = "pet-preview-identity-2026-08-28h";

function anon() {
  const v =
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    (existsSync("/tmp/anon.txt") ? readFileSync("/tmp/anon.txt", "utf8") : "");
  if (!v.trim()) throw new Error("Missing anon key");
  return v.trim();
}

function load(path) {
  if (!existsSync(path)) throw new Error(`Missing fixture ${path}`);
  return readFileSync(path);
}

async function post(body) {
  const key = anon();
  const t0 = Date.now();
  const res = await fetch(edgeUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  return { res, json, wallMs: Date.now() - t0 };
}

function sessionId() {
  const n = String(Date.now()).slice(-12).padStart(12, "0");
  return `00000000-0000-4000-8000-${n}`;
}

async function genCase(name, { file, funnel, species, scene, expectOk, expectError }) {
  const bytes = load(file);
  // Unique encode via trailing comment in data URL hash by mutating last byte slightly
  const unique = Buffer.from(bytes);
  unique[unique.length - 1] = (unique[unique.length - 1] + 1) % 256;
  const imageDataUrl = `data:image/jpeg;base64,${unique.toString("base64")}`;
  const hash12 = createHash("sha256").update(unique).digest("hex").slice(0, 12);
  const sid = sessionId();
  const attempt = `e2e:${name}:${hash12}:${Date.now()}`;
  const { res, json, wallMs } = await post({
    funnel_version: funnel,
    species,
    scene,
    session_id: sid,
    imageDataUrl,
    idempotency_key: attempt,
    preview_attempt_id: attempt,
  });
  const { imageDataUrl: img, ...meta } = json;
  const row = {
    name,
    http: res.status,
    wallMs,
    latencyMs: meta.latencyMs ?? null,
    ok: Boolean(meta.ok),
    identityBuild: meta.identityBuild || null,
    provider: meta.provider || null,
    providerStatus: meta.providerStatus || null,
    errorCode: meta.errorCode || null,
    reused: Boolean(meta.reused),
    preview_attempt_id: meta.preview_attempt_id || attempt,
    session_id: sid,
  };
  if (expectOk) {
    if (!json.ok || !img) throw new Error(`${name} expected ok: ${JSON.stringify(meta)}`);
    if (meta.identityBuild !== EXPECTED) {
      throw new Error(`${name} wrong identityBuild ${meta.identityBuild}`);
    }
    if (meta.provider && meta.provider !== "replicate") {
      throw new Error(`${name} expected replicate provider, got ${meta.provider}`);
    }
    if (meta.reused) throw new Error(`${name} unexpectedly reused cached prediction`);
    const out = join(outDir, `e2e-${name}.jpg`);
    writeFileSync(out, Buffer.from(String(img).split(",")[1], "base64"));
    row.saved = out;
  } else if (expectError) {
    if (json.ok) throw new Error(`${name} expected failure ${expectError}`);
    if (meta.errorCode !== expectError) {
      throw new Error(`${name} expected ${expectError} got ${meta.errorCode}`);
    }
  }
  console.log(JSON.stringify(row));
  return row;
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  const ver = await (await fetch(edgeUrl)).json();
  if (ver.identityBuild !== EXPECTED) {
    throw new Error(`Live build ${ver.identityBuild} != ${EXPECTED}`);
  }
  const results = [];
  results.push(
    await genCase("dog-chow", {
      file: join(outDir, "fixtures/chow-chow.jpg"),
      funnel: "v2",
      species: "dog",
      scene: "formula-racer",
      expectOk: true,
    }),
  );
  results.push(
    await genCase("dog-other", {
      file: join(outDir, "fixtures/other-dog.jpg"),
      funnel: "v2",
      species: "dog",
      scene: "formula-racer",
      expectOk: true,
    }),
  );
  results.push(
    await genCase("cat-v3", {
      file: join(outDir, "fixtures/cat.jpg"),
      funnel: "v3",
      species: "cat",
      scene: "royal-portrait",
      expectOk: true,
    }),
  );
  results.push(
    await genCase("dog-on-cat-v3", {
      file: join(outDir, "fixtures/chow-chow.jpg"),
      funnel: "v3",
      species: "cat",
      scene: "royal-portrait",
      expectOk: false,
      expectError: "wrong_species",
    }),
  );
  // Funnel gate
  const gate = await post({
    funnel_version: "v3",
    species: "cat",
    scene: "formula-racer",
    session_id: sessionId(),
    imageDataUrl: `data:image/jpeg;base64,${load(join(outDir, "fixtures/cat.jpg")).toString("base64")}`,
    idempotency_key: `e2e:gate:${Date.now()}`,
  });
  const gateRow = {
    name: "cat-v3-f1-rejected",
    ok: gate.json.ok,
    errorCode: gate.json.errorCode,
    wallMs: gate.wallMs,
  };
  if (gate.json.errorCode !== "invalid_funnel") {
    throw new Error(`funnel gate failed: ${JSON.stringify(gate.json)}`);
  }
  console.log(JSON.stringify(gateRow));
  results.push(gateRow);

  const summary = {
    identityBuild: EXPECTED,
    edgeUrl,
    replicateOnly: true,
    openaiFallback: false,
    results,
    checkedAt: new Date().toISOString(),
  };
  writeFileSync(join(outDir, "release-e2e.json"), JSON.stringify(summary, null, 2));
  console.log("WROTE", join(outDir, "release-e2e.json"));
}

main().catch((err) => {
  console.error("E2E_FAIL", err);
  process.exit(2);
});
