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
    return "Authorized media is available. Generate Clips will ingest, transcribe, analyze, and clip automatically.";
  }
  if (capability === "AUTHORIZED_IMPORT_REQUIRED") {
    return provider === "youtube"
      ? "YouTube metadata is available. Automatic media import requires an authorized YouTube importer. Attach original media to continue."
      : "This source was recognized, but automatic media import needs an authorized connection. Attach original media to continue.";
  }
  if (capability === "REFERENCE_ONLY") {
    return provider === "youtube"
      ? "We recognized this YouTube link. If automatic import is blocked we will stop without creating clips."
      : "This source can be referenced, but its media cannot be imported automatically.";
  }
  return "This URL is not a supported automatic import source.";
}
