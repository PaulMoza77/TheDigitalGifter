import { ADVENT_ASSETS } from "./assets";
import { ADVENT_FAQS, adventT, type AdventLocale } from "./copy";

export const ADVENT_PATH = "/christmas/advent";
export const ADVENT_SITE_ORIGIN = "https://www.thedigitalgifter.com";

export function adventSeo(locale: AdventLocale = "en") {
  return {
    title: adventT("seo.title", locale),
    description: adventT("seo.description", locale),
    url: `${ADVENT_SITE_ORIGIN}${ADVENT_PATH}`,
    image: `${ADVENT_SITE_ORIGIN}${ADVENT_ASSETS.og}`,
  };
}

export function adventJsonLd(locale: AdventLocale = "en") {
  const seo = adventSeo(locale);
  const faqs = ADVENT_FAQS.map((item) => ({
    "@type": "Question",
    name: adventT(item.qKey, locale),
    acceptedAnswer: {
      "@type": "Answer",
      text: adventT(item.aKey, locale),
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
        isPartOf: { "@id": `${ADVENT_SITE_ORIGIN}/#website` },
        primaryImageOfPage: {
          "@type": "ImageObject",
          url: seo.image,
        },
        breadcrumb: {
          "@type": "BreadcrumbList",
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: "Christmas",
              item: `${ADVENT_SITE_ORIGIN}/christmas`,
            },
            {
              "@type": "ListItem",
              position: 2,
              name: adventT("seo.h1", locale),
              item: seo.url,
            },
          ],
        },
      },
      {
        "@type": "WebApplication",
        name: adventT("seo.h1", locale),
        applicationCategory: "EntertainmentApplication",
        operatingSystem: "Web",
        description: seo.description,
        url: seo.url,
        offers: {
          "@type": "Offer",
          availability: "https://schema.org/InStock",
          priceCurrency: "EUR",
          price: "0",
        },
      },
      {
        "@type": "FAQPage",
        mainEntity: faqs,
      },
    ],
  };
}

export { upsertJsonLd } from "../landing/seo";
