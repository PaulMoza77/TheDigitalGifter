/** Lightweight Christmas PageHead copy — safe to import from product pages. */

export const CHRISTMAS_PAGEHEAD_ORIGIN = "https://www.thedigitalgifter.com";

export function christmasPageUrl(path: string): string {
  return `${CHRISTMAS_PAGEHEAD_ORIGIN}${path}`;
}

export const CHRISTMAS_GIFT_FINDER_SEO = {
  title: "Christmas Gift Finder",
  description:
    "Find a Christmas gift they'll actually love — guided ideas for any recipient and budget.",
  path: "/christmas/gift-finder",
  aliasPaths: ["/christmas/gifts"],
} as const;

export const CHRISTMAS_CARDS_SEO = {
  title: "Personalized Christmas Cards",
  description:
    "Turn your photo and Christmas message into a card worth sending. Free digital Christmas cards — square, story, and landscape.",
  path: "/christmas/cards",
} as const;

export const CHRISTMAS_MESSAGES_SEO = {
  title: "Christmas Message Generator",
  description:
    "Find the right Christmas words in seconds. Warm, funny, romantic, or professional messages in English and Romanian.",
  path: "/christmas/messages",
} as const;

export const CHRISTMAS_ADVENT_SEO = {
  title: "Christmas Advent Calendar",
  description:
    "Open a daily Christmas door from December 1. Sign in to claim rewards when the season is live.",
  path: "/christmas/advent",
} as const;

export const CHRISTMAS_TREE_CREATOR_SEO = {
  title: "Build Your Christmas Tree",
  description:
    "Create, decorate, and securely share a personalized Christmas tree with gifts under it.",
  path: "/christmas/tree",
} as const;

export const CHRISTMAS_TREE_SHARE_SEO = {
  title: "A Christmas Tree is waiting for you",
  description: "Someone made you a Christmas tree — tap a gift.",
  indexable: false as const,
};

/** Personal share URLs — noindex so private trees/lists stay out of search. */
export const CHRISTMAS_SHARE_NOINDEX_PREFIXES = ["/christmas/tree/", "/wishlist/"] as const;

export function isChristmasSharePath(pathname: string): boolean {
  const path = pathname.split("?")[0];
  return CHRISTMAS_SHARE_NOINDEX_PREFIXES.some(
    (prefix) => path.startsWith(prefix) && path.length > prefix.length,
  );
}
