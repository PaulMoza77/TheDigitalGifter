import type { YouTubePublishDraft } from "./types";

/**
 * Future YouTube publishing seam. V1 only prepares a draft from stored production
 * metadata. It does not upload, schedule, or claim monetization.
 */
export type LongFormYouTubeTarget = {
  productionId: string;
  chosenTitle: string;
  description: string;
  tags?: string[];
  thumbnailPath?: string;
};

export function prepareYouTubeDraft(target: LongFormYouTubeTarget): YouTubePublishDraft {
  return {
    productionId: target.productionId,
    title: target.chosenTitle,
    description: target.description,
    tags: target.tags || ["christmas", "ambience", "relaxing"],
    thumbnailPath: target.thumbnailPath,
    privacyStatus: "private",
    scheduleAt: null,
  };
}

export interface YouTubeLongFormPublisher {
  prepareDraft(target: LongFormYouTubeTarget): YouTubePublishDraft;
  publish?(draft: YouTubePublishDraft): Promise<{ videoId: string }>;
  schedule?(draft: YouTubePublishDraft, whenIso: string): Promise<{ videoId: string }>;
  uploadThumbnail?(videoId: string, thumbnailPath: string): Promise<void>;
}

export const youtubeLongFormPublisher: YouTubeLongFormPublisher = {
  prepareDraft: prepareYouTubeDraft,
};
