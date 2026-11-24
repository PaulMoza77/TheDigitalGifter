import { describe, expect, it } from "vitest";
import { STORY_OFFER } from "./catalog";
import { STORY_FUNNEL_EVENTS, trackStoryEvent } from "./analytics";
import { composePreviewContent, createMockPaidOrder } from "./generation/compose";
import { mockStoryProvider } from "./generation/storyProvider";
import { mockMusicProvider, manualMusicProvider } from "./generation/musicProvider";
import { createEmptyDraft, STORY_PRICE_CENTS, STORY_PRODUCT_KEY } from "./types";
import { DEMO_GIFT, DEMO_RECIPIENT_TOKEN } from "./data/demoGift";

describe("Our Christmas Story MVP", () => {
  it("prices the primary offer at $57 with checkout kill-switched", () => {
    expect(STORY_OFFER.productKey).toBe(STORY_PRODUCT_KEY);
    expect(STORY_OFFER.priceCents).toBe(STORY_PRICE_CENTS);
    expect(STORY_OFFER.displayPrice).toBe("$57");
    expect(STORY_OFFER.checkoutEnabled).toBe(false);
    expect(STORY_OFFER.addOns.extraSong.enabled).toBe(false);
  });

  it("exposes privacy-conscious funnel events without inventing purchases", () => {
    expect(STORY_FUNNEL_EVENTS).toContain("landing_view");
    expect(STORY_FUNNEL_EVENTS).toContain("gift_opened");
    expect(STORY_FUNNEL_EVENTS).toContain("purchase_completed");
  });

  it("pushes story_* as the dataLayer event name without payload overwrite", () => {
    const pushes: Array<Record<string, unknown>> = [];
    (globalThis as { window?: unknown }).window = {
      location: { pathname: "/christmas-story" },
      dataLayer: {
        push(payload: Record<string, unknown>) {
          pushes.push(payload);
        },
      },
    };
    trackStoryEvent("landing_view", { copy_variant: "emotion_story" });
    expect(pushes[0]?.event).toBe("story_landing_view");
    expect(pushes[0]?.product_family).toBe("christmas_story");
  });

  it("builds a non-fabricating story from buyer inputs only", async () => {
    const draft = createEmptyDraft({
      recipientName: "Maya",
      relationship: "friend",
      whatMakesThemSpecial: "She always texts when it matters",
      memories: ["Rainy bookstore afternoon"],
    });
    const story = await mockStoryProvider.generate(draft);
    expect(story.welcomeTitle).toContain("Maya");
    expect(story.storyParagraphs.join(" ")).toContain("Rainy bookstore afternoon");
    expect(story.storyParagraphs.join(" ")).not.toMatch(/invented childhood|born in/i);
  });

  it("composes a preview marked as example song", async () => {
    const draft = createEmptyDraft({
      recipientName: "Emma",
      relationship: "partner",
      whatMakesThemSpecial: "The way she lights up ordinary days",
    });
    const content = await composePreviewContent(draft);
    expect(content.song.isExample).toBe(true);
    expect(content.song.lyrics.length).toBeGreaterThan(2);
    expect(content.welcomeTitle).toContain("Emma");
  });

  it("creates a mock paid order in REVIEW_REQUIRED without live checkout", async () => {
    const draft = createEmptyDraft({
      recipientName: "Noah",
      relationship: "parent",
      whatMakesThemSpecial: "His quiet patience",
      digitalConsent: true,
    });
    const order = await createMockPaidOrder(draft, "Sam");
    expect(order.status).toBe("REVIEW_REQUIRED");
    expect(order.checkoutMode).toBe("disabled");
    expect(order.recipientToken.length).toBeGreaterThan(20);
    expect(order.content?.fromName).toBe("Sam");
    expect(order.priceCents).toBe(5700);
  });

  it("supports mock and manual music providers without external calls", async () => {
    const mockJob = await mockMusicProvider.enqueue({
      orderId: "ord_test",
      recipientFirstName: "Emma",
      genre: "soft acoustic",
      language: "en",
      lyricSummary: "Emma this night",
    });
    expect(mockJob.status).toBe("ready");
    expect(mockJob.provider).toBe("mock");

    const manualJob = await manualMusicProvider.enqueue({
      orderId: "ord_test2",
      recipientFirstName: "Emma",
      genre: "soft acoustic",
      language: "en",
      lyricSummary: "Emma this night",
    });
    expect(manualJob.status).toBe("awaiting_manual");
    expect(manualJob.provider).toBe("manual");
  });

  it("ships a clearly fictional demo gift token", () => {
    expect(DEMO_RECIPIENT_TOKEN).toContain("demo");
    expect(DEMO_GIFT.song.isExample).toBe(true);
    expect(DEMO_GIFT.storyParagraphs.join(" ")).toMatch(/fictional|sample/i);
  });
});
