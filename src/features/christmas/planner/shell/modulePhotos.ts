export type PlannerPhotoSlot = {
  id: string;
  src: string;
  width: number;
  height: number;
  alt: string;
  fallback: string;
};

/** Local production slots — replace files in public/planner/modules without code changes. */
export const PLANNER_MODULE_PHOTOS: Record<string, PlannerPhotoSlot> = {
  gifts: {
    id: "gifts",
    src: "/planner/modules/gifts.webp",
    width: 960,
    height: 720,
    alt: "Wrapped Christmas gifts",
    fallback: "linear-gradient(160deg, #7a2430 0%, #c45c48 42%, #1c1612 100%)",
  },
  meals: {
    id: "meals",
    src: "/planner/modules/meals.webp",
    width: 960,
    height: 720,
    alt: "Christmas dinner table",
    fallback: "linear-gradient(160deg, #5c2418 0%, #c4783c 50%, #1c1612 100%)",
  },
  budget: {
    id: "budget",
    src: "/planner/modules/budget.webp",
    width: 960,
    height: 720,
    alt: "Christmas savings",
    fallback: "linear-gradient(160deg, #f4ead9 0%, #c4a574 45%, #7a2430 100%)",
  },
  calendar: {
    id: "calendar",
    src: "/planner/modules/calendar.webp",
    width: 960,
    height: 720,
    alt: "Christmas planner notebook",
    fallback: "linear-gradient(160deg, #efe4d2 0%, #b33a3a 55%, #143328 100%)",
  },
  recipes: {
    id: "recipes",
    src: "/planner/modules/recipes.webp",
    width: 960,
    height: 720,
    alt: "Christmas cookies",
    fallback: "linear-gradient(160deg, #8b3a22 0%, #e8c9a0 48%, #4a2014 100%)",
  },
  hosting: {
    id: "hosting",
    src: "/planner/modules/hosting.webp",
    width: 960,
    height: 720,
    alt: "Decorated Christmas home",
    fallback: "linear-gradient(160deg, #143328 0%, #c45c48 40%, #1c1612 100%)",
  },
  travel: {
    id: "travel",
    src: "/planner/modules/travel.webp",
    width: 960,
    height: 720,
    alt: "Snowy Christmas destination",
    fallback: "linear-gradient(160deg, #1a3344 0%, #7a2430 55%, #0e1c24 100%)",
  },
  traditions: {
    id: "traditions",
    src: "/planner/modules/traditions.webp",
    width: 960,
    height: 720,
    alt: "Christmas snow globe",
    fallback: "linear-gradient(160deg, #7a2430 0%, #f4ead9 50%, #143328 100%)",
  },
  cards: {
    id: "cards",
    src: "/planner/modules/cards.webp",
    width: 960,
    height: 720,
    alt: "Christmas cards and envelopes",
    fallback: "linear-gradient(160deg, #f7f0e4 0%, #b33a3a 52%, #3a1518 100%)",
  },
};
