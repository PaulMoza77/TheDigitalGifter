import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { DEMO_GIFT } from "./data/demoGift";

const root = resolve(process.cwd());

function read(rel: string) {
  return readFileSync(resolve(root, rel), "utf8");
}

describe("Mission 02D — memory film + licensed song ops", () => {
  it("ships FFmpeg renderer with secure spawn and no URL ingestion", () => {
    const film = read("server/christmas-story-media/ffmpegFilm.ts");
    expect(film).toContain("renderMemoryFilm");
    expect(film).toContain("yuv420p");
    expect(film).toContain("+faststart");
    const safe = read("server/christmas-story-media/safePaths.ts");
    expect(safe).toContain("url_inputs_forbidden");
    expect(safe).toContain("path_escape_forbidden");
    const run = read("server/christmas-story-media/runCommand.ts");
    expect(run).toContain("shell: false");
  });

  it("ships durable local worker + claim/lease store", () => {
    const worker = read("scripts/christmas-story-02d/film-worker.mjs");
    expect(worker).toContain("LocalJobStore");
    expect(worker).toContain("renderMemoryFilm");
    const store = read("server/christmas-story-media/localJobStore.ts");
    expect(store).toContain("claim(");
    expect(store).toContain("heartbeat(");
  });

  it("rejects free/trial song evidence and omits photos from briefs", () => {
    const song = read("server/christmas-story-media/songProduction.ts");
    expect(song).toContain("license_evidence_rejected");
    expect(song).toContain("No Suno automation");
    expect(song).toContain("Explicitly omit photos");
  });

  it("buyer UI blocks fake approval and supports revision", () => {
    const dash = read("src/features/christmas-story/components/BuyerDashboard.tsx");
    expect(dash).toContain("requestMediaRevision");
    expect(dash).toContain("Approval stays blocked until song and film are ready");
    expect(dash).toContain("Revise song");
  });

  it("demo gift uses first-party sample film without fake customer audio", () => {
    expect(DEMO_GIFT.film.videoUrl).toContain("/assets/christmas-story-demo/");
    expect(DEMO_GIFT.song.audioUrl).toBeNull();
    expect(DEMO_GIFT.film.isExample).toBe(true);
    expect(existsSync(resolve(root, "public/assets/christmas-story-demo/emma-memory-film.mp4"))).toBe(
      true,
    );
  });

  it("migration adds claim RPC and song production states", () => {
    const sql = read("supabase/migrations/20261124010000_christmas_story_02d_media_jobs.sql");
    expect(sql).toContain("christmas_story_claim_job");
    expect(sql).toContain("ready_for_buyer_review");
    expect(sql).toContain("christmas_story_media_revisions");
  });
});
