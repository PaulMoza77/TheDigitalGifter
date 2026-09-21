import { FREE_LIMITS, FOUNDING_PASS_PRICE_LABEL } from "./types";

/** Landing FAQ — answers must match live product, free limits, and refund policy. */
export const PLANNER_FAQS = [
  {
    q: "What exactly do I get?",
    a: `Christmas Planner 2026 is an online planner for gifts, budget, meals, groceries, tasks, hosting, and family plans. The ${FOUNDING_PASS_PRICE_LABEL} Founding Pass unlocks the full Planner for the 2026 season. AI Christmas cards and videos are separate products that use their own credits.`,
  },
  {
    q: "Is this an app or a PDF?",
    a: "Neither. It is an interactive online planner in your browser — not a downloadable worksheet, and not a store app you install.",
  },
  {
    q: "Can I use it on my phone and computer?",
    a: "Yes. It is built for phones first and works on desktop too. Sign in to pick up where you left off on any device.",
  },
  {
    q: "What can I use for free?",
    a: `You can explore the Planner with free limits — up to ${FREE_LIMITS.maxRecipients} gift people, a small set of tasks, limited budget categories, and a short recipe teaser. The Founding Pass removes those limits and unlocks the full 2026 Planner.`,
  },
  {
    q: "Is the $17 payment a subscription?",
    a: `No. The Founding Pass is a one-time ${FOUNDING_PASS_PRICE_LABEL} USD payment. There is no subscription for this offer.`,
  },
  {
    q: "How long can I access my planner?",
    a: "Access is granted for the Christmas 2026 Planner season and stays on your account for that season. It is not a subscription. It is also not lifetime access.",
  },
  {
    q: "What happens after payment?",
    a: "You return to a welcome page. If you are not signed in yet, create an account or sign in to attach the purchase, then open your Planner. We never unlock paid access from a success URL alone — payment is verified on the server.",
  },
  {
    q: "Are AI cards and videos included?",
    a: "No. Christmas card and video generation uses separate credits. The Planner may show Studio benefits where they currently apply, but card and video credits are not part of the $17 Planner payment.",
  },
  {
    q: "What is your refund policy?",
    a: "Digital purchases follow The Digital Gifter refund policy. Credits and digital products are generally non-refundable once used; exceptional cases are reviewed individually. See the Refund Policy page for full terms.",
  },
] as const;

export const PLANNER_INCLUDED_GROUPS = [
  {
    title: "Gifts & wishlists",
    benefit: "Know who you’re buying for.",
    detail: "People, ideas, statuses, wishlists, and Gift Finder help — in one list you can actually finish.",
  },
  {
    title: "Budget & spending",
    benefit: "Keep your Christmas budget in view.",
    detail: "Set a season budget, log spending, and see what is left before the scramble starts.",
  },
  {
    title: "Meals, recipes & groceries",
    benefit: "Turn the menu into a shopping list.",
    detail: "Plan Eve and Day meals, save recipes, and build one grocery list from what you will cook.",
  },
  {
    title: "Tasks, hosting & family plans",
    benefit: "See the next useful step.",
    detail: "Calendar, tasks, guests, home prep, activities, travel notes, and Rescue Mode when time is short.",
  },
] as const;

export const PLANNER_HOW_STEPS = [
  {
    title: "Get your planner",
    body: "Pay once for the Christmas 2026 Founding Pass. Guest checkout is supported — you attach the purchase to your account after payment if you are not signed in yet.",
  },
  {
    title: "Make it yours",
    body: "Add the people you buy for, set a budget, and sketch meals when you are ready. Optional personalization can wait until after you are inside the Planner.",
  },
  {
    title: "Come back whenever you need your next step",
    body: "Open your Planner on phone or computer, check what is left, and keep Christmas moving without starting from scratch.",
  },
] as const;
