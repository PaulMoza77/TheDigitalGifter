/**
 * Route shells for unfinished Christmas suite surfaces.
 * No fake payment CTAs or AI results.
 */

export type ChristmasRouteShellDef = {
  path: string;
  productKey: string;
  title: string;
  status: "live_hub" | "foundation" | "coming_soon";
  description: string;
  noindex: boolean;
};

/** Unfinished suite surfaces only — `/christmas/photo-generator` is a real funnel page. */
export const CHRISTMAS_ROUTE_SHELLS: ChristmasRouteShellDef[] = [
  {
    path: "/christmas/family",
    productKey: "christmas_family",
    title: "Family Christmas Generator",
    status: "coming_soon",
    description: "This product is not available yet.",
    noindex: true,
  },
  {
    path: "/christmas/couples",
    productKey: "christmas_couple",
    title: "Couples Christmas Generator",
    status: "coming_soon",
    description: "This product is not available yet.",
    noindex: true,
  },
  {
    path: "/christmas/kids",
    productKey: "christmas_kids",
    title: "Kids Christmas Generator",
    status: "coming_soon",
    description: "This product is not available yet. Privacy controls are required before launch.",
    noindex: true,
  },
  {
    path: "/christmas/pets",
    productKey: "christmas_pet",
    title: "Pet Christmas Generator",
    status: "coming_soon",
    description: "This product is not available yet.",
    noindex: true,
  },
  {
    path: "/christmas/dogs",
    productKey: "christmas_pet",
    title: "Dog Christmas Portraits",
    status: "coming_soon",
    description: "This product is not available yet.",
    noindex: true,
  },
  {
    path: "/christmas/cats",
    productKey: "christmas_pet",
    title: "Cat Christmas Portraits",
    status: "coming_soon",
    description: "This product is not available yet.",
    noindex: true,
  },
  {
    path: "/christmas/santa-video",
    productKey: "christmas_santa_video",
    title: "Personalized Santa Video",
    status: "coming_soon",
    description: "Santa Video is not available yet. No checkout or personalization is offered here.",
    noindex: true,
  },
  {
    path: "/christmas/tree",
    productKey: "christmas_tree",
    title: "Shareable Christmas Tree",
    status: "coming_soon",
    description: "This feature is not available yet.",
    noindex: true,
  },
  {
    path: "/christmas/advent",
    productKey: "christmas_advent",
    title: "Advent Calendar",
    status: "coming_soon",
    description: "This feature is not available yet.",
    noindex: true,
  },
  {
    path: "/christmas/wishlist",
    productKey: "christmas_wishlist",
    title: "Christmas Wishlist",
    status: "coming_soon",
    description: "This feature is not available yet.",
    noindex: true,
  },
  {
    path: "/christmas/gift-finder",
    productKey: "christmas_gift_finder",
    title: "AI Christmas Gift Finder",
    status: "coming_soon",
    description: "This feature is not available yet.",
    noindex: true,
  },
  {
    path: "/christmas/cards",
    productKey: "christmas_card",
    title: "Personalized Christmas Cards",
    status: "coming_soon",
    description: "This product is not available yet.",
    noindex: true,
  },
  {
    path: "/christmas/messages",
    productKey: "christmas_messages",
    title: "AI Christmas Message Generator",
    status: "coming_soon",
    description: "This product is not available yet.",
    noindex: true,
  },
];

export function shellForPath(pathname: string): ChristmasRouteShellDef | null {
  const path = pathname.split("?")[0];
  return CHRISTMAS_ROUTE_SHELLS.find((s) => s.path === path) ?? null;
}

export function shellExposesCheckout(shell: ChristmasRouteShellDef): boolean {
  return false;
  void shell;
}
