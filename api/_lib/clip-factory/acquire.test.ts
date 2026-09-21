import { describe, expect, it, vi } from "vitest";
import { acquireSourceMedia } from "./acquire";
import { IngestError } from "./ingest";

describe("acquireSourceMedia", () => {
  it("downloads authorized direct media URLs into a normalized asset", async () => {
    const downloadDirect = vi.spyOn(await import("./ingest"), "downloadDirectMedia").mockResolvedValue({
      contentType: "video/mp4",
      bytes: 2048,
    });
    const result = await acquireSourceMedia({
      sourceKind: "direct_media_url",
      sourcePayload: { url: "https://cdn.example.com/talk.mp4", mediaUrl: "https://cdn.example.com/talk.mp4" },
      sourceLabel: "Talk",
      dest: "/tmp/source.mp4",
      downloadStorage: async () => undefined,
      resolveLibraryFile: () => null,
      copyFile: async () => undefined,
    });
    expect(result.status).toBe("ingested");
    expect(result.sourceType).toBe("direct");
    expect(result.sourceUrl).toBe("https://cdn.example.com/talk.mp4");
    expect(result.mediaAsset.localPath).toBe("/tmp/source.mp4");
    expect(result.mediaAsset.bytes).toBe(2048);
    downloadDirect.mockRestore();
  });

  it("reports the official YouTube API limitation instead of pretending import works", async () => {
    vi.stubEnv("CLIP_FACTORY_YOUTUBE_IMPORT_URL", "");
    vi.stubEnv("CLIP_FACTORY_DISABLE_YTDLP", "1");
    await expect(
      acquireSourceMedia({
        sourceKind: "youtube",
        sourcePayload: { url: "https://youtu.be/pV9UPP7n0Po" },
        dest: "/tmp/source.mp4",
        downloadStorage: async () => undefined,
        resolveLibraryFile: () => null,
        copyFile: async () => undefined,
      }),
    ).rejects.toBeInstanceOf(IngestError);
    await expect(
      acquireSourceMedia({
        sourceKind: "youtube",
        sourcePayload: { url: "https://youtu.be/pV9UPP7n0Po" },
        dest: "/tmp/source.mp4",
        downloadStorage: async () => undefined,
        resolveLibraryFile: () => null,
        copyFile: async () => undefined,
      }),
    ).rejects.toMatchObject({
      code: "import_unavailable",
      message: expect.stringMatching(/couldn't import this source video|original MP4|YouTube Data API v3|disabled/i),
    });
    vi.unstubAllEnvs();
  });

  it("reuses a previously ingested YouTube original from private storage only when it looks real", async () => {
    vi.stubEnv("CLIP_FACTORY_YOUTUBE_IMPORT_URL", "");
    const downloadStorage = vi.fn(async () => undefined);
    const result = await acquireSourceMedia({
      sourceKind: "youtube",
      sourcePayload: { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
      dest: "/tmp/source.mp4",
      expectedDurationSeconds: 213,
      downloadStorage,
      resolveLibraryFile: () => null,
      copyFile: async () => undefined,
      findStoredMedia: async () => ({
        storagePath: "media/abc/source.mp4",
        title: "Owned original",
        durationSeconds: 213,
        fileSizeBytes: 18_000_000,
        mediaHash: "abc",
      }),
    });
    expect(result.status).toBe("ingested");
    expect(result.sourceType).toBe("youtube");
    expect(downloadStorage).toHaveBeenCalledWith("media/abc/source.mp4", "/tmp/source.mp4");
    vi.unstubAllEnvs();
  });

  it("does not reuse the poisoned 12.6s YouTube cache as a real import", async () => {
    vi.stubEnv("CLIP_FACTORY_YOUTUBE_IMPORT_URL", "");
    vi.stubEnv("CLIP_FACTORY_DISABLE_YTDLP", "1");
    const downloadStorage = vi.fn(async () => undefined);
    await expect(
      acquireSourceMedia({
        sourceKind: "youtube",
        sourcePayload: { url: "https://youtu.be/pV9UPP7n0Po" },
        dest: "/tmp/source.mp4",
        expectedDurationSeconds: 480,
        downloadStorage,
        resolveLibraryFile: () => null,
        copyFile: async () => undefined,
        findStoredMedia: async () => ({
          storagePath: "media/1035c4690f0871aab131142f8b39fb055b82eaea8fe38706519dcc377d0b2c33/source.mp4",
          durationSeconds: 12.6,
          fileSizeBytes: 174007,
          mediaHash: "1035c4690f0871aab131142f8b39fb055b82eaea8fe38706519dcc377d0b2c33",
        }),
      }),
    ).rejects.toMatchObject({ code: "import_unavailable" });
    expect(downloadStorage).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });
});
