import type { MusicJobRecord, SongAsset } from "../types";
import type { LyricProvider, MusicProvider } from "./providers";
import type { StoryGiftDraft } from "../types";

export const mockLyricProvider: LyricProvider = {
  id: "mock-lyrics-v1",
  async generate(draft) {
    const name = draft.recipientName.trim() || "you";
    const special = draft.whatMakesThemSpecial.trim() || "the way you light up ordinary days";
    return [
      { timeMs: 0, text: `${name}, this night belongs to you` },
      { timeMs: 4000, text: `For every quiet kindness, every truth` },
      { timeMs: 8000, text: special.slice(0, 72) },
      { timeMs: 12000, text: `I wrote this song so you would know` },
      { timeMs: 16000, text: `How deeply you are loved when winter falls like snow` },
    ];
  },
};

const jobs = new Map<string, MusicJobRecord>();
const songs = new Map<string, SongAsset>();

/** Mock music — no external API calls, no unpaid generations. */
export const mockMusicProvider: MusicProvider = {
  id: "mock-music-v1",
  async enqueue({ orderId, recipientFirstName, genre }) {
    const id = `music_${crypto.randomUUID().slice(0, 8)}`;
    const job: MusicJobRecord = {
      id,
      orderId,
      provider: "mock",
      sourceJobId: null,
      status: "ready",
      songVersion: 1,
      approvedDownload: false,
      commercialRights: "Mock only — not licensed for commercial resale.",
      attempts: 1,
      costCents: 0,
      buyerApproved: false,
    };
    jobs.set(id, job);
    songs.set(id, {
      id: `song_${id}`,
      title: `For ${recipientFirstName}`,
      audioUrl: null,
      coverLabel: recipientFirstName,
      lyrics: [],
      isExample: true,
      provider: "mock",
      status: "ready",
      commercialRightsNote: job.commercialRights,
    });
    return job;
  },
  async getSong(job) {
    return songs.get(job.id) ?? null;
  },
};

/**
 * Manual admin-assisted production.
 * Ops attaches an authorized download after contractual generation.
 * Does not call Suno or any unofficial scraper.
 */
export const manualMusicProvider: MusicProvider = {
  id: "manual-music-v1",
  async enqueue({ orderId, recipientFirstName }) {
    const id = `music_manual_${crypto.randomUUID().slice(0, 8)}`;
    const job: MusicJobRecord = {
      id,
      orderId,
      provider: "manual",
      sourceJobId: null,
      status: "awaiting_manual",
      songVersion: 1,
      approvedDownload: false,
      commercialRights: "Pending authorized commercial download confirmation.",
      attempts: 0,
      costCents: null,
      buyerApproved: false,
    };
    jobs.set(id, job);
    songs.set(id, {
      id: `song_${id}`,
      title: `For ${recipientFirstName}`,
      audioUrl: null,
      coverLabel: recipientFirstName,
      lyrics: [],
      isExample: false,
      provider: "manual",
      status: "pending",
      commercialRightsNote: job.commercialRights,
    });
    return job;
  },
  async getSong(job) {
    return songs.get(job.id) ?? null;
  },
  async attachManual(jobId, asset) {
    const existing = songs.get(jobId);
    if (!existing) throw new Error("Music job not found");
    const next: SongAsset = {
      ...existing,
      ...asset,
      provider: "manual",
      status: "ready",
      isExample: false,
    };
    songs.set(jobId, next);
    const job = jobs.get(jobId);
    if (job) {
      job.status = "ready";
      job.approvedDownload = Boolean(asset.audioUrl);
      jobs.set(jobId, job);
    }
    return next;
  },
};

/** Active provider for MVP — mock until enterprise music is authorized. */
export const activeMusicProvider: MusicProvider = mockMusicProvider;

export function buildPreviewLyrics(draft: StoryGiftDraft) {
  return mockLyricProvider.generate(draft);
}
