export const HIGGSFIELD_API_BASE = "https://api.higgsfield.ai";

export const HIGGSFIELD_DEFAULTS = {
  durationSeconds: 5,
  aspectRatio: "9:16",
  resolution: "1080p",
  audio: false,
} as const;

export type HiggsfieldModelKey = "kling-3.0-pro" | "seedance-2.0";

export type HiggsfieldModelDef = {
  key: HiggsfieldModelKey;
  label: string;
  /** Official Higgsfield model ID / subscribe path. */
  modelId: string;
  submitPath: string;
  estimatePath: string;
  duration: { min: number; max: number; default: number };
  supports: {
    resolution: readonly string[] | null;
    aspectRatio: boolean;
    audio: "sound" | "generate_audio" | null;
  };
};

export const HIGGSFIELD_MODELS: Record<HiggsfieldModelKey, HiggsfieldModelDef> = {
  "kling-3.0-pro": {
    key: "kling-3.0-pro",
    label: "Kling 3.0 Pro",
    modelId: "kling-video/v3.0/pro/image-to-video",
    submitPath: "/kling-video/v3.0/pro/image-to-video",
    estimatePath: "/estimate/kling-video/v3.0/pro/image-to-video",
    duration: { min: 3, max: 15, default: 5 },
    // Official API reference does not expose resolution or aspect_ratio.
    // 9:16 / 1080p come from the source still; we never send 720p.
    supports: {
      resolution: null,
      aspectRatio: false,
      audio: "sound",
    },
  },
  "seedance-2.0": {
    key: "seedance-2.0",
    label: "Seedance 2.0",
    modelId: "bytedance/seedance-2.0/image-to-video",
    submitPath: "/bytedance/seedance-2.0/image-to-video",
    estimatePath: "/estimate/bytedance/seedance-2.0/image-to-video",
    duration: { min: 4, max: 15, default: 5 },
    supports: {
      resolution: ["480p", "720p", "1080p", "4k"],
      aspectRatio: false,
      audio: "generate_audio",
    },
  },
};

export const HIGGSFIELD_MODEL_KEYS = Object.keys(HIGGSFIELD_MODELS) as HiggsfieldModelKey[];

export type RequestedClipSettings = {
  durationSeconds: number;
  aspectRatio: "9:16";
  resolution: "1080p";
  audio: false;
};

export function requestedClipSettings(durationSeconds = HIGGSFIELD_DEFAULTS.durationSeconds): RequestedClipSettings {
  return {
    durationSeconds,
    aspectRatio: HIGGSFIELD_DEFAULTS.aspectRatio,
    resolution: HIGGSFIELD_DEFAULTS.resolution,
    audio: false,
  };
}

export type SubmitPayloadResult = {
  model: HiggsfieldModelDef;
  requested: RequestedClipSettings;
  submitted: Record<string, unknown>;
  omitted: string[];
  notes: string[];
};

export function assertDurationSupported(model: HiggsfieldModelDef, durationSeconds: number): void {
  if (durationSeconds < model.duration.min || durationSeconds > model.duration.max) {
    throw new Error(
      `${model.label} duration must be ${model.duration.min}–${model.duration.max}s (requested ${durationSeconds}s).`,
    );
  }
}

/**
 * Build the JSON body documented for each model.
 * Never substitutes another model or a lower resolution.
 */
export function buildImageToVideoPayload(input: {
  modelKey: HiggsfieldModelKey;
  imageUrl: string;
  prompt: string;
  settings?: Partial<RequestedClipSettings>;
}): SubmitPayloadResult {
  const model = HIGGSFIELD_MODELS[input.modelKey];
  if (!model) throw new Error(`Unknown model: ${String(input.modelKey)}`);
  const requested = requestedClipSettings(input.settings?.durationSeconds ?? model.duration.default);
  assertDurationSupported(model, requested.durationSeconds);

  const omitted: string[] = [];
  const notes: string[] = [];
  const submitted: Record<string, unknown> = {
    image_url: input.imageUrl,
  };
  const prompt = input.prompt.trim();
  if (prompt) submitted.prompt = prompt;
  submitted.duration = requested.durationSeconds;

  if (model.supports.audio === "sound") {
    submitted.sound = requested.audio ? "on" : "off";
  } else if (model.supports.audio === "generate_audio") {
    submitted.generate_audio = requested.audio;
  } else {
    omitted.push("audio");
    notes.push(`${model.label} does not document an audio toggle; none was sent.`);
  }

  if (model.supports.resolution) {
    if (!model.supports.resolution.includes(requested.resolution)) {
      throw new Error(
        `${model.label} does not document ${requested.resolution}. Supported: ${model.supports.resolution.join(", ")}. No silent substitute.`,
      );
    }
    submitted.resolution = requested.resolution;
  } else {
    omitted.push("resolution");
    notes.push(
      `${model.label} API does not document a resolution parameter. 1080p was requested but not sent; effective size is recorded from the downloaded MP4. Source still should already be 9:16 1080×1920.`,
    );
  }

  if (!model.supports.aspectRatio) {
    omitted.push("aspect_ratio");
    notes.push(
      `${model.label} API does not document aspect_ratio for image-to-video. Vertical 9:16 is expected from the source photo.`,
    );
  }

  return { model, requested, submitted, omitted, notes };
}

export type VerifiedEstimate = {
  usd: number;
  credits: string | null;
  source: "higgsfield_estimate";
};

export function parseHiggsfieldEstimate(body: unknown): VerifiedEstimate | null {
  if (!body || typeof body !== "object") return null;
  const rec = body as Record<string, unknown>;
  const usdRaw = rec.usd ?? rec.cost_usd ?? rec.price_usd;
  const usd =
    typeof usdRaw === "number"
      ? usdRaw
      : typeof usdRaw === "string" && usdRaw.trim()
        ? Number(usdRaw)
        : NaN;
  if (!Number.isFinite(usd) || usd < 0) return null;
  const credits = rec.credits == null ? null : String(rec.credits);
  return { usd, credits, source: "higgsfield_estimate" };
}

export function budgetAllows(input: { budgetUsd: number; estimatedUsd: number | null }): {
  ok: boolean;
  reason: string | null;
} {
  if (!Number.isFinite(input.budgetUsd) || input.budgetUsd <= 0) {
    return { ok: false, reason: "An explicit budgetUsd > 0 is required before a paid generation." };
  }
  if (input.estimatedUsd == null) {
    return {
      ok: false,
      reason: "No verifiable Higgsfield estimate is available. Paid submit is blocked so a cost is not invented.",
    };
  }
  if (input.estimatedUsd > input.budgetUsd) {
    return {
      ok: false,
      reason: `Estimated $${input.estimatedUsd.toFixed(4)} exceeds budget $${input.budgetUsd.toFixed(4)}.`,
    };
  }
  return { ok: true, reason: null };
}

export function isHiggsfieldModelKey(value: string): value is HiggsfieldModelKey {
  return value === "kling-3.0-pro" || value === "seedance-2.0";
}
