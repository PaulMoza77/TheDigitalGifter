import { CLUSTER_SPECS } from "./clusterCopy";
import {
  CHRISTMAS_SEO_OG_IMAGE,
  CHRISTMAS_SEO_SITE_ORIGIN,
  THIN_PAGE_LIMITS,
  type ChristmasSeoCluster,
  type ChristmasSeoLocale,
  type ChristmasSeoPageRow,
  type ChristmasSeoSpec,
  type ParsedChristmasSeoPath,
} from "./types";

const GIFT_PREFIX = "gifts-for-";
const MESSAGE_PREFIX = "messages-for-";

const INTENT_SLUGS = new Set(
  CLUSTER_SPECS.filter((spec) => spec.cluster === "messages-intent").map((spec) => spec.slug),
);

const SPEC_BY_PATH = new Map(CLUSTER_SPECS.map((spec) => [spec.canonicalPath, spec]));

export function christmasSeoSpecs(): readonly ChristmasSeoSpec[] {
  return CLUSTER_SPECS;
}

export function specForCanonicalPath(path: string): ChristmasSeoSpec | null {
  return SPEC_BY_PATH.get(normalizeCanonicalPath(path)) ?? null;
}

export function localizePath(canonicalPath: string, locale: ChristmasSeoLocale): string {
  const path = normalizeCanonicalPath(canonicalPath);
  return locale === "ro" ? `/ro${path}` : path;
}

export function absoluteUrl(path: string): string {
  return `${CHRISTMAS_SEO_SITE_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
}

export function normalizeCanonicalPath(path: string): string {
  const raw = String(path || "").split("?")[0] || "/";
  if (raw === "/ro" || raw.startsWith("/ro/")) {
    const stripped = raw.slice(3) || "/";
    return stripped.startsWith("/") ? stripped : `/${stripped}`;
  }
  return raw.startsWith("/") ? raw : `/${raw}`;
}

export function parseChristmasSeoPath(pathname: string): ParsedChristmasSeoPath | null {
  const raw = String(pathname || "").split("?")[0] || "/";
  const locale: ChristmasSeoLocale = raw === "/ro" || raw.startsWith("/ro/") ? "ro" : "en";
  const path = normalizeCanonicalPath(raw);
  const parts = path.split("/").filter(Boolean);
  if (parts.length !== 2 || parts[0] !== "christmas") return null;

  const leaf = parts[1];
  if (leaf.startsWith(GIFT_PREFIX)) {
    const slug = leaf.slice(GIFT_PREFIX.length);
    if (!slug) return null;
    return { locale, cluster: "gifts-for", slug, canonicalPath: `/christmas/${GIFT_PREFIX}${slug}` };
  }
  if (leaf.startsWith(MESSAGE_PREFIX)) {
    const slug = leaf.slice(MESSAGE_PREFIX.length);
    if (!slug) return null;
    return {
      locale,
      cluster: "messages-for",
      slug,
      canonicalPath: `/christmas/${MESSAGE_PREFIX}${slug}`,
    };
  }
  if (INTENT_SLUGS.has(leaf)) {
    return {
      locale,
      cluster: "messages-intent",
      slug: leaf,
      canonicalPath: `/christmas/${leaf}`,
    };
  }
  return null;
}

export function isChristmasSeoPath(pathname: string): boolean {
  return parseChristmasSeoPath(pathname) !== null;
}

export function clusterFromPageType(pageType: string): ChristmasSeoCluster | null {
  if (pageType === "christmas-gifts-for") return "gifts-for";
  if (pageType === "christmas-messages-for") return "messages-for";
  if (pageType === "christmas-messages-intent") return "messages-intent";
  return null;
}

export function buildClusterRows(specs: readonly ChristmasSeoSpec[] = CLUSTER_SPECS): ChristmasSeoPageRow[] {
  const rows: ChristmasSeoPageRow[] = [];
  for (const spec of specs) {
    for (const locale of ["en", "ro"] as const) {
      const copy = spec[locale];
      rows.push({
        page_type: spec.pageType,
        slug: spec.slug,
        locale,
        cluster: spec.cluster,
        canonical_path: spec.canonicalPath,
        title: copy.title,
        meta_title: copy.metaTitle,
        meta_description: copy.metaDescription,
        h1: copy.h1,
        intro: copy.intro,
        cta_text: copy.ctaText,
        cta_href: spec.ctaHref,
        benefits: copy.benefits,
        faq: copy.faq,
        related_pages: copy.relatedPages,
        sections: copy.sections,
        hero_image_url: CHRISTMAS_SEO_OG_IMAGE,
        image_alt: copy.imageAlt,
        is_active: true,
      });
    }
  }
  return rows;
}

export type ThinPageIssue = {
  path: string;
  locale: ChristmasSeoLocale;
  reason: string;
};

export function findThinPageIssues(rows: ChristmasSeoPageRow[]): ThinPageIssue[] {
  const issues: ThinPageIssue[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const label = `${row.canonical_path} [${row.locale}]`;
    const uniqueKey = `${row.page_type}:${row.slug}:${row.locale}`;
    if (seen.has(uniqueKey)) issues.push({ path: row.canonical_path, locale: row.locale, reason: "duplicate row" });
    seen.add(uniqueKey);

    if (row.intro.trim().length < THIN_PAGE_LIMITS.intro) {
      issues.push({ path: row.canonical_path, locale: row.locale, reason: `intro < ${THIN_PAGE_LIMITS.intro}` });
    }
    if (row.meta_description.trim().length < THIN_PAGE_LIMITS.metaDescription) {
      issues.push({ path: row.canonical_path, locale: row.locale, reason: "thin meta description" });
    }
    if (row.sections.length < THIN_PAGE_LIMITS.sections) {
      issues.push({ path: row.canonical_path, locale: row.locale, reason: "fewer than 3 sections" });
    }
    for (const section of row.sections) {
      const itemText = (section.items ?? []).map((item) => `${item.title} ${item.text}`).join(" ");
      if (section.body.trim().length + itemText.length < THIN_PAGE_LIMITS.sectionBody) {
        issues.push({
          path: row.canonical_path,
          locale: row.locale,
          reason: `thin section: ${section.heading}`,
        });
      }
    }
    const itemCount = row.sections.reduce((sum, section) => sum + (section.items?.length ?? 0), 0);
    if (itemCount < THIN_PAGE_LIMITS.ideaItems) {
      issues.push({ path: row.canonical_path, locale: row.locale, reason: "fewer than 4 concrete ideas" });
    }
    if (row.faq.length < THIN_PAGE_LIMITS.faq) {
      issues.push({ path: row.canonical_path, locale: row.locale, reason: "fewer than 3 FAQs" });
    }
    for (const item of row.faq) {
      if (item.answer.trim().length < THIN_PAGE_LIMITS.faqAnswer) {
        issues.push({ path: row.canonical_path, locale: row.locale, reason: `thin FAQ: ${item.question}` });
      }
    }
    if (row.benefits.length < THIN_PAGE_LIMITS.benefits) {
      issues.push({ path: row.canonical_path, locale: row.locale, reason: "fewer than 3 benefits" });
    }
    for (const benefit of row.benefits) {
      if (benefit.text.trim().length < THIN_PAGE_LIMITS.benefitText) {
        issues.push({ path: row.canonical_path, locale: row.locale, reason: `thin benefit: ${benefit.title}` });
      }
    }
    if (row.related_pages.length < THIN_PAGE_LIMITS.related) {
      issues.push({ path: row.canonical_path, locale: row.locale, reason: "fewer than 3 related links" });
    }
    void label;
  }

  const titles = new Map<string, string>();
  for (const row of rows) {
    const key = `${row.locale}:${row.meta_title.trim().toLowerCase()}`;
    if (titles.has(key)) {
      issues.push({ path: row.canonical_path, locale: row.locale, reason: "duplicate meta title" });
    }
    titles.set(key, row.canonical_path);
  }

  return issues;
}

export function sitemapEntriesForRows(rows: ChristmasSeoPageRow[]): Array<{
  loc: string;
  locale: ChristmasSeoLocale;
  canonicalPath: string;
  alternates: Array<{ locale: ChristmasSeoLocale | "x-default"; href: string }>;
}> {
  const byPath = new Map<string, ChristmasSeoPageRow[]>();
  for (const row of rows) {
    const list = byPath.get(row.canonical_path) ?? [];
    list.push(row);
    byPath.set(row.canonical_path, list);
  }

  const entries: Array<{
    loc: string;
    locale: ChristmasSeoLocale;
    canonicalPath: string;
    alternates: Array<{ locale: ChristmasSeoLocale | "x-default"; href: string }>;
  }> = [];

  for (const [canonicalPath, group] of byPath) {
    const locales = new Set(group.map((row) => row.locale));
    const alternates: Array<{ locale: ChristmasSeoLocale | "x-default"; href: string }> = [];
    if (locales.has("en")) {
      alternates.push({ locale: "en", href: absoluteUrl(localizePath(canonicalPath, "en")) });
      alternates.push({ locale: "x-default", href: absoluteUrl(localizePath(canonicalPath, "en")) });
    }
    if (locales.has("ro")) {
      alternates.push({ locale: "ro", href: absoluteUrl(localizePath(canonicalPath, "ro")) });
    }
    for (const row of group) {
      entries.push({
        loc: absoluteUrl(localizePath(canonicalPath, row.locale)),
        locale: row.locale,
        canonicalPath,
        alternates,
      });
    }
  }

  return entries.sort((a, b) => a.loc.localeCompare(b.loc));
}

export function christmasSeoAppRoutes(): string[] {
  const routes = new Set<string>([
    "/christmas/gifts-for-:slug",
    "/christmas/messages-for-:slug",
    "/ro/christmas/gifts-for-:slug",
    "/ro/christmas/messages-for-:slug",
  ]);
  for (const spec of CLUSTER_SPECS) {
    if (spec.cluster === "messages-intent") {
      routes.add(spec.canonicalPath);
      routes.add(localizePath(spec.canonicalPath, "ro"));
    }
  }
  return [...routes];
}

export function requiredGiftSlugs(): string[] {
  return CLUSTER_SPECS.filter((spec) => spec.cluster === "gifts-for").map((spec) => spec.slug);
}

export function requiredMessageSlugs(): string[] {
  return CLUSTER_SPECS.filter((spec) => spec.cluster !== "gifts-for").map((spec) => spec.slug);
}

export function sqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

export function sqlJson(value: unknown): string {
  return sqlLiteral(JSON.stringify(value));
}

export function emitClusterSeedSql(rows: ChristmasSeoPageRow[] = buildClusterRows()): string {
  const values = rows.map((row) => {
    return `  (
    ${sqlLiteral(row.page_type)},
    ${sqlLiteral(row.slug)},
    ${sqlLiteral(row.locale)},
    ${sqlLiteral(row.cluster)},
    ${sqlLiteral(row.canonical_path)},
    ${sqlLiteral(row.title)},
    ${sqlLiteral(row.meta_title)},
    ${sqlLiteral(row.meta_description)},
    ${sqlLiteral(row.h1)},
    ${sqlLiteral(row.intro)},
    ${sqlLiteral(row.cta_text)},
    ${sqlLiteral(row.cta_href)},
    ${sqlJson(row.benefits)}::jsonb,
    ${sqlJson(row.faq)}::jsonb,
    ${sqlJson(row.related_pages)}::jsonb,
    ${sqlJson(row.sections)}::jsonb,
    ${sqlLiteral(row.hero_image_url)},
    ${sqlLiteral(row.image_alt)},
    true
  )`;
  });

  return `-- Generated from src/features/christmas/seo cluster factory. Do not hand-thin.
insert into public.seo_pages (
  page_type, slug, locale, cluster, canonical_path,
  title, meta_title, meta_description, h1, intro,
  cta_text, cta_href, benefits, faq, related_pages, sections,
  hero_image_url, image_alt, is_active
)
values
${values.join(",\n")}
on conflict (page_type, slug, locale) do update set
  cluster = excluded.cluster,
  canonical_path = excluded.canonical_path,
  title = excluded.title,
  meta_title = excluded.meta_title,
  meta_description = excluded.meta_description,
  h1 = excluded.h1,
  intro = excluded.intro,
  cta_text = excluded.cta_text,
  cta_href = excluded.cta_href,
  benefits = excluded.benefits,
  faq = excluded.faq,
  related_pages = excluded.related_pages,
  sections = excluded.sections,
  hero_image_url = excluded.hero_image_url,
  image_alt = excluded.image_alt,
  is_active = excluded.is_active,
  updated_at = now();
`;
}
