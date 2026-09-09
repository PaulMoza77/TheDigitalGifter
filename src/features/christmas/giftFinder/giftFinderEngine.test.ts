import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  curatedIdeas,
  filterSafeIdeas,
  parseIdeas,
  validateFinderInput,
  type FinderInput,
} from "../../../../supabase/functions/_shared/christmas/giftFinderCore.ts";
import { INTEREST_KEYS } from "../wishlist/taxonomy";

function baseInput(overrides: Partial<FinderInput> = {}): FinderInput {
  return {
    locale: "en",
    recipientKey: "mom",
    ageRangeKey: "45_54",
    interestKeys: ["gardening"],
    customInterest: "",
    budgetKey: "50_100",
    giftTypeKey: "either",
    vibeKey: "cozy",
    ...overrides,
  };
}

describe("gift finder engine", () => {
  it("accepts taxonomy keys and rejects unsafe custom interest", () => {
    expect(validateFinderInput(baseInput()).ok).toBe(true);
    expect(validateFinderInput(baseInput({ recipientKey: "alien" })).ok).toBe(false);
    expect(validateFinderInput(baseInput({ customInterest: "buy a weapon" })).ok).toBe(false);
    expect(validateFinderInput(baseInput({ interestKeys: [], customInterest: "" })).ok).toBe(false);
  });

  it("covers every interest key with six curated ideas", () => {
    for (const key of INTEREST_KEYS) {
      const ideas = curatedIdeas(baseInput({ interestKeys: [key] }));
      expect(ideas.length).toBe(6);
      expect(ideas.every((idea) => idea.title.length > 0 && idea.search_query.length > 0)).toBe(true);
    }
  });

  it("filters alcohol for child ages and prefers experience gifts", () => {
    const adult = filterSafeIdeas(
      [
        {
          title: "Whiskey tasting",
          reason: "A night of whiskey",
          budget_min: 40,
          budget_max: 80,
          category: "experience",
          search_query: "whiskey tasting",
          tdg_product_key: null,
        },
      ],
      "45_54",
    );
    const child = filterSafeIdeas(
      [
        {
          title: "Whiskey tasting",
          reason: "A night of whiskey",
          budget_min: 40,
          budget_max: 80,
          category: "experience",
          search_query: "whiskey tasting",
          tdg_product_key: null,
        },
      ],
      "6_12",
    );
    expect(adult).toHaveLength(1);
    expect(child).toHaveLength(0);

    const experiences = curatedIdeas(baseInput({ giftTypeKey: "experience", interestKeys: ["travel"] }));
    expect(experiences.length).toBeGreaterThanOrEqual(3);
    expect(experiences.filter((i) => i.category === "experience").length).toBeGreaterThanOrEqual(3);
  });

  it("parses model JSON and ignores junk around it", () => {
    const ideas = parseIdeas('prefix {"ideas":[{"title":"Herb kit","reason":"Fresh","search_query":"herb"}]} suffix');
    expect(ideas).toHaveLength(1);
    expect(ideas[0].title).toBe("Herb kit");
  });

  it("keeps OpenAI prompts server-owned in the wrapper", () => {
    const wrapper = readFileSync(resolve(process.cwd(), "supabase/functions/_shared/christmas/giftFinder.ts"), "utf8");
    expect(wrapper).toContain("systemPrompt");
    expect(wrapper).toContain("CURATED_MODEL");
    expect(wrapper).toContain("Deno.env.get(\"OPENAI_API_KEY\")");
    expect(wrapper).not.toContain("system prompt from client");
    expect(readFileSync(resolve(process.cwd(), "supabase/functions/_shared/christmas/giftFinderCore.ts"), "utf8")).toContain(
      'server_curated_v1',
    );
  });
});
