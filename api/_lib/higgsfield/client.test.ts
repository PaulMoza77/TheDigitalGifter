import { describe, expect, it } from "vitest";
import { ffmpegConcatArgs } from "./storage";
import { createMockHiggsfieldTransport, higgsfieldAuthHeader, readHiggsfieldCredentials } from "./client";

describe("Higgsfield server helpers", () => {
  it("builds Authorization Key header without logging secrets", () => {
    const creds = readHiggsfieldCredentials({
      HF_CREDENTIALS: "11111111-1111-4111-8111-111111111111:abc",
    } as NodeJS.ProcessEnv);
    expect(higgsfieldAuthHeader(creds).startsWith("Key ")).toBe(true);
    expect(creds.keyId).toContain("11111111");
  });

  it("mock transport never needs a live paid API", async () => {
    const t = createMockHiggsfieldTransport({ estimateUsd: 0.2 });
    const estimate = await t.estimate("/estimate/x", {});
    expect(estimate?.usd).toBe(0.2);
    const submitted = await t.submit("/kling-video/v3.0/pro/image-to-video", {});
    expect(submitted.request_id).toBeTruthy();
    const status = await t.status(submitted.request_id);
    expect(status.status).toBe("completed");
  });

  it("refuses to treat a non-MP4 buffer as a verified import", async () => {
    const { probeMp4 } = await import("./storage");
    await expect(probeMp4(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]))).rejects.toThrow(/not a readable MP4/);
  });

  it("keeps Reel montage as ffmpeg concat without audio", () => {
    const args = ffmpegConcatArgs("/tmp/list.txt", "/tmp/out.mp4");
    expect(args).toContain("concat");
    expect(args).toContain("-an");
    expect(args).toContain("libx264");
  });
});
