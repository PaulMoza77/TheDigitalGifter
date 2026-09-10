/**
 * Type declarations for the Node Christmas SEO registry imported by the client.
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
  export function listChristmasSeoPaths(): string[];
  export function applyChristmasSeo(html: string, pathname: string): string;
}

declare module "../../../server/christmasSeo.mjs" {
  export * from "../../../../server/christmasSeo.mjs";
}

declare module "../../../../../../server/christmasSeo.mjs" {
  export * from "../../../../server/christmasSeo.mjs";
}
