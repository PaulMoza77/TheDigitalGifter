import { classifyVideoUrl, sourceKindForProvider } from "./ingest/classify";
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
    }
  | { ok: false; code: string; message: string };

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

  if (requestedKind === "upload") {
    const objectPath = String(body.object_path || "");
    if (!objectPath.startsWith("uploads/")) {
      return { ok: false, code: "invalid_request", message: "Upload path is invalid." };
    }
    sourcePayload = { objectPath };
    sourceLabel = String(body.file_name || sourceLabel);
    provider = "upload";
  } else if (requestedKind === "library") {
    const libraryAssetId = String(body.library_asset_id || "");
    if (!libraryAssetId) {
      return { ok: false, code: "invalid_request", message: "Choose a video from the Library." };
    }
    sourcePayload = { libraryAssetId, libraryKind: body.library_kind || "catalog" };
    provider = "library";
  } else {
    const decision = classifyVideoUrl(String(body.url || ""));
    if (!decision.ok) {
      return { ok: false, code: decision.code, message: decision.message };
    }
    sourceKind = sourceKindForProvider(decision.provider);
    provider = decision.provider;
    sourcePayload = { url: decision.normalizedUrl, provider: decision.provider, importMode: decision.importMode };
    sourceLabel = sourceLabel === "Untitled video" ? new URL(decision.normalizedUrl).hostname : sourceLabel;
    if (!decision.canImport) {
      return {
        ok: false,
        code: "import_unavailable",
        message: decision.message || "Automatic import isn't available for this source. Upload the original video file instead.",
      };
    }
  }

  if (requiresRightsConfirmation(sourceKind)) {
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
    rightsConfirmed: Boolean(body.rights_confirmed) || !requiresRightsConfirmation(sourceKind),
    autoRender: body.auto_render !== false,
  };
}
