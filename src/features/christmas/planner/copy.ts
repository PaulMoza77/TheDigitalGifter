import { FREE_LIMITS, FOUNDING_PASS_PRICE_LABEL } from "./types";

/** Condensed FAQ — existing commercial rules only. */
export const PLANNER_FAQS = [
  {
    q: "What do I get — and what is free?",
    a: `Christmas Planner 2026 is an online planner for gifts, budget, meals, groceries, tasks, and hosting. Free use stays limited (up to ${FREE_LIMITS.maxRecipients} gift people, a small task set, limited budget categories, and a short recipe teaser). The ${FOUNDING_PASS_PRICE_LABEL} Founding Pass unlocks the full Planner for the 2026 season.`,
  },
  {
    q: "Is this a PDF? Does it work on my phone?",
    a: "It is an interactive online planner in your browser — not a PDF and not a store app. It is built for phones first and also works on desktop.",
  },
  {
    q: "Is $17 a subscription, and how long does access last?",
    a: `No subscription. The Founding Pass is a one-time ${FOUNDING_PASS_PRICE_LABEL} USD payment. Access is granted for the Christmas 2026 Planner season (season year 2026 on your account). No separate calendar end date is configured beyond that season scope, and this is not lifetime access. What happens to a saved plan after the season ends is not separately defined in the current product terms.`,
  },
  {
    q: "What happens after I pay?",
    a: "You return to a welcome page, sign in or create an account if needed, and open your Planner. Paid access is granted only after the server verifies payment — never from a success URL alone.",
  },
  {
    q: "Are AI cards and videos included?",
    a: "No. Card and video generation uses separate credits and is not part of the $17 Planner payment.",
  },
  {
    q: "What is your refund policy?",
    a: "Digital purchases follow The Digital Gifter refund policy. Credits and digital products are generally non-refundable once used; exceptional cases are reviewed individually. Full terms are on the Refund Policy page.",
  },
] as const;

export const PLANNER_INCLUDED_GROUPS = [
  {
    title: "Gifts & wishlists",
    detail: "Keep every person, idea, and present status in one list you can finish.",
  },
  {
    title: "Budget & spending",
    detail: "Set a season total, log what you spend, and see what is left.",
  },
  {
    title: "Meals & groceries",
    detail: "Plan the holiday menu and turn dishes into one shopping list.",
  },
  {
    title: "Tasks & hosting",
    detail: "See the next useful step for guests, home prep, and family plans.",
  },
] as const;

export const PLANNER_HOW_STEPS = [
  {
    title: "Get your planner",
    body: "Pay once and open Christmas Planner 2026.",
  },
  {
    title: "Make it yours",
    body: "Add people, a budget, and meals when you are ready.",
  },
  {
    title: "Follow your next steps",
    body: "Come back anytime to see what still needs doing.",
  },
] as const;

export const GIFT_DEMO_STATUSES = ["idea", "planned", "ordered", "arrived", "wrapped"] as const;
export type GiftDemoStatus = (typeof GIFT_DEMO_STATUSES)[number];

export const GIFT_DEMO_PEOPLE: Array<{ name: string; gift: string; status: GiftDemoStatus }> = [
  { name: "Maya", gift: "Wireless headphones", status: "ordered" },
  { name: "Dad", gift: "Wool scarf", status: "idea" },
  { name: "Sam", gift: "Board game", status: "arrived" },
  { name: "Neighbour", gift: "Candle set", status: "wrapped" },
];

export const BUDGET_DEMO = {
  season: 800,
  gifts: 312,
  foodDecor: 96,
} as const;

export const BUDGET_DEMO_REMAINING = BUDGET_DEMO.season - BUDGET_DEMO.gifts - BUDGET_DEMO.foodDecor;

/** Local demo recipe — scaled with the same helper as the product recipe catalog. */
export const MEAL_DEMO_RECIPE = {
  title: "Herb-butter roast turkey",
  baseServings: 8,
  ingredients: [
    { name: "whole turkey", quantity: 1, unit: "piece" },
    { name: "unsalted butter", quantity: 150, unit: "g" },
    { name: "fresh thyme", quantity: 12, unit: "g" },
    { name: "onion", quantity: 2, unit: "piece" },
    { name: "lemon", quantity: 1, unit: "piece" },
  ],
} as const;
