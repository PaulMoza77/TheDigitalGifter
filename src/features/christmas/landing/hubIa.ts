/**
 * Christmas hub IA contract.
 * Suite destinations live under /christmas/*. Do not conflate them with
 * Send a Gift (/send-a-gift) or Gift Tree chance (/christmas/gifts reserved).
 * Hub CTAs open experiences — never checkout, buy, or pay.
 */

export const CLASSIC_GENERATOR_HREF = "/generator?occasion=christmas";
export const GIFT_FINDER_PATH = "/christmas/gift-finder";
export const GIFT_FINDER_LEGACY_PATH = "/christmas/gifts";
export const SEND_A_GIFT_PATH = "/send-a-gift";
export const SHAREABLE_TREE_PATH = "/christmas/tree";

export type HubSuiteKey =
  | "portraits"
  | "santa"
  | "gift_finder"
  | "wishlist"
  | "tree"
  | "cards"
  | "messages"
  | "advent";

export type HubSuiteItem = {
  key: HubSuiteKey;
  sceneId: string;
  path: string;
  navKey: string;
  ctaKey: string;
  /** Founder review order: paid portraits / Santa first, then discovery. */
  priority: number;
  productKey: string;
};

export const HUB_SUITE: readonly HubSuiteItem[] = [
  {
    key: "portraits",
    sceneId: "portraits",
    path: "/christmas/family",
    navKey: "nav.portraits",
    ctaKey: "portraits.cta",
    priority: 1,
    productKey: "christmas_family",
  },
  {
    key: "santa",
    sceneId: "santa",
    path: "/christmas/santa-video",
    navKey: "nav.santa",
    ctaKey: "santa.cta",
    priority: 2,
    productKey: "christmas_santa_video",
  },
  {
    key: "gift_finder",
    sceneId: "gift-finder",
    path: GIFT_FINDER_PATH,
    navKey: "nav.gifts",
    ctaKey: "gifts.cta",
    priority: 3,
    productKey: "christmas_gift_finder",
  },
  {
    key: "wishlist",
    sceneId: "wishlist",
    path: "/christmas/wishlist",
    navKey: "nav.wishlist",
    ctaKey: "wishlist.cta",
    priority: 4,
    productKey: "christmas_wishlist",
  },
  {
    key: "tree",
    sceneId: "tree",
    path: SHAREABLE_TREE_PATH,
    navKey: "nav.tree",
    ctaKey: "tree.cta",
    priority: 5,
    productKey: "christmas_tree",
  },
  {
    key: "cards",
    sceneId: "cards",
    path: "/christmas/cards",
    navKey: "nav.cards",
    ctaKey: "cards.cta",
    priority: 6,
    productKey: "christmas_card",
  },
  {
    key: "messages",
    sceneId: "messages",
    path: "/christmas/messages",
    navKey: "nav.messages",
    ctaKey: "messages.cta",
    priority: 7,
    productKey: "christmas_messages",
  },
  {
    key: "advent",
    sceneId: "advent",
    path: "/christmas/advent",
    navKey: "nav.advent",
    ctaKey: "advent.cta",
    priority: 8,
    productKey: "christmas_advent",
  },
] as const;

/** Adjacent products — linked from FAQ copy only, never as hub suite CTAs. */
export const HUB_OUTSIDE_SUITE = {
  sendAGift: { path: SEND_A_GIFT_PATH, name: "Send a Gift" },
  giftTreeChance: { path: GIFT_FINDER_LEGACY_PATH, name: "Gift Tree" },
  classicGenerator: { path: CLASSIC_GENERATOR_HREF, name: "Classic Christmas generator" },
} as const;

export function hubSuiteByPriority(): HubSuiteItem[] {
  return [...HUB_SUITE].sort((a, b) => a.priority - b.priority);
}

export function giftFinderCanonicalFromLegacy(search = ""): string {
  const q = search.startsWith("?") ? search : search ? `?${search}` : "";
  return `${GIFT_FINDER_PATH}${q}`;
}

const CHECKOUT_CTA = /\b(buy now|pay now|checkout|purchase|order now)\b/i;

export function isPrematureCheckoutCta(label: string): boolean {
  return CHECKOUT_CTA.test(label);
}

export function isSuitePath(pathname: string): boolean {
  const path = pathname.split("?")[0];
  if (path === "/christmas") return true;
  return HUB_SUITE.some((item) => item.path === path);
}
