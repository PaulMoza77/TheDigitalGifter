import { gfT, type GiftFinderLocale } from "./copy";
import { SEO_TAXONOMY_LINKS, seoGiftPath, labelFor, type LocaleCode } from "../wishlist/taxonomy";
import { upsertJsonLd } from "../landing/seo";

export const GIFT_FINDER_PATH = "/christmas/gift-finder";
export const GIFT_FINDER_ORIGIN = "https://www.thedigitalgifter.com";

export const GIFT_FINDER_FAQS = [
  {
    q: "How does the Christmas Gift Finder work?",
    a: "You answer a few quick questions about who you’re shopping for, their age, interests, personality and your budget. We then show curated gift ideas with a clear reason why each one fits.",
  },
  {
    q: "Is the Gift Finder free?",
    a: "Yes. The Christmas Gift Finder is free to use. Some personalized TDG products you may choose later have their own pricing.",
  },
  {
    q: "Can I search by budget?",
    a: "Yes. You can choose budget ranges such as under $25, $50–$100, $100–$200, $200+, or no strict budget. Currency labels follow your locale where available.",
  },
  {
    q: "Can I find a gift for someone who has everything?",
    a: "Yes. Choosing “Has everything” biases recommendations toward experiences, personalization, hobby upgrades and meaningful keepsakes — not generic clutter.",
  },
  {
    q: "Can I find gifts for teenagers?",
    a: "Yes. You can choose Teen (or Daughter/Son with a teen age range) and interests like music, fashion, gaming or tech.",
  },
  {
    q: "Can I find gifts for coworkers?",
    a: "Yes. Pick Coworker as the recipient and we’ll keep ideas appropriately thoughtful for a workplace relationship.",
  },
  {
    q: "Can I save ideas to a wishlist?",
    a: "Yes. Use Save to Wishlist on any idea to add it to your Christmas Wishlist at /christmas/wishlist.",
  },
  {
    q: "Does the Gift Finder recommend personalized gifts?",
    a: "When it fits the person — especially sentimental or “loves personalized gifts” profiles — we include personalized and meaningful options, including occasional TDG keepsakes.",
  },
  {
    q: "Can I change my answers?",
    a: "Yes. You can go back through the steps, refine results with quick feedback chips, or start over without losing your wishlist.",
  },
  {
    q: "Does it show real products?",
    a: "Today the finder shows curated gift ideas with typical price ranges. Live retailer prices, availability, and shop feeds are not connected yet — we do not invent exact stock or merchant prices.",
  },
] as const;

export const GIFT_FINDER_GEO = [
  {
    q: "How does it work?",
    a: "Answer a short guided questionnaire, then review ranked gift ideas with explanations. You can refine, save ideas, or explore personalized TDG alternatives.",
  },
  {
    q: "Can I search by budget?",
    a: "Yes — budget is one of the core filters in the Gift Finder.",
  },
  {
    q: "Can I find gifts for someone who has everything?",
    a: "Yes. Personality options include “Has everything,” which steers results toward experiences and meaningful gifts.",
  },
  {
    q: "Can I save gift ideas?",
    a: "Yes. Each idea can be saved directly to your Christmas Wishlist.",
  },
  {
    q: "Are recommendations personalized?",
    a: "Yes. Recommendations are based on recipient, age, interests, personality, budget and an optional personal detail you provide.",
  },
  {
    q: "Can I find gifts for kids?",
    a: "Yes. Choose Child (or Daughter/Son) and an age range so ideas stay age-appropriate.",
  },
  {
    q: "Can I use it for coworkers?",
    a: "Yes. Coworker is a supported recipient type with workplace-appropriate ideas.",
  },
] as const;

export function giftFinderSeo(locale: GiftFinderLocale = "en") {
  return {
    title: gfT("seo.title", locale),
    description: gfT("seo.description", locale),
    url: `${GIFT_FINDER_ORIGIN}${GIFT_FINDER_PATH}`,
    image: `${GIFT_FINDER_ORIGIN}/assets/christmas/christmas_hero_room.webp`,
  };
}

export function giftFinderJsonLd(locale: GiftFinderLocale = "en") {
  const seo = giftFinderSeo(locale);
  const loc = locale as LocaleCode;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${seo.url}#webpage`,
        url: seo.url,
        name: seo.title,
        description: seo.description,
        inLanguage: locale,
        isPartOf: { "@id": `${GIFT_FINDER_ORIGIN}/#website` },
        breadcrumb: {
          "@type": "BreadcrumbList",
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: "Christmas",
              item: `${GIFT_FINDER_ORIGIN}/christmas`,
            },
            {
              "@type": "ListItem",
              position: 2,
              name: "Gift Finder",
              item: seo.url,
            },
          ],
        },
      },
      {
        "@type": "FAQPage",
        mainEntity: GIFT_FINDER_FAQS.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: { "@type": "Answer", text: item.a },
        })),
      },
      {
        "@type": "ItemList",
        name: "Christmas gift ideas by recipient",
        itemListElement: SEO_TAXONOMY_LINKS.byRecipient.map((link, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: loc === "ro" ? link.labelRo : link.labelEn,
          url: `${GIFT_FINDER_ORIGIN}${taxonomyHref(link.slug)}`,
        })),
      },
    ],
  };
}

export function applyGiftFinderJsonLd(locale: GiftFinderLocale = "en") {
  upsertJsonLd("gift-finder-jsonld", giftFinderJsonLd(locale));
}

export function taxonomyHref(slug: string): string {
  // Future programmatic pages; for now deep-link into the finder with query intent.
  return `${GIFT_FINDER_PATH}?intent=${encodeURIComponent(slug)}`;
}

export { SEO_TAXONOMY_LINKS, seoGiftPath, labelFor };
