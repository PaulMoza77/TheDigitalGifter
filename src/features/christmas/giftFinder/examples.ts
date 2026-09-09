/**
 * Static demo / curated example result sets for Gift Finder.
 * Used for above-the-fold demo, curated fallbacks, and quality scenarios.
 */

export type RankingRole =
  | "best_match"
  | "safe_choice"
  | "meaningful"
  | "experience"
  | "unexpected";

export type ExampleGiftIdea = {
  title: string;
  reason: string;
  budget_min: number | null;
  budget_max: number | null;
  category: string;
  gift_type: string;
  ranking_role: RankingRole;
  search_query: string;
  tdg_product_key: string | null;
};

export type ExampleProfile = {
  id: string;
  recipientKey: string;
  ageRangeKey: string;
  interestKeys: string[];
  personalityKeys: string[];
  budgetKey: string;
  personalDetail?: string;
  ideas: ExampleGiftIdea[];
};

export const HERO_DEMO: ExampleProfile = {
  id: "hero_mom",
  recipientKey: "mom",
  ageRangeKey: "55_64",
  interestKeys: ["cooking", "travel", "home"],
  personalityKeys: ["sentimental"],
  budgetKey: "50_100",
  ideas: [
    {
      title: "Personalized Family Recipe Book",
      reason:
        "It combines her love of cooking with something personal and meaningful she can keep forever.",
      budget_min: 35,
      budget_max: 70,
      category: "personalized",
      gift_type: "Personalized",
      ranking_role: "best_match",
      search_query: "personalized family recipe book gift",
      tdg_product_key: null,
    },
  ],
};

export const EXAMPLE_SETS: ExampleProfile[] = [
  {
    id: "mom_sentimental",
    recipientKey: "mom",
    ageRangeKey: "55_64",
    interestKeys: ["cooking", "travel"],
    personalityKeys: ["sentimental"],
    budgetKey: "50_100",
    personalDetail: "She recently became a grandmother.",
    ideas: [
      {
        title: "Personalized Family Recipe Book",
        reason:
          "She loves cooking and sentimental gifts — this turns family recipes into something she can actually keep, especially as a new grandmother.",
        budget_min: 35,
        budget_max: 70,
        category: "personalized",
        gift_type: "Personalized",
        ranking_role: "best_match",
        search_query: "personalized family recipe book",
        tdg_product_key: null,
      },
      {
        title: "Premium Travel Organizer",
        reason:
          "A polished everyday upgrade for trips she already takes — useful without feeling generic.",
        budget_min: 40,
        budget_max: 85,
        category: "practical",
        gift_type: "Practical",
        ranking_role: "safe_choice",
        search_query: "premium travel organizer toiletry bag",
        tdg_product_key: null,
      },
      {
        title: "Custom Family Illustration",
        reason:
          "A warm keepsake that celebrates family — especially meaningful now that she’s a grandmother.",
        budget_min: 45,
        budget_max: 95,
        category: "personalized",
        gift_type: "Personalized",
        ranking_role: "meaningful",
        search_query: "custom family illustration print",
        tdg_product_key: null,
      },
      {
        title: "Cooking Class Experience",
        reason:
          "An experience that matches her love of cooking and creates a memory instead of more clutter.",
        budget_min: 50,
        budget_max: 100,
        category: "experience",
        gift_type: "Experience",
        ranking_role: "experience",
        search_query: "cooking class gift certificate",
        tdg_product_key: null,
      },
      {
        title: "High-Quality Kitchen Accessory",
        reason:
          "A thoughtful upgrade she’ll use constantly — practical, elevated, and easy to love.",
        budget_min: 40,
        budget_max: 80,
        category: "practical",
        gift_type: "Practical",
        ranking_role: "unexpected",
        search_query: "premium kitchen utensil gift",
        tdg_product_key: null,
      },
    ],
  },
  {
    id: "boyfriend_tech",
    recipientKey: "boyfriend",
    ageRangeKey: "25_34",
    interestKeys: ["gaming", "tech", "coffee"],
    personalityKeys: ["practical"],
    budgetKey: "100_200",
    ideas: [
      {
        title: "Mechanical Keyboard Accessory Upgrade",
        reason:
          "A practical tech upgrade gamers notice daily — useful, personal to his setup, and within budget.",
        budget_min: 80,
        budget_max: 160,
        category: "tech",
        gift_type: "Tech",
        ranking_role: "best_match",
        search_query: "mechanical keyboard wrist rest keycaps gift",
        tdg_product_key: null,
      },
      {
        title: "Specialty Coffee Subscription",
        reason:
          "Combines his coffee habit with something he can enjoy for months — practical and thoughtful.",
        budget_min: 60,
        budget_max: 120,
        category: "practical",
        gift_type: "Practical",
        ranking_role: "safe_choice",
        search_query: "specialty coffee subscription gift",
        tdg_product_key: null,
      },
      {
        title: "Personalized Tech Organizer",
        reason:
          "Keeps cables and gadgets tidy — a small personal touch for someone who lives with tech.",
        budget_min: 40,
        budget_max: 90,
        category: "personalized",
        gift_type: "Personalized",
        ranking_role: "meaningful",
        search_query: "personalized tech cable organizer",
        tdg_product_key: null,
      },
      {
        title: "Gaming Event or Experience Ticket",
        reason:
          "An experience he’ll remember — better than another generic gadget when he already has gear.",
        budget_min: 100,
        budget_max: 200,
        category: "experience",
        gift_type: "Experience",
        ranking_role: "experience",
        search_query: "gaming convention ticket gift",
        tdg_product_key: null,
      },
      {
        title: "Gaming Desk Upgrade",
        reason:
          "A desk mat or lighting upgrade that makes his setup feel fresher without buying him another console.",
        budget_min: 50,
        budget_max: 140,
        category: "tech",
        gift_type: "Tech",
        ranking_role: "unexpected",
        search_query: "gaming desk mat RGB light gift",
        tdg_product_key: null,
      },
    ],
  },
  {
    id: "dad_has_everything",
    recipientKey: "dad",
    ageRangeKey: "55_64",
    interestKeys: ["cars", "coffee", "travel"],
    personalityKeys: ["has_everything"],
    budgetKey: "50_100",
    ideas: [
      {
        title: "Scenic Drive or Track-Day Experience",
        reason:
          "When someone has everything, experiences beat objects — especially if he loves cars.",
        budget_min: 60,
        budget_max: 100,
        category: "experience",
        gift_type: "Experience",
        ranking_role: "best_match",
        search_query: "driving experience gift certificate",
        tdg_product_key: null,
      },
      {
        title: "Premium Everyday Coffee Ritual Kit",
        reason:
          "A small luxury for a daily habit — elevated without being another thing he’ll stash away.",
        budget_min: 45,
        budget_max: 90,
        category: "practical",
        gift_type: "Practical",
        ranking_role: "safe_choice",
        search_query: "pour over coffee gift set",
        tdg_product_key: null,
      },
      {
        title: "Custom Family Keepsake Print",
        reason:
          "Meaningful beats material when shelves are full — a personal piece he’ll actually display.",
        budget_min: 40,
        budget_max: 85,
        category: "personalized",
        gift_type: "Personalized",
        ranking_role: "meaningful",
        search_query: "custom family print gift for dad",
        tdg_product_key: null,
      },
      {
        title: "Travel Day Upgrade",
        reason:
          "A refined packing or comfort upgrade for trips — hobby-adjacent without buying another gadget.",
        budget_min: 50,
        budget_max: 100,
        category: "practical",
        gift_type: "Practical",
        ranking_role: "experience",
        search_query: "premium travel packing cube set",
        tdg_product_key: null,
      },
      {
        title: "Personalized Christmas Portrait",
        reason:
          "A TDG keepsake that feels personal when he truly says he doesn’t need anything.",
        budget_min: null,
        budget_max: null,
        category: "personalized",
        gift_type: "Personalized",
        ranking_role: "unexpected",
        search_query: "christmas family portrait gift",
        tdg_product_key: "christmas_photo",
      },
    ],
  },
  {
    id: "teen_music_fashion",
    recipientKey: "teen",
    ageRangeKey: "13_17",
    interestKeys: ["music", "fashion"],
    personalityKeys: ["creative"],
    budgetKey: "25_50",
    ideas: [
      {
        title: "Wireless Earbuds Case + Accessories",
        reason:
          "Music is central for teens — a stylish accessory upgrade they’ll actually use every day.",
        budget_min: 20,
        budget_max: 45,
        category: "tech",
        gift_type: "Tech",
        ranking_role: "best_match",
        search_query: "wireless earbuds case accessory teen gift",
        tdg_product_key: null,
      },
      {
        title: "Trendy Everyday Fashion Piece",
        reason:
          "A wearable they’ll choose themselves vibe — fashion-forward without guessing their exact style.",
        budget_min: 25,
        budget_max: 50,
        category: "fashion",
        gift_type: "Fashion",
        ranking_role: "safe_choice",
        search_query: "teen fashion accessory gift under 50",
        tdg_product_key: null,
      },
      {
        title: "Custom Playlist Poster or Lyric Print",
        reason:
          "Personal and creative — turns their music taste into something they can hang up.",
        budget_min: 20,
        budget_max: 40,
        category: "personalized",
        gift_type: "Personalized",
        ranking_role: "meaningful",
        search_query: "custom lyric poster gift",
        tdg_product_key: null,
      },
      {
        title: "Concert or Event Ticket Fund Contribution",
        reason:
          "Experiences rank high for teens — even a contribution toward a show feels big.",
        budget_min: 25,
        budget_max: 50,
        category: "experience",
        gift_type: "Experience",
        ranking_role: "experience",
        search_query: "concert ticket gift card teen",
        tdg_product_key: null,
      },
      {
        title: "Creative Desk or Room Accent",
        reason:
          "A small aesthetic upgrade for their space — unique without being childish.",
        budget_min: 20,
        budget_max: 45,
        category: "home",
        gift_type: "Creative",
        ranking_role: "unexpected",
        search_query: "aesthetic room decor teen gift",
        tdg_product_key: null,
      },
    ],
  },
];

export function findExampleForProfile(input: {
  recipientKey: string;
  interestKeys: string[];
  personalityKeys: string[];
}): ExampleProfile | null {
  const scored = EXAMPLE_SETS.map((ex) => {
    let score = 0;
    if (ex.recipientKey === input.recipientKey) score += 5;
    for (const i of input.interestKeys) if (ex.interestKeys.includes(i)) score += 2;
    for (const p of input.personalityKeys) if (ex.personalityKeys.includes(p)) score += 3;
    return { ex, score };
  }).sort((a, b) => b.score - a.score);
  return scored[0]?.score >= 5 ? scored[0].ex : null;
}

export const RANKING_ROLE_ORDER: RankingRole[] = [
  "best_match",
  "safe_choice",
  "meaningful",
  "experience",
  "unexpected",
];

export function assignRankingRoles<T extends { category?: string }>(
  ideas: T[],
): Array<T & { ranking_role: RankingRole }> {
  return ideas.slice(0, 5).map((idea, idx) => {
    let role = RANKING_ROLE_ORDER[idx] || ("unexpected" as RankingRole);
    if (String(idea.category || "").includes("experience") && idx > 0) {
      role = "experience";
    }
    return { ...idea, ranking_role: role };
  });
}
