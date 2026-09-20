export const INGESTION_CAPABILITIES = [
  "FULL_IMPORT",
  "AUTHORIZED_IMPORT_REQUIRED",
  "REFERENCE_ONLY",
  "UNSUPPORTED",
] as const;

export type IngestionCapability = (typeof INGESTION_CAPABILITIES)[number];

export function isFullImport(capability: string | null | undefined): boolean {
  return capability === "FULL_IMPORT";
}

export function capabilityMessage(capability: IngestionCapability, provider: string): string {
  if (capability === "FULL_IMPORT") {
    return "Authorized media is available. Find Viral Moments will ingest, transcribe, analyze, and clip automatically.";
  }
  if (capability === "AUTHORIZED_IMPORT_REQUIRED") {
    return provider === "youtube"
      ? "YouTube metadata is available. Automatic media import requires an authorized YouTube importer. Attach original media to continue."
      : "This source was recognized, but automatic media import needs an authorized connection. Attach original media to continue.";
  }
  if (capability === "REFERENCE_ONLY") {
    return provider === "youtube"
      ? "YouTube Data API / oEmbed detected this video, but YouTube does not provide an official downloadable media file. Automatic ingest needs CLIP_FACTORY_YOUTUBE_IMPORT_URL or the original file."
      : "This source can be referenced, but its media cannot be imported automatically. Attach original media to continue.";
  }
  return "This URL is not a supported automatic import source.";
}
