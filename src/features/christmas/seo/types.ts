export type ChristmasSeoLocale = "en" | "ro";

export type ChristmasSeoCluster = "gifts-for" | "messages-for" | "messages-intent";

export type ChristmasSeoPageType =
  | "christmas-gifts-for"
  | "christmas-messages-for"
  | "christmas-messages-intent";

export type SeoBenefit = {
  title: string;
  text: string;
};

export type SeoFaqItem = {
  question: string;
  answer: string;
};

export type SeoRelatedPage = {
  label: string;
  url: string;
};

export type SeoSectionItem = {
  title: string;
  text: string;
};

export type SeoSection = {
  heading: string;
  body: string;
  items?: SeoSectionItem[];
};

export type ChristmasSeoLocaleCopy = {
  title: string;
  metaTitle: string;
  metaDescription: string;
  h1: string;
  intro: string;
  imageAlt: string;
  ctaText: string;
  benefits: SeoBenefit[];
  faq: SeoFaqItem[];
  sections: SeoSection[];
  relatedPages: SeoRelatedPage[];
};

export type ChristmasSeoSpec = {
  cluster: ChristmasSeoCluster;
  pageType: ChristmasSeoPageType;
  slug: string;
  canonicalPath: string;
  ctaHref: string;
  recipientKey?: string;
  en: ChristmasSeoLocaleCopy;
  ro: ChristmasSeoLocaleCopy;
};

export type ChristmasSeoPageRow = {
  page_type: ChristmasSeoPageType;
  slug: string;
  locale: ChristmasSeoLocale;
  cluster: ChristmasSeoCluster;
  canonical_path: string;
  title: string;
  meta_title: string;
  meta_description: string;
  h1: string;
  intro: string;
  cta_text: string;
  cta_href: string;
  benefits: SeoBenefit[];
  faq: SeoFaqItem[];
  related_pages: SeoRelatedPage[];
  sections: SeoSection[];
  hero_image_url: string;
  image_alt: string;
  is_active: boolean;
};

export type ParsedChristmasSeoPath = {
  locale: ChristmasSeoLocale;
  cluster: ChristmasSeoCluster;
  slug: string;
  canonicalPath: string;
};

export const CHRISTMAS_SEO_SITE_ORIGIN = "https://thedigitalgifter.com";
export const CHRISTMAS_SEO_OG_IMAGE =
  "https://thedigitalgifter.com/assets/christmas/christmas_hero_room.webp";

export const THIN_PAGE_LIMITS = {
  intro: 400,
  metaDescription: 140,
  sections: 3,
  sectionBody: 160,
  faq: 3,
  faqAnswer: 80,
  benefits: 3,
  benefitText: 60,
  related: 3,
  ideaItems: 4,
} as const;
