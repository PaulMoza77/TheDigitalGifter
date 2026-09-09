import {
  PHOTO_GEN_FAQS,
  photoGenT,
  type PhotoGenLocale,
} from "./copy";
import { PHOTO_GEN_ASSETS } from "./assets";

export const PHOTO_GEN_PATH = "/christmas/photo-generator";
export const PHOTO_GEN_SITE_ORIGIN = "https://www.thedigitalgifter.com";

export function photoGeneratorSeo(locale: PhotoGenLocale = "en") {
  return {
    title: photoGenT("seo.title", locale),
    description: photoGenT("seo.description", locale),
    url: `${PHOTO_GEN_SITE_ORIGIN}${PHOTO_GEN_PATH}`,
    image: `${PHOTO_GEN_SITE_ORIGIN}${PHOTO_GEN_ASSETS.familyAfter}`,
  };
}

export function photoGeneratorJsonLd(locale: PhotoGenLocale = "en") {
  const seo = photoGeneratorSeo(locale);
  const faqs = PHOTO_GEN_FAQS.map((item) => ({
    "@type": "Question",
    name: photoGenT(item.qKey, locale),
    acceptedAnswer: {
      "@type": "Answer",
      text: photoGenT(item.aKey, locale),
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
        isPartOf: { "@id": `${PHOTO_GEN_SITE_ORIGIN}/#website` },
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
              item: `${PHOTO_GEN_SITE_ORIGIN}/christmas`,
            },
            {
              "@type": "ListItem",
              position: 2,
              name: photoGenT("seo.h1", locale),
              item: seo.url,
            },
          ],
        },
      },
      {
        "@type": "SoftwareApplication",
        name: photoGenT("seo.h1", locale),
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
