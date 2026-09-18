import { PLANNER_FAQS } from "./copy";

export const PLANNER_PATH = "/christmas/planner";
export const PLANNER_SITE_ORIGIN = "https://www.thedigitalgifter.com";

export function plannerSeo() {
  return {
    title: "Christmas Planner 2026 | Online Christmas Planning | TheDigitalGifter",
    description:
      "Plan gifts, budget, meals, hosting, cards, and traditions in one interactive Christmas Planner. Not a PDF. Built for phone-first Christmas planning.",
    url: `${PLANNER_SITE_ORIGIN}${PLANNER_PATH}`,
    image: `${PLANNER_SITE_ORIGIN}/christmas/cabin-hero-1920.webp`,
  };
}

export function plannerJsonLd() {
  const seo = plannerSeo();
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${seo.url}#webpage`,
        url: seo.url,
        name: seo.title,
        description: seo.description,
        inLanguage: "en",
        isPartOf: { "@id": `${PLANNER_SITE_ORIGIN}/#website` },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${PLANNER_SITE_ORIGIN}/` },
          { "@type": "ListItem", position: 2, name: "Christmas", item: `${PLANNER_SITE_ORIGIN}/christmas` },
          { "@type": "ListItem", position: 3, name: "Christmas Planner", item: seo.url },
        ],
      },
      {
        "@type": "Product",
        name: "Christmas Planner by The Digital Gifter",
        description: seo.description,
        brand: { "@type": "Brand", name: "The Digital Gifter" },
        category: "Digital Christmas planner",
      },
      {
        "@type": "FAQPage",
        mainEntity: PLANNER_FAQS.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: { "@type": "Answer", text: item.a },
        })),
      },
    ],
  };
}

export { upsertJsonLd } from "../landing/seo";
