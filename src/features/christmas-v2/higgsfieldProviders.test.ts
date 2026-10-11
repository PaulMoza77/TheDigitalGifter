import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  extractVideoUrl,
  kling3ProVideoRequest,
  pollHiggsfieldRequest,
  soulV2ImageRequest,
  submitKling3ProVideo,
  submitSoulV2Image,
} from "../../../api/_lib/christmas/higgsfieldProviders";
import {
  assertSafeProviderMediaUrl,
  looksLikeMp4,
  sniffImageMime,
} from "../../../api/_lib/christmas/providerMedia";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function readSrc(relative: string) {
  return readFileSync(resolve(root, relative), "utf8");
}

describe("christmas-v2 higgsfield official contracts", () => {
  it("builds Soul v2 image-to-image request with official model id and params", () => {
    const request = soulV2ImageRequest({
      prompt: "Christmas portrait",
      imageUrl: "https://example.com/source.jpg",
      aspectRatio: "3:4",
    });
    expect(request.model).toBe("higgsfield-ai/soul/v2/image-to-image");
    expect(request.path).toBe("/higgsfield-ai/soul/v2/image-to-image");
    expect(request.body).toMatchObject({
      prompt: "Christmas portrait",
      image_url: "https://example.com/source.jpg",
      aspect_ratio: "3:4",
      resolution: "1080p",
      batch_size: 1,
      enhance_prompt: true,
    });
  });

  it("builds Kling 3 Pro image-to-video with duration 5 and sound off", () => {
    const request = kling3ProVideoRequest({
      prompt: "Gentle Christmas motion",
      imageUrl: "https://example.com/scene.jpg",
      duration: 5,
    });
    expect(request.model).toBe("kling-video/v3.0/pro/image-to-video");
    expect(request.path).toBe("/kling-video/v3.0/pro/image-to-video");
    expect(request.body).toMatchObject({
      image_url: "https://example.com/scene.jpg",
      prompt: "Gentle Christmas motion",
      duration: 5,
      sound: "off",
      multi_shots: false,
    });
  });

  it("submits Soul and prefers status_url from the provider response", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          request_id: "req-soul-1",
          status: "queued",
          status_url: "https://api.higgsfield.ai/requests/req-soul-1/status",
        }),
        { status: 200 },
      ),
    );
    const submitted = await submitSoulV2Image({
      authorization: "Key id:secret",
      prompt: "Portrait",
      imageUrl: "https://signed.example/source.jpg",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(submitted.requestId).toBe("req-soul-1");
    expect(submitted.statusUrl).toBe("https://api.higgsfield.ai/requests/req-soul-1/status");
    expect(String(fetchImpl.mock.calls[0]?.[0])).toContain(
      "/higgsfield-ai/soul/v2/image-to-image",
    );
  });

  it("polls until completed and extracts images[].url / video.url", async () => {
    vi.useFakeTimers();
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls += 1;
      if (calls === 1) {
        return new Response(JSON.stringify({ status: "in_progress", request_id: "r1" }), {
          status: 200,
        });
      }
      return new Response(
        JSON.stringify({
          status: "completed",
          request_id: "r1",
          images: [{ url: "https://cdn.example.com/out.jpg" }],
          video: { url: "https://cdn.example.com/out.mp4" },
        }),
        { status: 200 },
      );
    });
    const pending = pollHiggsfieldRequest("Key id:secret", "r1", {
      maxAttempts: 5,
      initialSleepMs: 1,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await vi.runAllTimersAsync();
    const polled = await pending;
    expect(polled.done).toBe(true);
    expect(polled.failed).toBe(false);
    expect(polled.body?.images).toBeTruthy();
    expect(extractVideoUrl(polled.body!)).toBe("https://cdn.example.com/out.mp4");
    vi.useRealTimers();
  });

  it("retries submit on 429 with bounded attempts then surfaces error", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ detail: "rate limited" }), { status: 429 }),
    );
    const pending = submitKling3ProVideo({
      authorization: "Key id:secret",
      prompt: "motion",
      imageUrl: "https://signed.example/scene.jpg",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const expectation = expect(pending).rejects.toThrow(/rate limited|429/i);
    await vi.runAllTimersAsync();
    await expectation;
    expect(fetchImpl.mock.calls.length).toBeGreaterThan(1);
    vi.useRealTimers();
  });

  it("workers persist request_id before polling and resume instead of re-submit", () => {
    const nodeImage = readSrc("api/christmas-generate.ts");
    const nodeVideo = readSrc("api/christmas-generate-video.ts");
    const edgeImage = readSrc("supabase/functions/christmas-generate/index.ts");
    const edgeVideo = readSrc("supabase/functions/christmas-generate-video/index.ts");
    for (const src of [nodeImage, edgeImage]) {
      expect(src).toContain("submitSoulV2Image");
      expect(src).toContain("pollHiggsfieldRequest");
      expect(src).toContain("Persist BEFORE polling");
      expect(src).toContain("uncertain_provider_outcome");
      expect(src).toContain("provider_terminal:");
      expect(src).toContain("fetchProviderMediaBytes");
    }
    for (const src of [nodeVideo, edgeVideo]) {
      expect(src).toContain("submitKling3ProVideo");
      expect(src).toContain("pollHiggsfieldRequest");
      expect(src).toContain("uncertain_provider_outcome");
      expect(src).toContain("source_scene_key");
      expect(src).toContain("fetchProviderMediaBytes");
      // Must not blindly re-submit failed rows that already have a request id.
      expect(src).toContain("never second paid submit");
    }
  });
});

describe("christmas-v2 provider media safety", () => {
  it("blocks SSRF targets and non-https URLs", () => {
    expect(assertSafeProviderMediaUrl("http://cdn.example.com/a.jpg").ok).toBe(false);
    expect(assertSafeProviderMediaUrl("https://127.0.0.1/a.jpg").ok).toBe(false);
    expect(assertSafeProviderMediaUrl("https://169.254.169.254/latest").ok).toBe(false);
    expect(assertSafeProviderMediaUrl("https://cdn.example.com/a.jpg").ok).toBe(true);
  });

  it("validates JPEG/PNG/WebP magic and MP4 ftyp structurally", () => {
    expect(sniffImageMime(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(
      sniffImageMime(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    ).toBe("image/png");
    expect(sniffImageMime(Uint8Array.from([0x00, 0x01, 0x02]))).toBeNull();
    const mp4 = new Uint8Array(32);
    mp4[4] = 0x66;
    mp4[5] = 0x74;
    mp4[6] = 0x79;
    mp4[7] = 0x70;
    expect(looksLikeMp4(mp4)).toBe(true);
    expect(looksLikeMp4(Uint8Array.from([0x00, 0x01, 0x02, 0x03]))).toBe(false);
  });
});
