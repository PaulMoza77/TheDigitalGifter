import { PageHead } from "@/components/PageHead";
import { getChristmasSeo, SITE_ORIGIN } from "./ssrRegistry";

/**
 * Route-specific SEO head that matches the server-injected Christmas HTML shell.
 * Use for primary Christmas product routes (not dynamic share URLs).
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
  const seo = getChristmasSeo(path);
  if (!seo) return null;
  return (
    <PageHead
      title={seo.title}
      description={seo.description}
      url={`${SITE_ORIGIN}${seo.canonicalPath}`}
      exactTitle
      noindex={noindex ?? Boolean(seo.noindex)}
      image={image || seo.ogImage}
    />
  );
}
