/**
 * Ambient types for importing the shared Christmas SEO registry from the client.
 * Relative path must match imports from `src/features/christmas/seo/*`.
 */
declare module "../../../../server/christmasSeo.mjs" {
  export const SITE_ORIGIN: string;

  export type SeoLink = { href: string; label: string };

  export type ChristmasSeoEntry = {
    path: string;
    title: string;
    description: string;
    canonicalPath: string;
    h1: string;
    lede: string;
    h2?: string;
    h2Body?: string;
    links: SeoLink[];
    breadcrumbs: SeoLink[];
    noindex?: boolean;
    ogImage?: string;
  };

  export const CHRISTMAS_SEO_ROUTES: ChristmasSeoEntry[];
  export function normalizeSeoPath(pathname: string): string;
  export function getChristmasSeo(pathname: string): ChristmasSeoEntry | null;
  export function getChristmasSeoByPath(pathname: string): ChristmasSeoEntry | null;
  export function getChristmasSeoRequestMeta(pathname: string): ChristmasSeoEntry | null;
  export function listChristmasSeoPaths(): string[];
  export function applyChristmasSeo(html: string, pathname: string): string;
  export function getChristmasPrerenderPaths(): string[];
  export function renderChristmasSeoShell(pathname: string): string | null;
  export function escapeHtml(value: string): string;
  export function buildChristmasStructuredData(entry: ChristmasSeoEntry): unknown[];
  export function christmasAbsoluteUrl(pathname: string): string;
  export function resolveChristmasSeoRequest(pathname: string): {
    locale: string;
    basePath: string;
    publicPath: string;
    entry: ChristmasSeoEntry;
    depthOverride: unknown;
    indexable: boolean;
    incomplete: boolean;
    htmlLang: string;
    dir: string;
  } | null;
}
