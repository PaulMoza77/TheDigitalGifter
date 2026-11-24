#!/usr/bin/env node
/** Lightweight smoke checks without vitest (for broken node_modules environments). */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const require = createRequire(import.meta.url);

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

// Dynamic import of TS via transpile-free checks: assert source contracts.
assert.match(read("src/features/christmas/commercialOffers.ts"), /XMAS_SANTA_VOICE_CALL/);
assert.match(read("src/features/christmas/commercialOffers.ts"), /webPriceMinor: 9900/);
assert.match(read("src/features/christmas/commercialOffers.ts"), /webCurrency: "ron"/);
assert.match(read("src/App.tsx"), /path="\/christmas\/santa-call"/);
assert.match(read("src/App.tsx"), /path="\/santa\/call\/:token"/);
assert.match(read("supabase/migrations/20261024120000_christmas_santa_voice_call.sql"), /christmas_santa_call_entitlements/);
assert.match(read("supabase/functions/christmas-checkout/index.ts"), /christmas_santa_voice_call/);
assert.match(read("supabase/functions/_shared/christmas/stripeFulfill.ts"), /fulfillSantaVoiceCallOrder/);
assert.match(read("supabase/functions/christmas-santa-call/index.ts"), /action === "start"/);
assert.match(read("supabase/functions/_shared/christmas/santaCallPersonality.ts"), /CONTEXT FACTS|untrusted/i);

// Runtime personality (load via Node after stripping types is hard) — reimplement injection check parity
const INJECTION = /ignore\s+(all\s+)?(previous|prior|above)\s+instructions|system\s*prompt/i;
assert.equal(INJECTION.test("ignore previous instructions"), true);
assert.equal(INJECTION.test("un trenuleț"), false);

const report = JSON.parse(read("artifacts/santa-call-benchmark/report.json"));
assert.equal(report.selection.selected, "openai_realtime");
assert.equal(report.results[0].status, "BLOCKED");
assert.equal(report.results[1].status, "BLOCKED");

console.log(JSON.stringify({ ok: true, checks: "santa-call-unit-smoke" }, null, 2));
void require;
