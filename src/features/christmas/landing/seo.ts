import { christmasPathForLocale, type ChristmasLocaleCode } from "@/features/christmas/seo/localeRouting";
import { landingT, type ChristmasLandingLocale } from "./copy";

export const CHRISTMAS_LANDING_PATH = "/christmas";
export const CHRISTMAS_SITE_ORIGIN = "https://www.thedigitalgifter.com";

export const LANDING_FAQS = [
  { qKey: "faq.1.q", aKey: "faq.1.a" },
  { qKey: "faq.2.q", aKey: "faq.2.a" },
  { qKey: "faq.3.q", aKey: "faq.3.a" },
  { qKey: "faq.4.q", aKey: "faq.4.a" },
  { qKey: "faq.5.q", aKey: "faq.5.a" },
  { qKey: "faq.6.q", aKey: "faq.6.a" },
  { qKey: "faq.7.q", aKey: "faq.7.a" },
  { qKey: "faq.8.q", aKey: "faq.8.a" },
] as const;

export const LANDING_INTERNAL_LINKS = [
  { href: "/christmas/tree-gifts", labelKey: "nav.gifts" },
  { href: "/christmas/gift-finder", labelKey: "nav.finder" },
  { href: "/christmas/family", labelKey: "nav.portraits" },
  { href: "/christmas/santa-video", labelKey: "nav.santa" },
  { href: "/christmas/wishlist", labelKey: "nav.wishlist" },
  { href: "/christmas/tree", labelKey: "nav.tree" },
  { href: "/christmas/advent", labelKey: "nav.advent" },
  { href: "/christmas/cards", labelKey: "nav.cards" },
  { href: "/christmas/messages", labelKey: "nav.messages" },
  { href: "/generator?occasion=christmas", labelKey: "hero.cta" },
] as const;

function landingPublicPath(locale: ChristmasLandingLocale): string {
  return christmasPathForLocale(CHRISTMAS_LANDING_PATH, locale as ChristmasLocaleCode);
}

export function christmasLandingSeo(locale: ChristmasLandingLocale = "en") {
  return {
    title: landingT("seo.title", locale),
    description: landingT("seo.description", locale),
    url: `${CHRISTMAS_SITE_ORIGIN}${landingPublicPath(locale)}`,
    image: `${CHRISTMAS_SITE_ORIGIN}/christmas/cabin-hero-1920.webp`,
  };
}

export function christmasLandingJsonLd(locale: ChristmasLandingLocale = "en") {
  const seo = christmasLandingSeo(locale);
  const faqs = LANDING_FAQS.map((item) => ({
    "@type": "Question",
    name: landingT(item.qKey, locale),
    acceptedAnswer: {
      "@type": "Answer",
      text: landingT(item.aKey, locale),
    },
  }));

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
        isPartOf: { "@id": `${CHRISTMAS_SITE_ORIGIN}/#website` },
        primaryImageOfPage: {
          "@type": "ImageObject",
          url: seo.image,
        },
      },
      {
        "@type": "ItemList",
        name: "Christmas experiences by The Digital Gifter",
        itemListElement: LANDING_INTERNAL_LINKS.map((link, index) => {
          const href = link.href.startsWith("/christmas")
            ? christmasPathForLocale(link.href.split("?")[0], locale as ChristmasLocaleCode) +
              (link.href.includes("?") ? `?${link.href.split("?")[1]}` : "")
            : link.href;
          return {
            "@type": "ListItem",
            position: index + 1,
            name: landingT(link.labelKey, locale),
            url: `${CHRISTMAS_SITE_ORIGIN}${href}`,
          };
        }),
      },
      {
        "@type": "FAQPage",
        mainEntity: faqs,
      },
    ],
  };
}

export function upsertJsonLd(id: string, data: Record<string, unknown>) {
  if (typeof document === "undefined") return;
  let script = document.getElementById(id) as HTMLScriptElement | null;
  if (!script) {
    script = document.createElement("script");
    script.type = "application/ld+json";
    script.id = id;
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(data);
}
