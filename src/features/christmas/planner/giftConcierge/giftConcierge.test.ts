import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  alreadyHasFinderGift,
  existingGiftsGenerationNote,
  filterObviousDuplicates,
  ideaPriceBucket,
  remainingMinorToBudgetKey,
  summarizeExistingGiftTitles,
  type GiftIdea,
} from "../../giftFinder/logic";
import { sanitizePlannerMetadata } from "../analytics";
import {
  buildConciergeFinderInput,
  recipientFinderKeys,
  recipientSpendContext,
  suggestionBudgetFit,
} from "./context";
import type { GiftItem, GiftRecipient } from "../types";

function readSrc(rel: string) {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

function idea(partial: Partial<GiftIdea> & { title: string }): GiftIdea {
  return {
    id: partial.id || partial.title,
    result_key: partial.result_key || partial.id || partial.title,
    title: partial.title,
    reason: partial.reason || "Fits the brief.",
    budget_min: partial.budget_min ?? 20,
    budget_max: partial.budget_max ?? 40,
    category: partial.category || "practical",
    search_query: partial.search_query || partial.title,
    tdg_product_key: partial.tdg_product_key ?? null,
  };
}

const andreas: GiftRecipient = {
  id: "r-andreas",
  profile_id: "p1",
  display_name: "Andreas",
  relationship: "family",
  budget_minor: 5000,
  notes: "",
};

describe("gift concierge context", () => {
  it("maps family recipients without asking who they are", () => {
    const keys = recipientFinderKeys("family");
    expect(keys.recipientKey).toBe("other");
    expect(keys.relationshipKey).toBe("close_family");
  });

  it("uses remaining recipient budget for the finder band", () => {
    expect(remainingMinorToBudgetKey(5000)).toBe("50_100");
    expect(remainingMinorToBudgetKey(3000)).toBe("25_50");
    const gifts: GiftItem[] = [
      {
        id: "g1",
        profile_id: "p1",
        recipient_id: "r-andreas",
        idea: "Scarf",
        selected_gift: "Scarf",
        url: null,
        store: "",
        planned_price_minor: 2000,
        actual_price_minor: null,
        status: "planned",
        hiding_place: "",
        delivery_on: null,
        return_deadline: null,
        source_type: "manual",
        source_ref: null,
      },
    ];
    const spend = recipientSpendContext(andreas, gifts);
    expect(spend.remainingMinor).toBe(3000);
    expect(remainingMinorToBudgetKey(spend.remainingMinor)).toBe("25_50");
  });

  it("summarizes existing ideas for generation only", () => {
    const note = existingGiftsGenerationNote(["scarf", "coffee grinder", "scarf"]);
    expect(note).toContain("scarf");
    expect(note).toContain("coffee grinder");
    expect(summarizeExistingGiftTitles(["scarf", "scarf"]).length).toBe(1);
  });

  it("passes remaining budget and existing gifts into the shared finder input", () => {
    const gifts: GiftItem[] = [
      {
        id: "g1",
        profile_id: "p1",
        recipient_id: "r-andreas",
        idea: "Scarf",
        selected_gift: "Scarf",
        url: null,
        store: "",
        planned_price_minor: 1800,
        actual_price_minor: null,
        status: "planned",
        hiding_place: "",
        delivery_on: null,
        return_deadline: null,
        source_type: "manual",
        source_ref: null,
      },
    ];
    const input = buildConciergeFinderInput({
      recipient: andreas,
      gifts,
      currency: "eur",
      draft: { interests: "coffee", vibeKeys: ["practical"], priceKey: null, customBudget: "" },
    });
    expect(input.recipientKey).toBe("other");
    expect(input.relationshipKey).toBe("close_family");
    expect(input.budgetKey).toBe("25_50");
    expect(input.customInterest).toContain("coffee");
    expect(input.personalDetail).toMatch(/Scarf/);
    expect(input.personalDetail).not.toMatch(/Andreas/);
  });

  it("filters obvious duplicate titles", () => {
    const ideas = [idea({ title: "Wool scarf" }), idea({ title: "Board game" })];
    const kept = filterObviousDuplicates(ideas, ["wool scarf"]);
    expect(kept.map((i) => i.title)).toEqual(["Board game"]);
  });

  it("blocks double-add by source_ref or title", () => {
    const existing = [{ source_type: "gift_finder", source_ref: "res_1", idea: "Wool scarf", selected_gift: "Wool scarf" }];
    expect(alreadyHasFinderGift(existing, idea({ title: "Wool scarf", result_key: "res_1" }))).toBe(true);
    expect(alreadyHasFinderGift(existing, idea({ title: "Board game", result_key: "res_2" }))).toBe(false);
  });

  it("warns when a typical range is above remaining without blocking", () => {
    expect(suggestionBudgetFit({ budget_min: 10, budget_max: 20 }, 3200)).toBe("fits");
    expect(suggestionBudgetFit({ budget_min: 40, budget_max: 60 }, 3200)).toBe("above");
    expect(suggestionBudgetFit({ budget_min: null, budget_max: null }, 3200)).toBe("unknown");
  });

  it("never puts recipient names, ideas, or budgets into analytics metadata", () => {
    const clean = sanitizePlannerMetadata({
      relationship_category: "close_family",
      price_bucket: ideaPriceBucket({ budget_min: 20, budget_max: 40 }),
      suggestion_count: 5,
      source: "planner",
      display_name: "Andreas",
      budget: 50,
      title: "secret idea",
    });
    expect(clean.relationship_category).toBe("close_family");
    expect(clean.price_bucket).toBe("25_50");
    expect(clean.suggestion_count).toBe(5);
    expect(clean.display_name).toBeUndefined();
    expect(clean.budget).toBeUndefined();
    expect(clean.title).toBeUndefined();
  });
});

describe("gift concierge wiring", () => {
  it("does not navigate Need an idea away from the Planner", () => {
    const page = readSrc("src/features/christmas/planner/ChristmasPlannerPages.tsx");
    expect(page).not.toContain("/christmas/gift-finder?plannerRecipient");
    expect(page).toContain("setConciergeOpen(true)");
    expect(page).toContain("<GiftConcierge");
    expect(page).toContain("Nothing planned for");
    const concierge = readSrc("src/features/christmas/planner/giftConcierge/GiftConcierge.tsx");
    expect(concierge).toContain("tdg-concierge-panel");
    expect(concierge).toContain("We couldn’t find ideas just now.");
    expect(concierge).toContain("Finding thoughtful ideas");
    expect(concierge).toContain("More like this");
    expect(concierge).toContain('role="dialog"');
    const css = readSrc("src/features/christmas/planner/giftConcierge/giftConcierge.css");
    expect(css).toContain("max-width: 719px");
    expect(css).toContain("prefers-reduced-motion");
  });

  it("keeps public Gift Finder on the shared engine", () => {
    const page = readSrc("src/features/christmas/ChristmasGiftFinderPage.tsx");
    expect(page).toContain("runGiftFinder");
    expect(page).toContain('path="/christmas/gift-finder"');
    expect(page).not.toContain("Shop real products");
    const service = readSrc("src/features/christmas/giftFinder/service.ts");
    expect(service).toContain('action: "runGiftFinder"');
  });

  it("shops an idea inline without changing routes", () => {
    const concierge = readSrc("src/features/christmas/planner/giftConcierge/GiftConcierge.tsx");
    expect(concierge).toContain("Shop this idea");
    expect(concierge).toContain("Shop real products");
    expect(concierge).toContain("Finding real products for");
    expect(concierge).toContain("We couldn’t load live products right now.");
    expect(concierge).toContain("Back to gift ideas");
    expect(concierge).toContain("product.affiliateUrl");
    expect(concierge).toContain("addAffiliateProductToPlanner");
    expect(concierge).not.toContain("navigate(");
    expect(concierge).not.toContain("/christmas/gift-finder");
    expect(concierge).toContain("AffiliateDisclosure");
    expect(concierge).toContain("find_similar");
    expect(concierge).toContain("liveShoppingUnavailableCopy");
    const disclosure = readSrc("src/features/christmas/affiliateProducts/AffiliateDisclosure.tsx");
    expect(disclosure).toContain("Some product links are affiliate links");
    const add = readSrc("src/features/christmas/affiliateProducts/addProduct.ts");
    expect(add).toContain('source_type: "affiliate_product"');
    expect(add).toContain("affiliateUrl");
    expect(add).toContain("price_checked_at");
    expect(add).toContain('status: "planned"');
    const giftsPage = readSrc("src/features/christmas/planner/ChristmasPlannerPages.tsx");
    expect(giftsPage).toContain("PlannerGiftOutboundLink");
    expect(giftsPage).toContain("AffiliateSavedProductPanel");
    expect(giftsPage).toContain("find_similar");
    const shopping = readSrc("src/features/christmas/planner/ChristmasPlannerMoreModules.tsx");
    expect(shopping).toContain("PlannerGiftOutboundLink");
    expect(shopping).toContain("AffiliateDisclosure");
    const link = readSrc("src/features/christmas/planner/PlannerGiftLink.tsx");
    expect(link).toContain('rel="sponsored noopener noreferrer"');
  });

  it("does not send recipient names into affiliate analytics or reference ids", () => {
    const concierge = readSrc("src/features/christmas/planner/giftConcierge/GiftConcierge.tsx");
    const clickBlock = concierge.slice(
      concierge.indexOf('trackPlannerEvent("affiliate_product_clicked"'),
      concierge.indexOf("window.open"),
    );
    expect(clickBlock).not.toContain("display_name");
    expect(clickBlock).not.toContain("recipient.notes");
    expect(clickBlock).not.toContain("query:");
    const client = readSrc("src/features/christmas/affiliateProducts/client.ts");
    expect(client).toContain("getOrCreateAffiliateReferenceId");
    expect(client).toContain("createAffiliateReferenceId");
    const clean = sanitizePlannerMetadata({
      provider: "ebay",
      source: "idea",
      display_name: "Andreas",
      query: "engraved jewelry for Andreas",
      notes: "private",
    });
    expect(clean.display_name).toBeUndefined();
    expect(clean.query).toBeUndefined();
    expect(clean.notes).toBeUndefined();
    expect(clean.provider).toBe("ebay");
  });
});
