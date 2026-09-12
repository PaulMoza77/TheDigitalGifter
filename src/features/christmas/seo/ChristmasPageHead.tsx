import { useLocation } from "react-router-dom";
import { PageHead } from "@/components/PageHead";
import { resolveChristmasSeoRequest, SITE_ORIGIN } from "./ssrRegistry";
import { normalizeChristmasPath, parseChristmasLocalePath } from "./localeRouting";

/**
 * Route-specific SEO head that matches the server-injected Christmas HTML shell.
 * Locale-aware (Strategy A): when the live URL is /ro/... for the same product
 * base as `path`, localized metadata is used.
 */
export function ChristmasPageHead({
  path,
  noindex,
  image,
}: {
  path: string;
  /** Override registry noindex (e.g. share views). */
  noindex?: boolean;
  image?: string;
}) {
  const location = useLocation();
  const live = parseChristmasLocalePath(location.pathname);
  const base = normalizeChristmasPath(path);
  const seoPath =
    live.basePath === base ? normalizeChristmasPath(location.pathname) : base;

  const resolved = resolveChristmasSeoRequest(seoPath);
  if (!resolved) return null;
  const { entry, indexable } = resolved;
  const forceNoindex = noindex ?? (!indexable || Boolean(entry.noindex));
  return (
    <PageHead
      title={entry.title}
      description={entry.description}
      url={`${SITE_ORIGIN}${entry.canonicalPath}`}
      exactTitle
      noindex={forceNoindex}
      image={image || entry.ogImage}
    />
  );
}
