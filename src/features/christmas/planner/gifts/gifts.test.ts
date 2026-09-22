import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { christmasIdentitiesForPeople, christmasIdentityForPerson, CHRISTMAS_IDENTITIES } from "./giftIdentity";
import {
  giftLifecycle,
  giftsOverviewStats,
  nextGiftStatus,
  personGiftStats,
  personMatchesFilter,
  relationshipBucket,
} from "./giftProgress";
import type { GiftItem } from "../types";

function readSrc(rel: string) {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

function gift(partial: Partial<GiftItem> & { id: string; status: GiftItem["status"] }): GiftItem {
  return {
    profile_id: "p",
    recipient_id: "r",
    idea: "Idea",
    selected_gift: "",
    url: null,
    store: "",
    planned_price_minor: null,
    actual_price_minor: null,
    hiding_place: "",
    delivery_on: null,
    return_deadline: null,
    source_type: "manual",
    source_ref: null,
    ...partial,
  };
}

describe("gifts progress", () => {
  it("maps existing statuses onto buy / wrap without inventing rows", () => {
    expect(giftLifecycle("idea")).toBe("ideas");
    expect(giftLifecycle("planned")).toBe("planned");
    expect(giftLifecycle("ordered")).toBe("bought");
    expect(giftLifecycle("arrived")).toBe("bought");
    expect(giftLifecycle("hidden")).toBe("bought");
    expect(giftLifecycle("wrapped")).toBe("wrapped");
    expect(nextGiftStatus("idea", "bought")).toBe("ordered");
    expect(nextGiftStatus("ordered", "bought")).toBe("ordered");
    expect(nextGiftStatus("ordered", "wrapped")).toBe("wrapped");
    const stats = personGiftStats([
      gift({ id: "1", status: "idea" }),
      gift({ id: "2", status: "planned" }),
      gift({ id: "3", status: "ordered" }),
    ]);
    expect(stats.total).toBe(3);
    expect(stats.toBuy).toBe(2);
    expect(stats.bought).toBe(1);
    expect(stats.done).toBe(false);
  });

  it("reports truthful empty overview numbers", () => {
    expect(
      giftsOverviewStats({
        people: [],
        gifts: [],
        profileBudgetMinor: null,
      }),
    ).toEqual({
      people: 0,
      giftsTotal: 0,
      giftsPlanned: 0,
      leftToBuy: 0,
      spentMinor: 0,
      committedMinor: 0,
      budgetMinor: null,
    });
  });

  it("filters family and friends from saved relationships only", () => {
    expect(relationshipBucket("mom")).toBe("family");
    expect(relationshipBucket("friend")).toBe("friends");
    expect(
      personMatchesFilter("to_buy", { relationship: "mom" }, [gift({ id: "1", status: "idea" })]),
    ).toBe(true);
    expect(
      personMatchesFilter("bought", { relationship: "mom" }, [gift({ id: "1", status: "wrapped" })]),
    ).toBe(true);
  });
});

describe("christmas identity cards", () => {
  it("never uses portraits or initials as the visual", () => {
    const mom = christmasIdentityForPerson({ id: "1", displayName: "Mom", relationship: "family" });
    const dad = christmasIdentityForPerson({ id: "2", displayName: "Dad", relationship: "family" });
    expect(mom.src).not.toEqual(dad.src);
    const covers = christmasIdentitiesForPeople([
      { id: "1", displayName: "Andreas", relationship: "family" },
      { id: "2", displayName: "name", relationship: "family" },
      { id: "3", displayName: "Emil", relationship: "family" },
      { id: "4", displayName: "Emil", relationship: "family" },
    ]);
    expect(new Set([...covers.values()].map((row) => row.src)).size).toBe(4);
    expect(mom.caption).toContain("not a portrait");
    for (const look of CHRISTMAS_IDENTITIES) {
      expect(look.src.toLowerCase()).not.toContain("portrait");
      expect(look.alt.toLowerCase()).not.toContain("mom");
      expect(look.alt.toLowerCase()).not.toContain("person");
    }
    const page = readSrc("src/features/christmas/planner/gifts/GiftsPage.tsx");
    expect(page).not.toContain("avatar");
    expect(page).not.toContain("initials");
    expect(page).toContain("christmasIdentitiesForPeople");
    expect(page).toContain("+ Add Someone");
    expect(page).toContain("Everyone you love. Everything in one place.");
    expect(page).toContain("tdg-gifts-add-plus");
    const layout = readSrc("src/features/christmas/planner/ChristmasPlannerLayout.tsx");
    expect(layout).toContain("Christmas Planner");
    expect(layout).toContain("Your calm Christmas starts here.");
    expect(layout).toContain("PlannerGiftMark");
    expect(layout).toContain("AI Copilot");
    expect(layout).toContain('label: "Home"');
    expect(layout).toContain('label: "Today"');
    expect(layout).toContain('label: "Plan"');
    expect(layout).toContain('label: "Recipes"');
    expect(layout).toContain('label: "Shopping"');
    expect(layout).toContain('to="/account/christmas/plan"');
    expect(layout).toContain('tdg-planner-nav-copilot');
    expect(layout).not.toContain("The Digital Gifter");
    const css = readSrc("src/features/christmas/planner/plannerApp.css");
    expect(css).toContain("#b5232e");
    expect(css).toContain("#f7f1e8");
    expect(css).toContain(".tdg-gifts-search-toggle");
    expect(css).not.toContain('content: "🎁"');
    expect(page).toContain("<GiftConcierge");
    expect(page).not.toContain("CABIN LIGHT");
    expect(page).not.toContain("look.label");
    expect(CHRISTMAS_IDENTITIES.some((look) => look.src.includes("scene-ambient"))).toBe(false);
    expect(CHRISTMAS_IDENTITIES.some((look) => look.src.includes("portrait"))).toBe(false);
  });
});
