/**
 * Christmas Club campaign configuration — single source of truth.
 * Countdown target, copy, analytics product key, and storage keys live here
 * so future years can be switched without hunting through components.
 */

export const CHRISTMAS_CLUB_ROUTE = "/christmas";
export const CHRISTMAS_CLUB_SUITE_ROUTE = "/christmas/suite";
export const CHRISTMAS_CLUB_GIFTS_ROUTE = "/christmas/tree-gifts";
export const CHRISTMAS_CLUB_SIGNUP_PATH = "/api/christmas/club-signup";
export const CHRISTMAS_CLUB_MAX_BODY_BYTES = 4096;

export const CHRISTMAS_CLUB_JOINED_STORAGE_KEY = "tdg.christmas.club.joined.v1";
export const CHRISTMAS_CLUB_GOOGLE_PENDING_KEY = "tdg.christmas.club.google.pending.v1";
export const CHRISTMAS_CLUB_AUTH_RETURN_PATH = "/christmas";

export const CHRISTMAS_CLUB_PRODUCT_KEY = "christmas_club";
export const CHRISTMAS_CLUB_CAMPAIGN_KEY = "christmas_club";
export const CHRISTMAS_CLUB_SOURCE = "christmas_club_landing";

/**
 * Christmas morning the visitor is counting down to.
 * `timeZone: "local"` uses the visitor's local midnight so Christmas arrives
 * when it actually begins for them. Named IANA zones are supported for tests
 * and future campaign overrides.
 */
export const CHRISTMAS_CLUB_CONFIG = {
  campaignKey: CHRISTMAS_CLUB_CAMPAIGN_KEY,
  campaignYear: 2026,
  month: 12,
  day: 25,
  hour: 0,
  minute: 0,
  second: 0,
  timeZone: "local" as const,
  source: CHRISTMAS_CLUB_SOURCE,
  productKey: CHRISTMAS_CLUB_PRODUCT_KEY,
} as const;

export type ChristmasClubTimeZone = "local" | (string & {});

export type ChristmasClubConfig = {
  campaignKey: string;
  campaignYear: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  timeZone: ChristmasClubTimeZone;
  source: string;
  productKey: string;
};

/** Desktop cabin loop vs dedicated 720p mobile loop. Keep in sync with index.html boot. */
export const CHRISTMAS_CLUB_DESKTOP_MEDIA = "(min-width: 901px)";

export const CHRISTMAS_CLUB_ASSETS = {
  hero: "/christmas/cabin-hero-1920.webp",
  hero1280: "/christmas/cabin-hero-1280.webp",
  hero1920: "/christmas/cabin-hero-1920.webp",
  hero2560: "/christmas/cabin-hero-2560.webp",
  hero1280Jpg: "/christmas/cabin-hero-1280.jpg",
  hero1920Jpg: "/christmas/cabin-hero-1920.jpg",
  hero2560Jpg: "/christmas/cabin-hero-2560.jpg",
  // Cache-bust when the Seedance living loop is replaced.
  heroLoop: "/christmas/cabin-hero-loop.mp4?v=seedance1",
  heroLoop720: "/christmas/cabin-hero-loop-720.mp4?v=seedance1",
  tree: "/christmas/cabin-hero-1280.webp",
  gifts: "/christmas/gifts-still-life.png",
  og: "/christmas/og-countdown.jpg",
} as const;

export type ChristmasClubCountdownUnit = "days" | "hours" | "minutes" | "seconds";

/** One Christmas product sits inside each countdown unit — display-sized WebP thumbs. */
export const CHRISTMAS_CLUB_COUNTDOWN_PRODUCTS = [
  {
    unit: "days" as const,
    productKey: "christmas_family",
    name: "Family",
    href: "/christmas/family",
    image: "/christmas/prints/family-480.webp",
    imageSrcSet: "/christmas/prints/family-240.webp 240w, /christmas/prints/family-480.webp 480w",
  },
  {
    unit: "hours" as const,
    productKey: "christmas_photo",
    name: "Portraits",
    href: "/christmas/photo-generator",
    image: "/christmas/prints/portraits-480.webp",
    imageSrcSet: "/christmas/prints/portraits-240.webp 240w, /christmas/prints/portraits-480.webp 480w",
  },
  {
    unit: "minutes" as const,
    productKey: "christmas_pet",
    name: "Pets",
    href: "/christmas/pets",
    image: "/christmas/prints/pets-480.webp",
    imageSrcSet: "/christmas/prints/pets-240.webp 240w, /christmas/prints/pets-480.webp 480w",
  },
  {
    unit: "seconds" as const,
    productKey: "christmas_card",
    name: "Cards",
    href: "/christmas/cards",
    image: "/christmas/prints/cards-480.webp",
    imageSrcSet: "/christmas/prints/cards-240.webp 240w, /christmas/prints/cards-480.webp 480w",
  },
] as const;

export const CHRISTMAS_CLUB_SEO = {
  title: "Christmas at TheDigitalGifter | Gifts, Photos, Santa & More",
  description:
    "Create Christmas gifts, AI portraits, Santa videos, wishlists, cards, and advent surprises — personalized digital Christmas experiences from TheDigitalGifter.",
  canonical: "https://www.thedigitalgifter.com/christmas",
  ogImage: "https://www.thedigitalgifter.com/christmas/og-countdown.jpg",
} as const;
