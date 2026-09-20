import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildAssCaptions } from "../../../src/features/clip-factory/captions";
import { extractThumbnail, ffprobeFile, renderVerticalClip, runCommand } from "./ffmpeg";

describe("clip factory ffmpeg render", () => {
  it("renders a 9:16 captioned mp4 with audio from a landscape source", async () => {
    const dir = await mkdtemp(join(tmpdir(), "tdg-cf-"));
    const source = join(dir, "src.mp4");
    const ass = join(dir, "c.ass");
    const out = join(dir, "out.mp4");
    const thumb = join(dir, "t.jpg");
    try {
      await runCommand(
        "ffmpeg",
        [
          "-y",
          "-f",
          "lavfi",
          "-i",
          "color=c=0x1b3a4b:s=1280x720:d=6:r=30",
          "-f",
          "lavfi",
          "-i",
          "sine=frequency=440:duration=6",
          "-shortest",
          "-c:v",
          "libx264",
          "-pix_fmt",
          "yuv420p",
          "-c:a",
          "aac",
          source,
        ],
        60_000,
      );
      await writeFile(
        ass,
        buildAssCaptions({
          transcript: {
            language: "en",
            fullText: "Christmas morning did not go as planned.",
            words: [
              { word: "Christmas", start: 0.2, end: 0.7 },
              { word: "morning", start: 0.7, end: 1.2 },
              { word: "changed.", start: 1.2, end: 2.0 },
            ],
            segments: [],
          },
          start: 0,
          end: 5,
          style: "clean",
          hook: "Watch this.",
          hookEnabled: true,
        }),
        "utf8",
      );
      await renderVerticalClip({
        source,
        output: out,
        start: 0.2,
        duration: 4.5,
        filter: "scale=iw*sar:ih,setsar=1,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,format=yuv420p",
        assPath: ass,
        hasAudio: true,
      });
      await extractThumbnail(out, 0.4, thumb);
      const probe = await ffprobeFile(out);
      expect(probe.width).toBe(1080);
      expect(probe.height).toBe(1920);
      expect(probe.hasAudio).toBe(true);
      expect(probe.duration).toBeGreaterThan(3);
      expect(probe.videoCodec).toBe("h264");
      expect(probe.audioCodec).toMatch(/aac/i);
      const bytes = await readFile(out);
      expect(bytes.length).toBeGreaterThan(20_000);
      const thumbBytes = await readFile(thumb);
      expect(thumbBytes[0]).toBe(0xff);
      expect(thumbBytes[1]).toBe(0xd8);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }, 90_000);
});
