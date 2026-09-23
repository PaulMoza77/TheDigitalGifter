import type {
  PublisherAdapter,
  PublisherAdapterResult,
  PublisherDestination,
  PublishRequest,
} from "./types";

const SENSITIVE = /token|secret|signed|authorization|password|apikey|api_key|bearer/i;

function digest12(seed: string): string {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0") + String(seed.length).padStart(4, "0");
}

export function sanitizeAdapterLog(value: unknown): unknown {

  if (Array.isArray(value)) return value.map(sanitizeAdapterLog);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE.test(key) ? "[redacted]" : sanitizeAdapterLog(entry);
    }
    return out;
  }
  if (typeof value === "string" && /https?:\/\/\S*(token|sig|signature|X-Amz)=/i.test(value)) {
    return "[redacted-url]";
  }
  return value;
}

function fail(code: string, message: string, retryable = false): PublisherAdapterResult {
  return { ok: false, code, message, retryable, remotePostId: null, remoteUrl: null, dryRun: true };
}

function validateCommon(request: PublishRequest): PublisherAdapterResult | null {
  if (!request.libraryAssetId) return fail("media_missing", "No Library asset is attached.");
  if (!request.mediaUrl) return fail("media_missing", "Library media URL is missing.");
  if (!request.destination) return fail("destination_missing", "Destination is required.");
  return null;
}

export class DryRunPublisherAdapter implements PublisherAdapter {
  destination: PublisherDestination | "*" = "*";
  provider = "dry_run" as const;
  connectionStatus = "connected" as const;

  validate(request: PublishRequest): PublisherAdapterResult {
    const invalid = validateCommon(request);
    if (invalid) return invalid;
    if (request.forceFail || /\[dry-run:fail\]/i.test(request.caption || "")) {
      return fail("dry_run_forced_failure", "Dry-run simulated failure.", true);
    }
    return {
      ok: true,
      code: "dry_run_ok",
      message: "Dry-run validation passed. Nothing was sent externally.",
      retryable: false,
      remotePostId: null,
      remoteUrl: null,
      dryRun: true,
    };
  }

  async publish(request: PublishRequest): Promise<PublisherAdapterResult> {
    const validated = this.validate(request);
    if (!validated.ok) return validated;
    const seed = `${request.destination}:${request.libraryAssetId}:${request.scheduledAt}`;
    const digest = digest12(seed);
    const id = `dry-run-${digest}`;
    return {
      ok: true,
      code: "dry_run_published",
      message: "Dry-run completed. No external post was made.",
      retryable: false,
      remotePostId: id,
      remoteUrl: `https://dry-run.thedigitalgifter.local/posts/${id}`,
      dryRun: true,
    };
  }
}

export class NotConnectedPublisherAdapter implements PublisherAdapter {
  constructor(
    public provider: "meta" | "threads" | "youtube" | "tiktok",
    public destination: PublisherDestination | "*",
  ) {}
  connectionStatus = "not_connected" as const;

  validate(): PublisherAdapterResult {
    return fail("not_connected", `${this.provider} is not connected. V1 dry-run only.`, false);
  }

  async publish(): Promise<PublisherAdapterResult> {
    return this.validate();
  }
}

export function placeholderAdapters(): PublisherAdapter[] {
  return [
    new NotConnectedPublisherAdapter("meta", "instagram_reel_post"),
    new NotConnectedPublisherAdapter("meta", "instagram_story"),
    new NotConnectedPublisherAdapter("meta", "facebook_reel_post"),
    new NotConnectedPublisherAdapter("meta", "facebook_story"),
    new NotConnectedPublisherAdapter("threads", "threads"),
    new NotConnectedPublisherAdapter("youtube", "youtube_short"),
    new NotConnectedPublisherAdapter("tiktok", "tiktok"),
  ];
}

export function adapterRegistry(): {
  dryRun: DryRunPublisherAdapter;
  placeholders: PublisherAdapter[];
} {
  return { dryRun: new DryRunPublisherAdapter(), placeholders: placeholderAdapters() };
}

export function newAttemptId(): string {
  return globalThis.crypto?.randomUUID?.() || `att-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
