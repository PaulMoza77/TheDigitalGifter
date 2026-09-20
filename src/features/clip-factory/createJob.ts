import { classifyVideoUrl, sourceKindForProvider } from "./ingest/classify";
import { isFullImport } from "./ingest/capability";
import type { IngestionCapability } from "./ingest/capability";
import { requiresRightsConfirmation, rightsConfirmationError } from "./jobStates";
import {
  CAPTION_STYLES,
  DEFAULT_CLIP_FACTORY_OPTIONS,
  DURATION_OPTIONS,
  OBJECTIVE_OPTIONS,
  PLATFORM_OPTIONS,
  type ClipFactoryOptions,
} from "./types";

export type CreateJobInput = {
  source_kind?: string;
  url?: string;
  object_path?: string;
  file_name?: string;
  library_asset_id?: string;
  library_kind?: "catalog" | "asset";
  source_label?: string;
  rights_confirmed?: boolean;
  options?: Partial<ClipFactoryOptions>;
  auto_render?: boolean;
};

export type PreparedJob =
  | {
      ok: true;
      sourceKind: string;
      sourcePayload: Record<string, unknown>;
      sourceLabel: string;
      provider: string;
      options: ClipFactoryOptions;
      rightsConfirmed: boolean;
      autoRender: boolean;
      waitingForMedia: boolean;
      ingestionCapability: IngestionCapability;
    }
  | { ok: false; code: string; message: string };

function attachReference(url: string | undefined, payload: Record<string, unknown>): Record<string, unknown> {
  if (!url) return payload;
  const decision = classifyVideoUrl(url);
  if (!decision.ok) return payload;
  return {
    ...payload,
    referenceUrl: decision.normalizedUrl,
    url: payload.url || decision.normalizedUrl,
    provider: decision.provider,
    importMode: decision.importMode,
    ingestionCapability: decision.ingestionCapability,
  };
}

export function prepareClipFactoryJob(body: CreateJobInput): PreparedJob {
  const options = { ...DEFAULT_CLIP_FACTORY_OPTIONS, ...(body.options || {}) };
  if (!DURATION_OPTIONS.includes(options.duration) || !OBJECTIVE_OPTIONS.includes(options.objective)) {
    return { ok: false, code: "invalid_request", message: "Invalid clip options." };
  }
  if (!PLATFORM_OPTIONS.includes(options.platform) || !CAPTION_STYLES.includes(options.captionStyle)) {
    return { ok: false, code: "invalid_request", message: "Invalid clip options." };
  }
  if (options.objective === "viral" && options.aiHook == null) options.aiHook = true;

  const requestedKind = String(body.source_kind || "").trim();
  let sourceKind = requestedKind;
  let sourcePayload: Record<string, unknown> = {};
  let sourceLabel = String(body.source_label || "").trim() || "Untitled video";
  let provider = requestedKind || "unknown";
  let waitingForMedia = false;
  let ingestionCapability: IngestionCapability = "FULL_IMPORT";

  if (requestedKind === "upload" || String(body.object_path || "").startsWith("uploads/")) {
    const objectPath = String(body.object_path || "");
    if (!objectPath.startsWith("uploads/")) {
      return { ok: false, code: "invalid_request", message: "Upload path is invalid." };
    }
    sourcePayload = attachReference(body.url, { objectPath, mediaKind: "upload" });
    sourceLabel = String(body.file_name || sourceLabel);
    provider = typeof sourcePayload.provider === "string" ? String(sourcePayload.provider) : "upload";
    sourceKind = provider === "youtube" || provider === "vimeo" ? provider : "upload";
  } else if (requestedKind === "library" || body.library_asset_id) {
    const libraryAssetId = String(body.library_asset_id || "");
    if (!libraryAssetId) {
      return { ok: false, code: "invalid_request", message: "Choose a video from the Library." };
    }
    sourcePayload = attachReference(body.url, {
      libraryAssetId,
      libraryKind: body.library_kind || "catalog",
      mediaKind: "library",
    });
    provider = typeof sourcePayload.provider === "string" ? String(sourcePayload.provider) : "library";
    sourceKind = provider === "youtube" || provider === "vimeo" ? provider : "library";
  } else {
    const decision = classifyVideoUrl(String(body.url || ""));
    if (!decision.ok) {
      return { ok: false, code: decision.code, message: decision.message };
    }
    sourceKind = sourceKindForProvider(decision.provider);
    provider = decision.provider;
    sourcePayload = { url: decision.normalizedUrl, referenceUrl: decision.normalizedUrl, provider: decision.provider, importMode: decision.importMode, ingestionCapability: decision.ingestionCapability, mediaUrl: decision.canImport ? decision.normalizedUrl : null };
    sourceLabel = sourceLabel === "Untitled video" ? new URL(decision.normalizedUrl).hostname : sourceLabel;
    ingestionCapability = decision.ingestionCapability;
    waitingForMedia = !isFullImport(decision.ingestionCapability);
    if (waitingForMedia) {
      sourcePayload.mediaKind = "reference";
    }
  }

  const hasLocalMedia = Boolean(sourcePayload.objectPath || sourcePayload.libraryAssetId);
  if (!waitingForMedia && !hasLocalMedia && requiresRightsConfirmation(sourceKind)) {
    const rightsError = rightsConfirmationError(body.rights_confirmed);
    if (rightsError) return { ok: false, code: "rights_required", message: rightsError };
  }

  return {
    ok: true,
    sourceKind,
    sourcePayload,
    sourceLabel,
    provider,
    options,
    rightsConfirmed: Boolean(body.rights_confirmed) || hasLocalMedia,
    autoRender: body.auto_render !== false,
    waitingForMedia,
    ingestionCapability,
  };
}
