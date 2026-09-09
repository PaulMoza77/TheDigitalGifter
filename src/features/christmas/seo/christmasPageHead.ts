/**
 * CHRISTMAS-032 — Per-vertical SPA PageHead SEO basics.
 *
 * Each live Christmas surface sets a unique title, description, canonical, and OG
 * via the existing client `PageHead` manager.
 *
 * Known limitation: client-updated tags are not SSR HTML. Crawlers that do not
 * execute JavaScript see the generic `index.html` shell. Programmatic factory
 * pages (`/christmas/gifts-for-*`, `/christmas/messages-for-*`) are CHRISTMAS-033
 * and are out of scope here.
 */

import { christmasLandingSeo, CHRISTMAS_SITE_ORIGIN } from "../landing/seo";
import { CHRISTMAS_PORTRAIT_VERTICALS } from "../portraitVerticals";
import { CHRISTMAS_ROUTE_SHELLS } from "../routes";
import { SANTA_COPY } from "../santa/santaCopy";
import { WISHLIST_COPY_EN } from "../wishlist/copy";

export const CHRISTMAS_PAGEHEAD_ORIGIN = CHRISTMAS_SITE_ORIGIN;

export type ChristmasSpaSeoEntry = {
  id: string;
  /** Canonical path (no query, no trailing slash except hub-only `/christmas`). */
  path: string;
  title: string;
  description: string;
  canonical: string;
  /** Product/hub pages are indexable; share + unfinished shells are not. */
  indexable: boolean;
  pageFile: string;
};

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

const hub = christmasLandingSeo("en");

const portraitEntries: ChristmasSpaSeoEntry[] = Object.values(CHRISTMAS_PORTRAIT_VERTICALS).map(
  (vertical) => ({
    id: `portrait-${vertical.id}`,
    path: vertical.routePath,
    title: vertical.pageTitle,
    description: vertical.metaDescription,
    canonical: christmasPageUrl(vertical.routePath),
    indexable: true,
    pageFile: "src/features/christmas/ChristmasPortraitFunnelPage.tsx",
  }),
);

const kidsShell = CHRISTMAS_ROUTE_SHELLS.find((s) => s.path === "/christmas/kids");

export const CHRISTMAS_SPA_SEO: ChristmasSpaSeoEntry[] = [
  {
    id: "hub",
    path: "/christmas",
    title: hub.title,
    description: hub.description,
    canonical: hub.url,
    indexable: true,
    pageFile: "src/pages/website/ChristmasPage.tsx",
  },
  ...portraitEntries,
  {
    id: "santa-video",
    path: "/christmas/santa-video",
    title: SANTA_COPY.seo.title,
    description: SANTA_COPY.seo.description,
    canonical: SANTA_COPY.seo.canonical,
    indexable: true,
    pageFile: "src/features/christmas/ChristmasSantaVideoPage.tsx",
  },
  {
    id: "tree",
    path: CHRISTMAS_TREE_CREATOR_SEO.path,
    title: CHRISTMAS_TREE_CREATOR_SEO.title,
    description: CHRISTMAS_TREE_CREATOR_SEO.description,
    canonical: christmasPageUrl(CHRISTMAS_TREE_CREATOR_SEO.path),
    indexable: true,
    pageFile: "src/features/christmas/ChristmasTreePage.tsx",
  },
  {
    id: "advent",
    path: CHRISTMAS_ADVENT_SEO.path,
    title: CHRISTMAS_ADVENT_SEO.title,
    description: CHRISTMAS_ADVENT_SEO.description,
    canonical: christmasPageUrl(CHRISTMAS_ADVENT_SEO.path),
    indexable: true,
    pageFile: "src/features/christmas/ChristmasAdventPage.tsx",
  },
  {
    id: "wishlist",
    path: "/christmas/wishlist",
    title: WISHLIST_COPY_EN.seoTitle,
    description: WISHLIST_COPY_EN.seoDescription,
    canonical: christmasPageUrl("/christmas/wishlist"),
    indexable: true,
    pageFile: "src/features/christmas/ChristmasWishlistPage.tsx",
  },
  {
    id: "gift-finder",
    path: CHRISTMAS_GIFT_FINDER_SEO.path,
    title: CHRISTMAS_GIFT_FINDER_SEO.title,
    description: CHRISTMAS_GIFT_FINDER_SEO.description,
    canonical: christmasPageUrl(CHRISTMAS_GIFT_FINDER_SEO.path),
    indexable: true,
    pageFile: "src/features/christmas/ChristmasGiftFinderPage.tsx",
  },
  {
    id: "cards",
    path: CHRISTMAS_CARDS_SEO.path,
    title: CHRISTMAS_CARDS_SEO.title,
    description: CHRISTMAS_CARDS_SEO.description,
    canonical: christmasPageUrl(CHRISTMAS_CARDS_SEO.path),
    indexable: true,
    pageFile: "src/features/christmas/ChristmasCardsPage.tsx",
  },
  {
    id: "messages",
    path: CHRISTMAS_MESSAGES_SEO.path,
    title: CHRISTMAS_MESSAGES_SEO.title,
    description: CHRISTMAS_MESSAGES_SEO.description,
    canonical: christmasPageUrl(CHRISTMAS_MESSAGES_SEO.path),
    indexable: true,
    pageFile: "src/features/christmas/ChristmasMessagesPage.tsx",
  },
  {
    id: "kids",
    path: "/christmas/kids",
    title: kidsShell?.title ?? "Kids Christmas Generator",
    description:
      kidsShell?.description ??
      "This product is not available yet. Privacy controls are required before launch.",
    canonical: christmasPageUrl("/christmas/kids"),
    indexable: false,
    pageFile: "src/features/christmas/components/ChristmasFeatureShell.tsx",
  },
];

export const CHRISTMAS_INDEXABLE_SEO = CHRISTMAS_SPA_SEO.filter((entry) => entry.indexable);

export function isChristmasSharePath(pathname: string): boolean {
  const path = pathname.split("?")[0];
  return CHRISTMAS_SHARE_NOINDEX_PREFIXES.some(
    (prefix) => path.startsWith(prefix) && path.length > prefix.length,
  );
}

export function resolveChristmasSpaSeo(pathname: string): ChristmasSpaSeoEntry | null {
  const path = (pathname.split("?")[0].replace(/\/$/, "") || "/") as string;
  if (path === "/christmas/gifts") {
    return CHRISTMAS_SPA_SEO.find((entry) => entry.id === "gift-finder") ?? null;
  }
  if (isChristmasSharePath(path)) {
    const isTree = path.startsWith("/christmas/tree/");
    return {
      id: isTree ? "tree-share" : "wishlist-share",
      path,
      title: isTree ? CHRISTMAS_TREE_SHARE_SEO.title : WISHLIST_COPY_EN.shareSeoTitle("Christmas Wishlist"),
      description: isTree
        ? CHRISTMAS_TREE_SHARE_SEO.description
        : WISHLIST_COPY_EN.shareSeoDescription("Christmas Wishlist"),
      canonical: christmasPageUrl(path),
      indexable: false,
      pageFile: isTree
        ? "src/features/christmas/ChristmasTreePage.tsx"
        : "src/features/christmas/ChristmasWishlistPage.tsx",
    };
  }
  return CHRISTMAS_SPA_SEO.find((entry) => entry.path === path) ?? null;
}
