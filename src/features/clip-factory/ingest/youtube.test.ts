import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchYoutubeMetadata, youtubeAdapter } from "./adapters/youtube";
import { IngestFailure } from "./types";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("youtube adapter", () => {
  it("detects and normalizes supported hosts", () => {
    expect(youtubeAdapter.detect("https://www.youtube.com/watch?v=dQw4w9wgGcI")).toBe(true);
    expect(youtubeAdapter.detect("https://youtu.be/dQw4w9wgGcI")).toBe(true);
    expect(youtubeAdapter.detect("https://www.youtube.com/shorts/dQw4w9wgGcI")).toBe(true);
    expect(youtubeAdapter.validate("https://youtu.be/dQw4w9wgGcI")).toEqual({
      ok: true,
      url: "https://www.youtube.com/watch?v=dQw4w9wgGcI",
    });
  });

  it("maps private and missing videos to specific errors", async () => {
    vi.stubEnv("YOUTUBE_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ items: [{ status: { privacyStatus: "private", uploadStatus: "processed" } }] }),
      })),
    );
    await expect(fetchYoutubeMetadata("dQw4w9wgGcI")).rejects.toMatchObject({ code: "video_private" });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ items: [] }),
      })),
    );
    await expect(fetchYoutubeMetadata("dQw4w9wgGcI")).rejects.toBeInstanceOf(IngestFailure);
    await expect(fetchYoutubeMetadata("dQw4w9wgGcI")).rejects.toMatchObject({ code: "video_unavailable" });
  });

  it("still previews a valid id when oEmbed is unavailable", async () => {
    vi.stubEnv("CLIP_FACTORY_YOUTUBE_IMPORT_URL", "");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 404,
        json: async () => ({}),
      })),
    );
    const meta = await fetchYoutubeMetadata("dQw4w9wgGcI");
    expect(meta.provider).toBe("youtube");
    expect(meta.canImport).toBe(false);
    expect(meta.ingestionCapability).toBe("REFERENCE_ONLY");
    expect(meta.thumbnailUrl).toContain("dQw4w9wgGcI");
    expect(meta.message).toMatch(/title and thumbnail|official APIs do not give us the video file/i);
  });

  it("does not claim import unless an authorized importer is configured", async () => {
    vi.stubEnv("YOUTUBE_API_KEY", "test-key");
    vi.stubEnv("CLIP_FACTORY_YOUTUBE_IMPORT_URL", "");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          items: [
            {
              snippet: { title: "Demo", channelTitle: "TDG", thumbnails: { high: { url: "https://i.ytimg.com/vi/dQw4w9wgGcI/hqdefault.jpg" } } },
              contentDetails: { duration: "PT3M3S" },
              status: { privacyStatus: "public", embeddable: true, uploadStatus: "processed" },
            },
          ],
        }),
      })),
    );
    const meta = await fetchYoutubeMetadata("dQw4w9wgGcI");
    expect(meta.title).toBe("Demo");
    expect(meta.canImport).toBe(false);
    expect(meta.ingestionCapability).toBe("REFERENCE_ONLY");
    expect(meta.message).toMatch(/title and thumbnail|official APIs do not give us the video file/i);
    expect(youtubeAdapter.canImport(meta)).toBe(false);
  });

  it("parses watch-page duration when Data API is missing", async () => {
    const { parseYoutubeDurationFromHtml } = await import("./adapters/youtube");
    expect(parseYoutubeDurationFromHtml('x"lengthSeconds":"937"y')).toBe(937);
  });
});
