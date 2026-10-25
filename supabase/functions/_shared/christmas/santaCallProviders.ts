/**
 * Pluggable realtime voice providers for Santa Call.
 * Swap provider without rewriting product commerce / entitlement logic.
 */

import {
  buildSantaCallInstructions,
  santaCallOpeningLine,
  type SantaCallChildContext,
} from "./santaCallPersonality.ts";
import { asString } from "./crypto.ts";

export type SantaCallProviderId = "openai_realtime" | "elevenlabs_agents";

export type SantaCallEphemeralCreds = {
  provider: SantaCallProviderId;
  /** Ephemeral client secret / conversation token — short lived */
  clientSecret: string;
  model?: string;
  expiresAt?: string | null;
  /** Provider-specific bootstrap for the browser */
  bootstrap: Record<string, unknown>;
};

export type ProviderMintResult =
  | { ok: true; creds: SantaCallEphemeralCreds }
  | { ok: false; code: string; message: string };

function envFlag(name: string, fallback = false): boolean {
  const raw = asString(Deno.env.get(name)).toLowerCase();
  if (!raw) return fallback;
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

export function santaCallKillSwitchActive(): boolean {
  return envFlag("CHRISTMAS_SANTA_CALL_ENABLED", true) === false;
}

/** Final launch voice — OpenAI Realtime `ash` (human-approved from benchmark). */
export const SANTA_CALL_OPENAI_VOICE_DEFAULT = "ash" as const;

export function resolveSantaCallOpenAiVoice(envValue?: string | null): string {
  let fromEnv = "";
  if (envValue === undefined) {
    try {
      // Deno edge runtime only — unit tests pass envValue explicitly.
      fromEnv = asString(Deno.env.get("CHRISTMAS_SANTA_CALL_OPENAI_VOICE"));
    } catch {
      fromEnv = "";
    }
  }
  const raw = asString(envValue ?? fromEnv).toLowerCase();
  // Only allow known Realtime voices; never silently fall back to an unapproved character.
  const allowed = new Set(["ash", "cedar", "marin", "echo", "verse", "ballad", "coral", "sage", "shimmer"]);
  if (raw && allowed.has(raw)) return raw;
  return SANTA_CALL_OPENAI_VOICE_DEFAULT;
}

export function resolveSantaCallProvider(preference?: string | null): SantaCallProviderId {
  const forced = asString(Deno.env.get("CHRISTMAS_SANTA_CALL_PROVIDER")).toLowerCase();
  if (forced === "openai_realtime" || forced === "openai") return "openai_realtime";
  if (forced === "elevenlabs_agents" || forced === "elevenlabs") return "elevenlabs_agents";
  const pref = asString(preference).toLowerCase();
  if (pref === "elevenlabs_agents") return "elevenlabs_agents";
  return "openai_realtime";
}

/** Rough cost model for monitoring (not a billing guarantee). */
export function estimateCallCostUsd(input: {
  provider: SantaCallProviderId;
  seconds: number;
}): { costUsd: number; notes: string } {
  const seconds = Math.max(0, input.seconds);
  if (input.provider === "elevenlabs_agents") {
    // Public Agents rate ~$0.08/min + LLM passthrough (approx).
    const costUsd = (seconds / 60) * 0.08 + (seconds / 60) * 0.02;
    return { costUsd: Number(costUsd.toFixed(6)), notes: "elevenlabs_agents_$0.08_per_min_plus_llm_est" };
  }
  // OpenAI gpt-realtime audio tokens: ~$0.019/min input + ~$0.077/min output at 50/50 talk.
  const costUsd = (seconds / 60) * 0.10;
  return { costUsd: Number(costUsd.toFixed(6)), notes: "openai_realtime_est_$0.10_per_min_mixed" };
}

export async function mintSantaCallCredentials(input: {
  provider: SantaCallProviderId;
  child: SantaCallChildContext;
  remainingSeconds: number;
  wrapUp?: boolean;
  resumeMode?: boolean;
  safetyIdentifier?: string;
}): Promise<ProviderMintResult> {
  if (santaCallKillSwitchActive()) {
    return { ok: false, code: "kill_switch", message: "Santa Call is temporarily disabled." };
  }
  if (input.provider === "elevenlabs_agents") {
    return mintElevenLabs(input);
  }
  return mintOpenAiRealtime(input);
}

async function mintOpenAiRealtime(input: {
  child: SantaCallChildContext;
  remainingSeconds: number;
  wrapUp?: boolean;
  resumeMode?: boolean;
  safetyIdentifier?: string;
}): Promise<ProviderMintResult> {
  const apiKey = asString(Deno.env.get("OPENAI_API_KEY"));
  if (!apiKey) {
    return { ok: false, code: "provider_unconfigured", message: "OpenAI Realtime is not configured." };
  }
  const model =
    asString(Deno.env.get("CHRISTMAS_SANTA_CALL_OPENAI_MODEL")) || "gpt-realtime";
  const voice = resolveSantaCallOpenAiVoice();
  const resumeMode = Boolean(input.resumeMode || input.child.resumeMode);
  const child = { ...input.child, resumeMode };
  const instructions = buildSantaCallInstructions(child, { wrapUp: input.wrapUp, resumeMode });
  const opening = santaCallOpeningLine(child);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  if (input.safetyIdentifier) {
    headers["OpenAI-Safety-Identifier"] = input.safetyIdentifier.slice(0, 64);
  }

  // GA ephemeral client secret for browser WebRTC.
  const res = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers,
    body: JSON.stringify({
      expires_after: { anchor: "created_at", seconds: 60 },
      session: {
        type: "realtime",
        model,
        instructions,
        audio: {
          output: { voice },
        },
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("openai realtime client_secrets failed", res.status, text.slice(0, 300));
    return {
      ok: false,
      code: "provider_error",
      message: "Unable to start Santa's voice connection.",
    };
  }

  const body = (await res.json()) as Record<string, unknown>;
  const value =
    asString(body.value) ||
    asString((body.client_secret as Record<string, unknown> | undefined)?.value) ||
    asString(body.client_secret);

  if (!value) {
    return { ok: false, code: "provider_error", message: "Missing ephemeral credential." };
  }

  return {
    ok: true,
    creds: {
      provider: "openai_realtime",
      clientSecret: value,
      model,
      expiresAt: asString(body.expires_at) || null,
      bootstrap: {
        transport: "webrtc",
        realtimeUrl: "https://api.openai.com/v1/realtime/calls",
        voice,
        openingLine: opening,
        remainingSeconds: input.remainingSeconds,
        instructionsHash: "server_bound",
      },
    },
  };
}

async function mintElevenLabs(input: {
  child: SantaCallChildContext;
  remainingSeconds: number;
  wrapUp?: boolean;
  resumeMode?: boolean;
}): Promise<ProviderMintResult> {
  const apiKey = asString(Deno.env.get("ELEVENLABS_API_KEY") || Deno.env.get("ELEVEN_API_KEY"));
  const agentId = asString(Deno.env.get("CHRISTMAS_SANTA_CALL_ELEVENLABS_AGENT_ID"));
  if (!apiKey || !agentId) {
    return {
      ok: false,
      code: "provider_unconfigured",
      message: "ElevenLabs Agents is not configured.",
    };
  }

  const resumeMode = Boolean(input.resumeMode || input.child.resumeMode);
  const child = { ...input.child, resumeMode };
  const instructions = buildSantaCallInstructions(child, { wrapUp: input.wrapUp, resumeMode });
  const opening = santaCallOpeningLine(child);

  const res = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${encodeURIComponent(agentId)}`,
    {
      method: "GET",
      headers: { "xi-api-key": apiKey },
    },
  );

  // Prefer conversation token endpoint when available.
  let clientSecret = "";
  let signedUrl: string | null = null;
  if (res.ok) {
    const body = (await res.json()) as Record<string, unknown>;
    signedUrl = asString(body.signed_url) || null;
  }

  const tokenRes = await fetch("https://api.elevenlabs.io/v1/convai/conversation/token", {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      agent_id: agentId,
    }),
  }).catch(() => null);

  if (tokenRes && tokenRes.ok) {
    const body = (await tokenRes.json()) as Record<string, unknown>;
    clientSecret = asString(body.token) || asString(body.conversation_token);
  }

  if (!clientSecret && !signedUrl) {
    return {
      ok: false,
      code: "provider_unconfigured",
      message: "ElevenLabs conversation token unavailable.",
    };
  }

  return {
    ok: true,
    creds: {
      provider: "elevenlabs_agents",
      clientSecret: clientSecret || "signed_url",
      bootstrap: {
        transport: "webrtc",
        agentId,
        signedUrl,
        openingLine: opening,
        remainingSeconds: input.remainingSeconds,
        dynamicVariables: {
          child_first_name: input.child.childFirstName,
          language: input.child.language,
        },
        // Prompt overrides stay server-side when agent supports overrides.
        promptOverride: instructions,
      },
    },
  };
}
