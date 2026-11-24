import { STORY_OFFER } from "../catalog";
import {
  DEFAULT_COSTS,
  STORY_PRICE_CENTS,
  STORY_PRODUCT_KEY,
  type StoryGiftContent,
  type StoryGiftDraft,
  type StoryOrder,
} from "../types";
import { buildPreviewLyrics, activeMusicProvider } from "./musicProvider";
import { mockStoryProvider } from "./storyProvider";
import { activeVideoProvider, localImageHandler } from "./videoProvider";

function token(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function composePreviewContent(
  draft: StoryGiftDraft,
  opts?: { markAsExample?: boolean },
): Promise<StoryGiftContent> {
  const story = await mockStoryProvider.generate(draft);
  const lyrics = await buildPreviewLyrics(draft);
  const name = draft.recipientName.trim() || "Emma";
  const frames = [];
  for (const src of draft.photoDataUrls.slice(0, 8)) {
    const normalized = await localImageHandler.normalize(src);
    frames.push({ src: normalized, caption: name });
  }
  const film = await activeVideoProvider.render({
    orderId: draft.id,
    frames,
    title: `Memories for ${name}`,
  });
  const example = opts?.markAsExample !== false && !draft.photoDataUrls.length;

  return {
    ...story,
    fromName: "Someone who loves you",
    song: {
      id: `preview_song_${draft.id}`,
      title: `For ${name}`,
      audioUrl: null,
      coverLabel: name,
      lyrics,
      isExample: true,
      provider: "mock",
      status: "ready",
      commercialRightsNote: "Preview uses an example song demonstration — not a custom master.",
    },
    film: { ...film, isExample: example || film.isExample },
    surpriseLabel:
      draft.surpriseKind === "scratch"
        ? "Scratch to reveal"
        : "Open when you miss me",
    surpriseReveal:
      draft.surpriseMessage.trim() ||
      `Whenever you miss us, remember this: you are the story we are most grateful for, ${name}.`,
    finalMessage: story.finalMessage,
  };
}

export async function createMockPaidOrder(
  draft: StoryGiftDraft,
  fromName = "Alex",
): Promise<StoryOrder> {
  const now = new Date().toISOString();
  const content = await composePreviewContent(draft, { markAsExample: false });
  content.fromName = fromName;
  content.song.isExample = false;
  content.song.commercialRightsNote =
    "Mock production path — replace with authorized commercial master before LIVE send.";

  const musicJob = await activeMusicProvider.enqueue({
    orderId: draft.id,
    recipientFirstName: draft.recipientName.trim() || "Friend",
    genre: draft.songGenre,
    language: draft.language,
    lyricSummary: content.song.lyrics.map((l) => l.text).join(" / ").slice(0, 200),
  });
  void musicJob;

  const order: StoryOrder = {
    id: `ord_${crypto.randomUUID().slice(0, 10)}`,
    status: "REVIEW_REQUIRED",
    productKey: STORY_PRODUCT_KEY,
    priceCents: STORY_PRICE_CENTS,
    currency: "usd",
    draft,
    content,
    recipientToken: token(),
    pin: null,
    checkoutMode: STORY_OFFER.checkoutEnabled ? "test" : "disabled",
    costs: { ...DEFAULT_COSTS },
    createdAt: now,
    updatedAt: now,
    approvedAt: null,
    sentAt: null,
    openedAt: null,
  };
  return order;
}
