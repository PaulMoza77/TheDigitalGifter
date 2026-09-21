import { describe, expect, it, vi } from "vitest";
import { youtubeProviderChain, youtubeCanAttemptFileImport } from "../../../src/features/clip-factory/ingest/providerConfig";

describe("clip ingest provider config", () => {
  it("prefers an authorized HTTP importer when configured", () => {
    vi.stubEnv("CLIP_INGEST_PROVIDER", "auto");
    vi.stubEnv("CLIP_INGEST_FALLBACK_PROVIDER", "ytdlp");
    vi.stubEnv("CLIP_INGEST_ENDPOINT", "https://importer.example.com/youtube");
    vi.stubEnv("CLIP_FACTORY_DISABLE_YTDLP", "");
    expect(youtubeCanAttemptFileImport()).toBe(true);
    expect(youtubeProviderChain()).toEqual(["authorized_http", "ytdlp"]);
    vi.unstubAllEnvs();
  });

  it("skips yt-dlp when disabled and no authorized endpoint exists", () => {
    vi.stubEnv("CLIP_INGEST_ENDPOINT", "");
    vi.stubEnv("CLIP_FACTORY_YOUTUBE_IMPORT_URL", "");
    vi.stubEnv("CLIP_FACTORY_DISABLE_YTDLP", "1");
    expect(youtubeCanAttemptFileImport()).toBe(false);
    expect(youtubeProviderChain()).toEqual([]);
    vi.unstubAllEnvs();
  });
});
