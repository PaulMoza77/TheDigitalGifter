import { useEffect } from "react";
import { useLocation } from "react-router-dom";

interface PageHeadProps {
  title: string;
  description: string;
  image?: string;
  url?: string;
  exactTitle?: boolean;
  /** Personal share URLs should pass noindex */
  noindex?: boolean;
}

/**
 * Simple head tag manager for per-page SEO meta tags.
 * Updates document title, meta description, and OG/Twitter tags.
 * Note: For more advanced use cases, consider react-helmet-async.
 */
export function PageHead({ title, description, image, url, exactTitle = false, noindex = false }: PageHeadProps) {
  const location = useLocation();
  const fullTitle = exactTitle ? title : `${title} — TheDigitalGifter`;
  const pageUrl = url || `https://www.thedigitalgifter.com${location.pathname}`;
  const ogImage = image || "https://www.thedigitalgifter.com/og-preview.png";

  useEffect(() => {
    // Update document title
    document.title = fullTitle;

    // Update meta description
    let descMeta = document.querySelector('meta[name="description"]');
    if (!descMeta) {
      descMeta = document.createElement("meta");
      descMeta.setAttribute("name", "description");
      document.head.appendChild(descMeta);
    }
    descMeta.setAttribute("content", description);

    // Update OG tags
    updateMetaProperty("og:title", fullTitle);
    updateMetaProperty("og:description", description);
    updateMetaProperty("og:url", pageUrl);
    updateMetaProperty("og:image", ogImage);

    // Update Twitter tags
    updateMetaName("twitter:card", "summary_large_image");
    updateMetaName("twitter:title", fullTitle);
    updateMetaName("twitter:description", description);
    updateMetaName("twitter:image", ogImage);

    // Update canonical link
    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement("link");
      canonicalLink.setAttribute("rel", "canonical");
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute("href", pageUrl);

    updateMetaName("robots", noindex ? "noindex,nofollow" : "index,follow");
  }, [fullTitle, description, pageUrl, ogImage, noindex]);

  return null; // This component only manages head tags
}

function updateMetaProperty(property: string, content: string) {
  let meta = document.querySelector(`meta[property="${property}"]`);
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("property", property);
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", content);
}

function updateMetaName(name: string, content: string) {
  let meta = document.querySelector(`meta[name="${name}"]`);
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", name);
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", content);
}
