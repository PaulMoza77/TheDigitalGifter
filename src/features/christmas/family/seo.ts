import { FAMILY_FAQS, familyT, type FamilyLocale } from "./copy";
import { FAMILY_ASSETS } from "./assets";

export const FAMILY_PATH = "/christmas/family";
export const FAMILY_SITE_ORIGIN = "https://www.thedigitalgifter.com";

export function familyPortraitSeo(locale: FamilyLocale = "en") {
  return {
    title: familyT("seo.title", locale),
    description: familyT("seo.description", locale),
    url: `${FAMILY_SITE_ORIGIN}${FAMILY_PATH}`,
    image: `${FAMILY_SITE_ORIGIN}${FAMILY_ASSETS.familyAfter}`,
  };
}

export function familyPortraitJsonLd(locale: FamilyLocale = "en") {
  const seo = familyPortraitSeo(locale);
  const faqs = FAMILY_FAQS.map((item) => ({
    "@type": "Question",
    name: familyT(item.qKey, locale),
    acceptedAnswer: {
      "@type": "Answer",
      text: familyT(item.aKey, locale),
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
        isPartOf: { "@id": `${FAMILY_SITE_ORIGIN}/#website` },
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
              item: `${FAMILY_SITE_ORIGIN}/christmas`,
            },
            {
              "@type": "ListItem",
              position: 2,
              name: familyT("seo.h1", locale),
              item: seo.url,
            },
          ],
        },
      },
      {
        "@type": "SoftwareApplication",
        name: "Christmas Family Photo Generator",
        applicationCategory: "MultimediaApplication",
        operatingSystem: "Web",
        description: seo.description,
        url: seo.url,
        offers: {
          "@type": "Offer",
          availability: "https://schema.org/PreOrder",
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
