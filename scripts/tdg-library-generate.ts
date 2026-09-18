#!/usr/bin/env npx tsx
/**
 * TDG Library — Higgsfield image-to-video, then import the original MP4 into the existing library.
 *
 * First real test (after secrets are on this host — do not paste them in chat):
 *   npx tsx scripts/tdg-library-generate.ts --photo photo-nyc-ice-girl --prompt "subtle snowfall, slow cinematic push-in" --estimate-only
 *   npx tsx scripts/tdg-library-generate.ts --photo photo-nyc-ice-girl --prompt "subtle snowfall, slow cinematic push-in" --budget 1.50
 *
 * Resume after the tablet/agent disconnects (same job, no duplicate paid submit):
 *   npx tsx scripts/tdg-library-generate.ts --job <uuid>
 *
 * Retry TDG import only:
 *   npx tsx scripts/tdg-library-generate.ts --job <uuid> --retry-import
 *
 * Assemble selected library clips with the existing ffmpeg Reel montage:
 *   npx tsx scripts/tdg-library-generate.ts --compose short-ice-nyc,short-kids-sled --title "Cut 4"
 *
 * Secrets on the job runner only:
 *   HF_CREDENTIALS=KEY_ID:KEY_SECRET
 *   SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...
 * Vercel: Project → Settings → Environment Variables (Production + Preview).
 * VPS: /opt/mozas/projects/thedigitalgifter/secrets/app.env
 * Local agent: gitignored .env (never VITE_).
 *
 * Paid generate is never started by --estimate-only or by tests with HIGGSFIELD_MOCK=1.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { getServiceClient } from "../api/_lib/christmas/supabaseClient";
import { composeLibraryReel } from "../api/_lib/higgsfield/compose";
import { estimateJob, retryImport, submitJob, syncJob } from "../api/_lib/higgsfield/jobs";

function loadDotEnv() {
  const path = resolve(process.cwd(), ".env");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx < 1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadDotEnv();

function arg(name: string, fallback = ""): string {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  const prefix = `--${name}=`;
  const hit = process.argv.find((item) => item.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : fallback;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function usage(): void {
  console.log(`Usage:
  npx tsx scripts/tdg-library-generate.ts --photo <library photo id> --prompt "<text>" --budget <usd>
  npx tsx scripts/tdg-library-generate.ts --photo <id> --prompt "<text>" --estimate-only
  npx tsx scripts/tdg-library-generate.ts --job <uuid>
  npx tsx scripts/tdg-library-generate.ts --compose id1,id2 [--title "Reel"]`);
}

function publicJob(job: { id: string; status: string; provider_request_id: string | null; estimated_cost_usd: number | null; confirmed_cost_usd: number | null; last_error: string | null; effective_width: number | null; effective_height: number | null }) {
  return {
    id: job.id,
    status: job.status,
    provider_request_id: job.provider_request_id,
    estimated_cost_usd: job.estimated_cost_usd,
    confirmed_cost_usd: job.confirmed_cost_usd,
    last_error: job.last_error,
    effective_width: job.effective_width,
    effective_height: job.effective_height,
  };
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function main() {
  if (hasFlag("help") || hasFlag("h")) {
    usage();
    return;
  }
  const service = getServiceClient();

  if (hasFlag("compose") || arg("compose")) {
    const clipIds = arg("compose").split(",").map((s) => s.trim()).filter(Boolean);
    const reel = await composeLibraryReel({
      service,
      clipIds,
      title: arg("title") || undefined,
      createdBy: "script",
    });
    console.log(JSON.stringify({ reel, charged: false }, null, 2));
    return;
  }

  const jobId = arg("job");
  if (jobId && hasFlag("retry-import")) {
    const job = await retryImport({ service, jobId });
    console.log(JSON.stringify({ regenerated: false, job: publicJob(job) }, null, 2));
    return;
  }

  let currentId = jobId;
  if (!currentId) {
    const photo = arg("photo");
    const prompt = arg("prompt");
    if (!photo || !prompt) {
      usage();
      process.exit(1);
    }
    const estimated = await estimateJob({
      service,
      photoId: photo,
      prompt,
      modelKey: arg("model", "kling-3.0-pro"),
      createdBy: "script",
      clientKey: arg("command-key") || null,
    });
    console.log(
      JSON.stringify(
        {
          estimate: estimated.estimate,
          notes: estimated.notes,
          job: publicJob(estimated.job),
        },
        null,
        2,
      ),
    );
    if (hasFlag("estimate-only")) return;
    const budget = Number(arg("budget"));
    if (!Number.isFinite(budget) || budget <= 0) {
      throw new Error("Pass --budget <usd> after reviewing the estimate. Refusing uncapped generate.");
    }
    const submitted = await submitJob({
      service,
      jobId: estimated.job.id,
      budgetUsd: budget,
      createdBy: "script",
    });
    currentId = submitted.job.id;
    console.log(JSON.stringify({ submitted: submitted.submitted, job: publicJob(submitted.job) }, null, 2));
  }

  const pollMs = Number(arg("poll-ms", "5000"));
  const timeoutMs = Number(arg("timeout-ms", "900000"));
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const synced = await syncJob({ service, jobId: currentId });
    console.log(JSON.stringify({ status: synced.job.status, imported: synced.imported, job: publicJob(synced.job) }, null, 2));
    if (["imported", "failed", "nsfw", "canceled"].includes(synced.job.status)) {
      if (synced.job.status !== "imported") process.exitCode = 2;
      return;
    }
    if (synced.job.status === "import_failed") {
      const retried = await retryImport({ service, jobId: currentId });
      console.log(JSON.stringify({ regenerated: false, job: publicJob(retried) }, null, 2));
      if (retried.status === "imported") return;
    }
    await sleep(pollMs);
  }
  throw new Error(`Timed out. Re-run: npx tsx scripts/tdg-library-generate.ts --job ${currentId}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
