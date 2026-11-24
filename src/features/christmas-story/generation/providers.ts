import type {
  FilmAsset,
  MusicJobRecord,
  SongAsset,
  StoryGiftContent,
  StoryGiftDraft,
} from "../types";

export interface StoryProvider {
  readonly id: string;
  generate(draft: StoryGiftDraft): Promise<Pick<StoryGiftContent, "storyParagraphs" | "dedication" | "welcomeTitle" | "finalMessage">>;
}

export interface LyricProvider {
  readonly id: string;
  generate(draft: StoryGiftDraft): Promise<SongAsset["lyrics"]>;
}

export interface MusicProvider {
  readonly id: string;
  /** Never send photos or unnecessary PII to the music provider. */
  enqueue(input: {
    orderId: string;
    recipientFirstName: string;
    genre: string;
    language: string;
    lyricSummary: string;
  }): Promise<MusicJobRecord>;
  getSong(job: MusicJobRecord): Promise<SongAsset | null>;
  /** Admin-assisted path: attach an authorized download. */
  attachManual?(jobId: string, asset: Partial<SongAsset>): Promise<SongAsset>;
}

export interface ImageHandler {
  readonly id: string;
  normalize(dataUrl: string, maxEdge?: number): Promise<string>;
}

export interface VideoProvider {
  readonly id: string;
  render(input: {
    orderId: string;
    frames: { src: string; caption: string }[];
    title: string;
  }): Promise<FilmAsset>;
}

export interface PrintProvider {
  readonly id: string;
  /** Returns a printable HTML document string (PDF export later). */
  giftCardHtml(input: {
    recipientName: string;
    fromName: string;
    giftUrl: string;
    dedication: string;
  }): Promise<string>;
}
