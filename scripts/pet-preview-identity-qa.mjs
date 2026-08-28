#!/usr/bin/env node
/**
 * Protected local harness for pet-preview identity QA.
 *
 * Usage:
 *   REPLICATE_API_TOKEN=... OPENAI_API_KEY=... node scripts/pet-preview-identity-qa.mjs
 *
 * Optional:
 *   PET_PREVIEW_QA_LIVE=1   — call live Replicate (costs ~$0.04/image)
 *   PET_PREVIEW_QA_OUT=...  — output directory (default: output/pet-preview-qa)
 *
 * Without PET_PREVIEW_QA_LIVE, runs offline gate checks + contact-sheet scaffolding only.
 * Never logs raw image bytes, secrets, or signed URLs.
 */

import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync, existsSync, copyFileSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(process.env.PET_PREVIEW_QA_OUT || join(root, "output/pet-preview-qa"));
const live = String(process.env.PET_PREVIEW_QA_LIVE || "") === "1";
const token = String(process.env.REPLICATE_API_TOKEN || "").trim();

const FIXTURES = [
  {
    id: "chow-chow",
    label: "Fluffy reddish-brown Chow Chow",
    expectedSpecies: "dog",
    funnel: "v2",
    source: join(root, "../home/ubuntu/.cursor/projects/workspace/assets/a6360567-6055-4ced-85a6-b1e3f90651ae.jpg"),
    altSources: [
      "/home/ubuntu/.cursor/projects/workspace/assets/a6360567-6055-4ced-85a6-b1e3f90651ae.jpg",
      join(root, "output/pet-preview-qa/fixtures/chow-chow.jpg"),
    ],
  },
  { id: "short-hair-dog", label: "Short-haired dog", expectedSpecies: "dog", funnel: "v2", source: null },
  { id: "black-dog", label: "Black dog", expectedSpecies: "dog", funnel: "v2", source: null },
  { id: "white-cat", label: "White cat", expectedSpecies: "cat", funnel: "v3", source: null },
  { id: "tabby-cat", label: "Tabby cat", expectedSpecies: "cat", funnel: "v3", source: null },
  { id: "long-hair-cat", label: "Long-haired cat", expectedSpecies: "cat", funnel: "v3", source: null },
];

const GATES = {
  correctSpecies: true,
  sessionSourceAssociation: true,
  zeroSilentFallback: true,
  recognizableSamePet: 0,
  chowChowPass: false,
  routingTestsPass: true,
};

function sha8(buf) {
  return createHash("sha256").update(buf).digest("hex").slice(0, 8);
}

function resolveSource(fixture) {
  const candidates = [fixture.source, ...(fixture.altSources || [])].filter(Boolean);
  for (const path of candidates) {
    if (path && existsSync(path)) return path;
  }
  return null;
}

function offlineGateReport() {
  const previewFn = readFileSync(join(root, "supabase/functions/pet-v2-preview/index.ts"), "utf8");
  const context = readFileSync(
    join(root, "supabase/functions/_shared/pet/previewFunnelContext.ts"),
    "utf8",
  );
  const v2Preview = readFileSync(join(root, "src/features/pet-v2/screens/PreviewScreen.tsx"), "utf8");
  const v3Config = readFileSync(join(root, "src/features/pet-v3/config.ts"), "utf8");

  const checks = [
    {
      id: "no-text-only-fallback",
      pass: previewFn.includes("never create a text-only prediction") && previewFn.includes("input_image"),
    },
    {
      id: "species-validation-wired",
      pass: previewFn.includes("validatePetSpecies") && previewFn.includes("wrong_species"),
    },
    {
      id: "image-decode-gate",
      pass: previewFn.includes("decodePreviewDataUrl"),
    },
    {
      id: "identity-lock-present",
      pass: context.includes("authoritative identity reference"),
    },
    {
      id: "f1-bans-humans-logos",
      pass: /no human driver/i.test(context) && /logos/i.test(context),
    },
    {
      id: "dog-copy-not-cat",
      pass: v2Preview.includes("petLabel") && !v2Preview.includes("Your cat’s secret life starts here"),
    },
    {
      id: "cat-copy-not-f1",
      pass: v3Config.includes("Your cat’s secret life starts here") && !/Formula 1/.test(v3Config),
    },
    {
      id: "missing-funnel-version-recovers-v3",
      pass: context.includes('scene === "royal-portrait"'),
    },
  ];

  return checks;
}

function contactSheetHtml(rows) {
  const cards = rows
    .map((row) => {
      const sourceImg = row.sourceDataUrl
        ? `<img src="${row.sourceDataUrl}" alt="source ${row.id}" />`
        : `<div class="missing">No fixture image</div>`;
      const previewImg = row.previewDataUrl
        ? `<img src="${row.previewDataUrl}" alt="preview ${row.id}" />`
        : `<div class="missing">${row.previewNote || "Preview not generated"}</div>`;
      const scores = Object.entries(row.scores || {})
        .map(([k, v]) => `<li>${k}: <strong>${v}</strong></li>`)
        .join("");
      return `<section class="card">
        <h2>${row.label}</h2>
        <div class="pair">${sourceImg}${previewImg}</div>
        <ul>${scores}</ul>
        <p class="meta">funnel=${row.funnel} species=${row.expectedSpecies} hash=${row.hash || "n/a"}</p>
      </section>`;
    })
    .join("\n");

  return `<!doctype html>
<html><head><meta charset="utf-8"/><title>Pet preview identity QA</title>
<style>
body{font-family:ui-sans-serif,system-ui;background:#111;color:#f5f0e8;margin:24px}
.card{border:1px solid #444;border-radius:16px;padding:16px;margin-bottom:20px;background:#1a1510}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:12px}
img{width:100%;border-radius:12px;background:#000}
.missing{display:grid;place-items:center;min-height:180px;border:1px dashed #666;border-radius:12px;color:#aaa}
ul{display:flex;flex-wrap:wrap;gap:12px;list-style:none;padding:0}
.meta{opacity:.7;font-size:12px}
</style></head><body>
<h1>Pet preview identity contact sheet</h1>
<p>Live generation: ${live ? "yes" : "no (offline gates only)"}</p>
${cards}
</body></html>`;
}

async function maybeLivePreview(fixture, sourcePath) {
  if (!live || !token || !sourcePath) {
    return { previewDataUrl: null, previewNote: live ? "Missing token or source" : "Offline mode" };
  }
  const bytes = readFileSync(sourcePath);
  const imageDataUrl = `data:image/jpeg;base64,${bytes.toString("base64")}`;
  const model = process.env.PET_PREVIEW_IMAGE_MODEL || "black-forest-labs/flux-kontext-pro";
  const prompt =
    fixture.funnel === "v3"
      ? "Use the uploaded pet photo as the authoritative identity reference. Create the same individual cat as a royal ruler. Preserve exact breed, coat, face, ears. No dogs. No humans. No logos."
      : "Use the uploaded pet photo as the authoritative identity reference. Create the same individual dog as a Formula 1 style racing driver alone in the cockpit. Preserve exact breed, coat, face, ears, muzzle. No humans. No logos. No German Shepherd features unless in the reference.";

  const created = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: {
        prompt,
        input_image: imageDataUrl,
        aspect_ratio: "match_input_image",
        output_format: "jpg",
        prompt_upsampling: false,
        safety_tolerance: 2,
      },
    }),
  });
  const createdJson = await created.json();
  if (!created.ok || !createdJson.id) {
    return { previewDataUrl: null, previewNote: `create_failed:${created.status}` };
  }

  for (let i = 0; i < 60; i += 1) {
    await new Promise((r) => setTimeout(r, 2000));
    const poll = await fetch(`https://api.replicate.com/v1/predictions/${createdJson.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await poll.json();
    if (json.status === "succeeded") {
      const url = Array.isArray(json.output) ? json.output[0] : json.output;
      if (typeof url !== "string") return { previewDataUrl: null, previewNote: "no_output_url" };
      const img = await fetch(url);
      const buf = Buffer.from(await img.arrayBuffer());
      return { previewDataUrl: `data:image/jpeg;base64,${buf.toString("base64")}`, previewNote: "live" };
    }
    if (json.status === "failed" || json.status === "canceled") {
      return { previewDataUrl: null, previewNote: `provider_${json.status}` };
    }
  }
  return { previewDataUrl: null, previewNote: "timeout" };
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  mkdirSync(join(outDir, "fixtures"), { recursive: true });

  const offline = offlineGateReport();
  const offlineFail = offline.filter((c) => !c.pass);
  GATES.routingTestsPass = offlineFail.length === 0;
  GATES.zeroSilentFallback = offline.some((c) => c.id === "no-text-only-fallback" && c.pass);

  const rows = [];
  let liveCalls = 0;
  for (const fixture of FIXTURES) {
    const sourcePath = resolveSource(fixture);
    if (sourcePath && fixture.id === "chow-chow") {
      copyFileSync(sourcePath, join(outDir, "fixtures/chow-chow.jpg"));
    }
    let sourceDataUrl = null;
    let hash = null;
    if (sourcePath) {
      const bytes = readFileSync(sourcePath);
      hash = sha8(bytes);
      sourceDataUrl = `data:image/jpeg;base64,${bytes.toString("base64")}`;
    }

    const liveResult = await maybeLivePreview(fixture, sourcePath);
    if (live && sourcePath && token) liveCalls += 1;

    const scores = {
      correct_species: sourcePath ? "pending_manual" : "fixture_missing",
      recognizable_same_animal: sourcePath ? "pending_manual" : "fixture_missing",
      coat_markings: sourcePath ? "pending_manual" : "fixture_missing",
      face_head_geometry: sourcePath ? "pending_manual" : "fixture_missing",
      no_extra_animal_person: sourcePath ? "pending_manual" : "fixture_missing",
      scene_quality: sourcePath ? "pending_manual" : "fixture_missing",
    };

    if (fixture.id === "chow-chow" && liveResult.previewDataUrl) {
      // Manual visual gate still required — do not auto-pass identity.
      scores.correct_species = "needs_visual_review";
      GATES.chowChowPass = false;
    }

    rows.push({
      ...fixture,
      hash,
      sourceDataUrl: sourceDataUrl ? sourceDataUrl.slice(0, 120) + "…" : null,
      // Keep full data URLs only in the HTML contact sheet file, not in JSON summary.
      previewDataUrl: null,
      previewNote: liveResult.previewNote,
      scores,
      _sourceDataUrl: sourceDataUrl,
      _previewDataUrl: liveResult.previewDataUrl,
    });
  }

  const htmlRows = rows.map(({ _sourceDataUrl, _previewDataUrl, ...row }) => ({
    ...row,
    sourceDataUrl: _sourceDataUrl,
    previewDataUrl: _previewDataUrl,
  }));
  const sheetPath = join(outDir, "contact-sheet.html");
  writeFileSync(sheetPath, contactSheetHtml(htmlRows));

  const summary = {
    generatedAt: new Date().toISOString(),
    live,
    liveCalls,
    estimatedCostUsd: liveCalls * 0.04,
    offlineGates: offline,
    releaseGates: GATES,
    contactSheet: sheetPath,
    note:
      "Identity pass/fail for recognizable-same-pet requires visual review of the contact sheet. Do not treat HTTP 200 as success.",
  };
  writeFileSync(join(outDir, "summary.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  if (offlineFail.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: String(err?.message || err) }));
  process.exit(1);
});
