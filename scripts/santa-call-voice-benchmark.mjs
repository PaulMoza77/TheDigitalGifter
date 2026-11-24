#!/usr/bin/env node
/**
 * Reproducible Santa Call voice-provider benchmark harness.
 *
 * Does NOT invent results. Providers without credentials are marked BLOCKED.
 *
 * Usage:
 *   OPENAI_API_KEY=... node scripts/santa-call-voice-benchmark.mjs
 *   ELEVENLABS_API_KEY=... CHRISTMAS_SANTA_CALL_ELEVENLABS_AGENT_ID=... node scripts/santa-call-voice-benchmark.mjs
 *
 * Writes: artifacts/santa-call-benchmark/report.json
 */

import fs from "node:fs";
import path from "node:path";

const OUT_DIR = path.resolve("artifacts/santa-call-benchmark");
fs.mkdirSync(OUT_DIR, { recursive: true });

const OPENAI = process.env.OPENAI_API_KEY || "";
const ELEVEN = process.env.ELEVENLABS_API_KEY || process.env.ELEVEN_API_KEY || "";
const ELEVEN_AGENT = process.env.CHRISTMAS_SANTA_CALL_ELEVENLABS_AGENT_ID || "";

/** Public pricing references (docs as of mission date) — for estimate only. */
const PRICING = {
  openai_realtime: {
    source: "https://openai.com/api/pricing/",
    audio_input_per_m_tokens_usd: 32,
    audio_output_per_m_tokens_usd: 64,
    // 1 token / 100ms input, 1 token / 50ms output
    est_per_minute_50_50_usd: 0.0192 + 0.0768,
    notes: "Estimate assumes ~50/50 talk time; measure real usage from API.",
  },
  elevenlabs_agents: {
    source: "https://elevenlabs.io/pricing/agents",
    call_per_minute_usd: 0.08,
    llm_passthrough_est_per_minute_usd: 0.02,
    est_per_minute_usd: 0.1,
    notes: "Agents call minutes + separate LLM; silence discount may apply.",
  },
};

function estimateThreeMinutes(providerKey) {
  if (providerKey === "openai_realtime") {
    const perMin = PRICING.openai_realtime.est_per_minute_50_50_usd;
    return { usd: Number((perMin * 3).toFixed(4)), ron_est: Number((perMin * 3 * 4.6).toFixed(2)) };
  }
  const perMin = PRICING.elevenlabs_agents.est_per_minute_usd;
  return { usd: Number((perMin * 3).toFixed(4)), ron_est: Number((perMin * 3 * 4.6).toFixed(2)) };
}

async function probeOpenAi() {
  if (!OPENAI) {
    return {
      provider: "openai_realtime",
      status: "BLOCKED",
      reason: "OPENAI_API_KEY missing",
      quality: null,
      latency_ms: null,
      measured_cost_3min: null,
      estimate_3min: estimateThreeMinutes("openai_realtime"),
    };
  }
  const started = Date.now();
  const res = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      expires_after: { anchor: "created_at", seconds: 60 },
      session: {
        type: "realtime",
        model: process.env.CHRISTMAS_SANTA_CALL_OPENAI_MODEL || "gpt-realtime",
        instructions: "You are Santa. Say ho ho ho briefly in Romanian.",
      },
    }),
  });
  const latency_ms = Date.now() - started;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      provider: "openai_realtime",
      status: "BLOCKED",
      reason: `client_secrets HTTP ${res.status}`,
      latency_ms,
      detail: typeof body === "object" ? body.error || body : null,
      estimate_3min: estimateThreeMinutes("openai_realtime"),
      measured_cost_3min: null,
      quality: null,
    };
  }
  return {
    provider: "openai_realtime",
    status: "PROBED",
    reason: "Ephemeral client secret minted successfully. Full WebRTC child-speech QA still required manually.",
    latency_ms,
    has_client_secret: Boolean(body.value || body.client_secret),
    estimate_3min: estimateThreeMinutes("openai_realtime"),
    measured_cost_3min: null,
    quality: {
      romanian: "UNTESTED_LIVE_AUDIO",
      english: "UNTESTED_LIVE_AUDIO",
      barge_in: "UNTESTED_LIVE_AUDIO",
      webrtc: "CLIENT_IMPLEMENTED",
    },
  };
}

async function probeEleven() {
  if (!ELEVEN || !ELEVEN_AGENT) {
    return {
      provider: "elevenlabs_agents",
      status: "BLOCKED",
      reason: !ELEVEN
        ? "ELEVENLABS_API_KEY missing"
        : "CHRISTMAS_SANTA_CALL_ELEVENLABS_AGENT_ID missing",
      estimate_3min: estimateThreeMinutes("elevenlabs_agents"),
      measured_cost_3min: null,
      quality: null,
      latency_ms: null,
    };
  }
  const started = Date.now();
  const res = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${encodeURIComponent(ELEVEN_AGENT)}`,
    { headers: { "xi-api-key": ELEVEN } },
  );
  const latency_ms = Date.now() - started;
  if (!res.ok) {
    return {
      provider: "elevenlabs_agents",
      status: "BLOCKED",
      reason: `signed_url HTTP ${res.status}`,
      latency_ms,
      estimate_3min: estimateThreeMinutes("elevenlabs_agents"),
      measured_cost_3min: null,
      quality: null,
    };
  }
  return {
    provider: "elevenlabs_agents",
    status: "PROBED",
    reason: "Signed URL issued. Full Conversational AI QA still required manually.",
    latency_ms,
    estimate_3min: estimateThreeMinutes("elevenlabs_agents"),
    measured_cost_3min: null,
    quality: {
      romanian: "UNTESTED_LIVE_AUDIO",
      english: "UNTESTED_LIVE_AUDIO",
      barge_in: "UNTESTED_LIVE_AUDIO",
      webrtc: "ADAPTER_READY",
    },
  };
}

const openai = await probeOpenAi();
const eleven = await probeEleven();

const selection = {
  selected: "openai_realtime",
  rationale: [
    "OpenAI already exists in TDG stack (Santa TTS / Clip Factory) — no new vendor required for v1.",
    "Provider abstraction allows ElevenLabs swap without rewriting commerce.",
    "Docs pricing estimate for 3 minutes (~$0.29 / ~1.3 RON) is under the 3 RON technical target.",
    "ElevenLabs Agents estimate also under target but credentials are currently unavailable in this environment.",
  ],
  cost_target_ron: 3,
  estimates_only: true,
};

const report = {
  generated_at: new Date().toISOString(),
  pricing_references: PRICING,
  results: [openai, eleven],
  selection,
  live_audio_call_proof: "NOT_RUN",
  stripe_test_proof: "NOT_RUN",
  email_proof: "NOT_RUN",
};

fs.writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ out: path.join(OUT_DIR, "report.json"), selection: selection.selected, openai: openai.status, eleven: eleven.status }, null, 2));
