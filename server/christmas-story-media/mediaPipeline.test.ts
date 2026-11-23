import { describe, expect, it } from "vitest";
import { join, resolve } from "node:path";
import { existsSync } from "node:fs";
import {
  MAX_PHOTOS,
  MIN_PHOTOS,
  detectImageKind,
  validatePhotoFile,
  resolveUnderRoot,
} from "./safePaths.ts";
import { assertSongTransition } from "./songProduction.ts";
import { LocalJobStore } from "./localJobStore.ts";
import { buildMediaCostModel } from "./costModel.ts";

const root = resolve(process.cwd());
const fixtures = join(root, "artifacts/christmas-story-02d/fixtures");

describe("Mission 02D media pipeline", () => {
  it("enforces photo limits and magic bytes", () => {
    expect(MIN_PHOTOS).toBe(2);
    expect(MAX_PHOTOS).toBe(8);
    expect(detectImageKind(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpeg");
    expect(detectImageKind(Buffer.from([0x00, 0x01]))).toBeNull();
    expect(() => resolveUnderRoot(root, "/etc/passwd")).toThrow(/path_escape/);
    if (existsSync(join(fixtures, "photo_landscape.jpg"))) {
      const info = validatePhotoFile(join(fixtures, "photo_landscape.jpg"));
      expect(info.kind).toBe("jpeg");
    }
  });

  it("song production transitions are constrained", () => {
    expect(() => assertSongTransition("awaiting_song_production", "approved")).toThrow(
      /invalid_song_transition/,
    );
    assertSongTransition("awaiting_song_production", "in_production");
    assertSongTransition("ready_for_buyer_review", "revision_requested");
  });

  it("local job store claim is exclusive until lease expires", () => {
    const dir = join(root, "artifacts/christmas-story-02d/vitest-queue");
    const store = new LocalJobStore(dir);
    const job = store.create({
      orderId: "o1",
      jobType: "film",
      provider: "ffmpeg",
      metadata: {},
    });
    const a = store.claim("wa", 60);
    expect(a?.id).toBe(job.id);
    expect(store.claim("wb", 60)).toBeNull();
  });

  it("cost model keeps currency estimates null without ops rates", () => {
    const model = buildMediaCostModel({
      mp4Path: "x",
      posterPath: "y",
      previewMp4Path: null,
      checksumSha256: "abc",
      durationSec: 15,
      width: 1280,
      height: 720,
      hasAudio: false,
      fileSizeBytes: 42000,
      renderMs: 3500,
      peakRssMb: 90,
    });
    expect(model.vpsComputeCentsEstimate).toBeNull();
    expect(model.measuredRenderMs).toBe(3500);
    expect(model.measuredPeakRssMb).toBe(90);
  });
});
