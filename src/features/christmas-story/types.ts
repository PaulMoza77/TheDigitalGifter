/** Our Christmas Story — domain types (occasion-agnostic gift core). */

export const STORY_PRODUCT_KEY = "our_christmas_story" as const;
export const STORY_PRICE_CENTS = 5700;
export const STORY_CURRENCY = "usd" as const;

export type GiftOccasion = "christmas" | "birthday" | "anniversary" | "valentine" | "other";

export type OrderStatus =
  | "DRAFT"
  | "CHECKOUT_PENDING"
  | "PAID"
  | "CONTENT_PENDING"
  | "GENERATING"
  | "REVIEW_REQUIRED"
  | "APPROVED"
  | "READY_TO_SEND"
  | "SENT"
  | "OPENED"
  | "FAILED"
  | "CANCELLED";

export type RelationshipKind =
  | "partner"
  | "spouse"
  | "parent"
  | "child"
  | "sibling"
  | "friend"
  | "family"
  | "other";

export type CopyVariant = "emotion_story" | "personalized_song";

export type StoryGiftDraft = {
  id: string;
  occasion: GiftOccasion;
  copyVariant: CopyVariant;
  relationship: RelationshipKind | "";
  recipientName: string;
  whatMakesThemSpecial: string;
  memories: string[];
  places: string[];
  tone: string;
  hobbies: string[];
  songGenre: string;
  language: string;
  dedication: string;
  photoDataUrls: string[];
  surpriseKind: "scratch" | "open_when";
  surpriseMessage: string;
  buyerEmail: string;
  scheduleAt: string | null;
  scheduleTz: string;
  digitalConsent: boolean;
  updatedAt: string;
};

export type LyricLine = { timeMs: number; text: string };

export type SongAsset = {
  id: string;
  title: string;
  /** Real audio URL only. Null means lyrics/status copy — never a synthesized tone. */
  audioUrl: string | null;
  coverLabel: string;
  lyrics: LyricLine[];
  isExample: boolean;
  provider: "mock" | "manual" | "authorized_api";
  status: "pending" | "ready" | "failed";
  commercialRightsNote: string;
};

export type FilmAsset = {
  id: string;
  title: string;
  /** Poster / frame URLs (data URLs or public demo paths). */
  frames: { src: string; caption: string }[];
  videoUrl: string | null;
  isExample: boolean;
  status: "pending" | "ready" | "failed";
};

export type StoryGiftContent = {
  welcomeTitle: string;
  fromName: string;
  dedication: string;
  storyParagraphs: string[];
  song: SongAsset;
  film: FilmAsset;
  surpriseLabel: string;
  surpriseReveal: string;
  finalMessage: string;
};

export type StoryOrder = {
  id: string;
  status: OrderStatus;
  productKey: typeof STORY_PRODUCT_KEY;
  priceCents: number;
  currency: typeof STORY_CURRENCY;
  draft: StoryGiftDraft;
  content: StoryGiftContent | null;
  recipientToken: string;
  pin: string | null;
  checkoutMode: "disabled" | "test" | "live";
  costs: OrderCostBreakdown;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
  sentAt: string | null;
  openedAt: string | null;
};

export type OrderCostBreakdown = {
  paymentProcessingCents: number;
  aiTextCents: number;
  songCents: number;
  videoCents: number;
  storageCents: number;
  retriesCents: number;
  supportCents: number;
};

export type MusicJobRecord = {
  id: string;
  orderId: string;
  provider: SongAsset["provider"];
  sourceJobId: string | null;
  status: "queued" | "generating" | "awaiting_manual" | "ready" | "failed";
  songVersion: number;
  approvedDownload: boolean;
  commercialRights: string;
  attempts: number;
  costCents: number | null;
  buyerApproved: boolean;
};

export const DEFAULT_COSTS: OrderCostBreakdown = {
  paymentProcessingCents: 0,
  aiTextCents: 0,
  songCents: 0,
  videoCents: 0,
  storageCents: 0,
  retriesCents: 0,
  supportCents: 0,
};

export function createEmptyDraft(partial?: Partial<StoryGiftDraft>): StoryGiftDraft {
  const now = new Date().toISOString();
  return {
    id: partial?.id ?? `draft_${crypto.randomUUID().slice(0, 10)}`,
    occasion: "christmas",
    copyVariant: "emotion_story",
    relationship: "",
    recipientName: "",
    whatMakesThemSpecial: "",
    memories: [],
    places: [],
    tone: "warm",
    hobbies: [],
    songGenre: "soft acoustic",
    language: "en",
    dedication: "",
    photoDataUrls: [],
    surpriseKind: "open_when",
    surpriseMessage: "",
    buyerEmail: "",
    scheduleAt: null,
    scheduleTz: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    digitalConsent: false,
    updatedAt: now,
    ...partial,
  };
}
