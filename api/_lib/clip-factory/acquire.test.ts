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
      message: expect.stringMatching(/YouTube Data API v3/i),
    });
    vi.unstubAllEnvs();
  });

  it("reuses a previously ingested YouTube original from private storage", async () => {
    vi.stubEnv("CLIP_FACTORY_YOUTUBE_IMPORT_URL", "");
    const downloadStorage = vi.fn(async () => undefined);
    const result = await acquireSourceMedia({
      sourceKind: "youtube",
      sourcePayload: { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
      dest: "/tmp/source.mp4",
      downloadStorage,
      resolveLibraryFile: () => null,
      copyFile: async () => undefined,
      findStoredMedia: async () => ({ storagePath: "media/abc/source.mp4", title: "Owned original" }),
    });
    expect(result.status).toBe("ingested");
    expect(result.sourceType).toBe("youtube");
    expect(downloadStorage).toHaveBeenCalledWith("media/abc/source.mp4", "/tmp/source.mp4");
    vi.unstubAllEnvs();
  });
});
