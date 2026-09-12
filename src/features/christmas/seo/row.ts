import type { ChristmasSeoLocale, ChristmasSeoPageRow } from "./types";

export const CHRISTMAS_SEO_SELECT =
  "page_type,slug,locale,cluster,canonical_path,title,meta_title,meta_description,h1,intro,cta_text,cta_href,benefits,faq,related_pages,sections,hero_image_url,image_alt,is_active";

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function normalizeSeoPageRow(data: Record<string, unknown>): ChristmasSeoPageRow {
  return {
    page_type: data.page_type as ChristmasSeoPageRow["page_type"],
    slug: String(data.slug || ""),
    locale: (data.locale === "ro" ? "ro" : "en") as ChristmasSeoLocale,
    cluster: data.cluster as ChristmasSeoPageRow["cluster"],
    canonical_path: String(data.canonical_path || ""),
    title: String(data.title || ""),
    meta_title: String(data.meta_title || ""),
    meta_description: String(data.meta_description || ""),
    h1: String(data.h1 || ""),
    intro: String(data.intro || ""),
    cta_text: String(data.cta_text || ""),
    cta_href: String(data.cta_href || "/christmas"),
    benefits: asArray(data.benefits),
    faq: asArray(data.faq),
    related_pages: asArray(data.related_pages),
    sections: asArray(data.sections),
    hero_image_url: String(data.hero_image_url || ""),
    image_alt: String(data.image_alt || ""),
    is_active: data.is_active !== false,
  };
}
