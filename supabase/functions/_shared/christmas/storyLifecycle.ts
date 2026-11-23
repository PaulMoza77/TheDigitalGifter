/** Server-side Christmas Story order status transitions (Mission 02B). */

export const STORY_STATUSES = [
  "DRAFT",
  "CHECKOUT_PENDING",
  "PAID",
  "CONTENT_PENDING",
  "GENERATING",
  "REVIEW_REQUIRED",
  "APPROVED",
  "READY_TO_SEND",
  "SENT",
  "OPENED",
  "FAILED",
  "CANCELLED",
  "RETRY",
] as const;

export type StoryStatus = (typeof STORY_STATUSES)[number];

const ALLOWED: Record<StoryStatus, StoryStatus[]> = {
  DRAFT: ["CHECKOUT_PENDING", "CANCELLED"],
  CHECKOUT_PENDING: ["PAID", "FAILED", "CANCELLED", "DRAFT"],
  PAID: ["CONTENT_PENDING", "GENERATING", "FAILED"],
  CONTENT_PENDING: ["GENERATING", "FAILED", "CANCELLED"],
  GENERATING: ["REVIEW_REQUIRED", "FAILED", "RETRY"],
  RETRY: ["GENERATING", "FAILED", "CANCELLED"],
  REVIEW_REQUIRED: ["APPROVED", "GENERATING", "FAILED", "CANCELLED"],
  APPROVED: ["READY_TO_SEND", "CANCELLED"],
  READY_TO_SEND: ["SENT", "CANCELLED"],
  SENT: ["OPENED"],
  OPENED: [],
  FAILED: ["RETRY", "CANCELLED", "CHECKOUT_PENDING"],
  CANCELLED: [],
};

export function assertStoryTransition(from: string, to: string): boolean {
  if (from === to) return true;
  const allowed = ALLOWED[from as StoryStatus];
  if (!allowed) return false;
  return allowed.includes(to as StoryStatus);
}

/** Recipient OPENED is only valid after SENT — never from buyer preview. */
export function canMarkRecipientOpened(status: string): boolean {
  return assertStoryTransition(status, "OPENED");
}

export const STORY_PRODUCT_KEY = "our_christmas_story";
export const STORY_PRICE_CENTS = 5700;
export const STORY_CURRENCY = "usd";
