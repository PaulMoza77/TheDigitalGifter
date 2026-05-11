import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";

type PageType = "occasion" | "recipient" | "style" | "generator";

type Benefit = {
  title: string;
  text: string;
};

type FaqItem = {
  question: string;
  answer: string;
};

type RelatedPage = {
  label: string;
  url: string;
};

type SeoPageRow = {
  page_type: PageType;
  slug: string;
  title: string;
  meta_title: string;
  meta_description: string;
  h1: string;
  intro: string;
  cta_text: string;
  benefits: Benefit[];
  faq: FaqItem[];
  related_pages: RelatedPage[];
  hero_image_url: string | null;
  hero_image_path: string | null;
  image_alt: string | null;
};

const SITE_URL = "https://thedigitalgifter.com";
const STORAGE_BUCKET = "seo-images";
const IMAGE_EXTENSION = "png";

const allowedPageTypes: PageType[] = [
  "occasion",
  "recipient",
  "style",
  "generator",
];

const pageTypeToBasePath: Record<PageType, string> = {
  occasion: "occasion",
  recipient: "recipient",
  style: "style",
  generator: "generator",
};

const pageTypeToFunnelPrefix: Record<PageType, string> = {
  occasion: "/funnel/homepage",
  recipient: "/funnel/homepage",
  style: "/funnel/homepage",
  generator: "/funnel/homepage",
};

const fallbackHeroPathByType: Record<PageType, string> = {
  occasion: `fallback/occasion.${IMAGE_EXTENSION}`,
  recipient: `fallback/recipient.${IMAGE_EXTENSION}`,
  style: `fallback/style.${IMAGE_EXTENSION}`,
  generator: `fallback/generator.${IMAGE_EXTENSION}`,
};

function isPageType(value: string | undefined): value is PageType {
  return !!value && allowedPageTypes.includes(value as PageType);
}

function normalizeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function getPublicImageUrl(path: string): string {
  const cleanPath = path.replace(/^\/+/, "");
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(cleanPath);
  return data.publicUrl;
}

function getPrimaryImagePath(page: SeoPageRow): string {
  if (page.hero_image_path?.trim()) {
    return page.hero_image_path.trim().replace(/^\/+/, "");
  }

  return `${page.page_type}/${page.slug}.${IMAGE_EXTENSION}`;
}

function getPrimaryImageUrl(page: SeoPageRow): string {
  if (page.hero_image_url?.trim()) {
    return page.hero_image_url.trim();
  }

  return getPublicImageUrl(getPrimaryImagePath(page));
}

function getFallbackImageUrl(pageType: PageType): string {
  return getPublicImageUrl(fallbackHeroPathByType[pageType]);
}

function upsertMeta(name: string, content: string) {
  let tag = document.querySelector(`meta[name="${name}"]`);

  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute("name", name);
    document.head.appendChild(tag);
  }

  tag.setAttribute("content", content);
}

function upsertPropertyMeta(property: string, content: string) {
  let tag = document.querySelector(`meta[property="${property}"]`);

  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute("property", property);
    document.head.appendChild(tag);
  }

  tag.setAttribute("content", content);
}

function upsertCanonical(url: string) {
  let canonical = document.querySelector("link[rel='canonical']");

  if (!canonical) {
    canonical = document.createElement("link");
    canonical.setAttribute("rel", "canonical");
    document.head.appendChild(canonical);
  }

  canonical.setAttribute("href", url);
}

function upsertPreloadImage(url: string) {
  let preload = document.querySelector(
    "link[data-seo-hero-preload='true']"
  ) as HTMLLinkElement | null;

  if (!preload) {
    preload = document.createElement("link");
    preload.rel = "preload";
    preload.as = "image";
    preload.setAttribute("data-seo-hero-preload", "true");
    document.head.appendChild(preload);
  }

  preload.href = url;
}

function upsertJsonLd(id: string, data: Record<string, unknown>) {
  let script = document.getElementById(id) as HTMLScriptElement | null;

  if (!script) {
    script = document.createElement("script");
    script.type = "application/ld+json";
    script.id = id;
    document.head.appendChild(script);
  }

  script.textContent = JSON.stringify(data);
}

function removeJsonLd(id: string) {
  const script = document.getElementById(id);

  if (script) {
    script.remove();
  }
}

export default function SeoPage() {
  const { pageType, slug } = useParams<{
    pageType: string;
    slug: string;
  }>();

  const [page, setPage] = useState<SeoPageRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [visibleHeroImageUrl, setVisibleHeroImageUrl] = useState("");

  const safePageType = isPageType(pageType) ? pageType : null;
  const safeSlug = slug?.trim().toLowerCase() || "";

  useEffect(() => {
    async function loadPage() {
      if (!safePageType || !safeSlug) {
        setLoading(false);
        setPage(null);
        return;
      }

      setLoading(true);

      const { data, error } = await supabase
        .from("seo_pages")
        .select(
          "page_type,slug,title,meta_title,meta_description,h1,intro,cta_text,benefits,faq,related_pages,hero_image_url,hero_image_path,image_alt"
        )
        .eq("page_type", safePageType)
        .eq("slug", safeSlug)
        .eq("is_active", true)
        .maybeSingle();

      if (error || !data) {
        setPage(null);
      } else {
        setPage({
          ...(data as SeoPageRow),
          benefits: normalizeArray<Benefit>(data.benefits),
          faq: normalizeArray<FaqItem>(data.faq),
          related_pages: normalizeArray<RelatedPage>(data.related_pages),
          hero_image_url: data.hero_image_url ?? null,
          hero_image_path: data.hero_image_path ?? null,
          image_alt: data.image_alt ?? null,
        });
      }

      setLoading(false);
    }

    void loadPage();
  }, [safePageType, safeSlug]);

  const canonicalUrl = useMemo(() => {
    if (!page) return SITE_URL;

    return `${SITE_URL}/${pageTypeToBasePath[page.page_type]}/${page.slug}`;
  }, [page]);

  const primaryHeroImageUrl = useMemo(() => {
    if (!page) return "";

    return getPrimaryImageUrl(page);
  }, [page]);

  const fallbackHeroImageUrl = useMemo(() => {
    if (!page) return "";

    return getFallbackImageUrl(page.page_type);
  }, [page]);

  const heroImageAlt = useMemo(() => {
    if (!page) return "TheDigitalGifter AI digital gift preview";

    return (
      page.image_alt?.trim() ||
      `${page.h1 || page.title} - AI digital gift by TheDigitalGifter`
    );
  }, [page]);

  useEffect(() => {
    if (!primaryHeroImageUrl) return;

    setVisibleHeroImageUrl(primaryHeroImageUrl);
  }, [primaryHeroImageUrl]);

  useEffect(() => {
    if (!page || !primaryHeroImageUrl) return;

    document.title = page.meta_title;

    upsertMeta("description", page.meta_description);
    upsertMeta("robots", "index, follow");

    upsertPropertyMeta("og:title", page.meta_title);
    upsertPropertyMeta("og:description", page.meta_description);
    upsertPropertyMeta("og:type", "website");
    upsertPropertyMeta("og:url", canonicalUrl);
    upsertPropertyMeta("og:image", primaryHeroImageUrl);
    upsertPropertyMeta("og:image:secure_url", primaryHeroImageUrl);
    upsertPropertyMeta("og:image:alt", heroImageAlt);
    upsertPropertyMeta("og:image:width", "1600");
    upsertPropertyMeta("og:image:height", "900");
    upsertPropertyMeta("og:site_name", "TheDigitalGifter");

    upsertMeta("twitter:card", "summary_large_image");
    upsertMeta("twitter:title", page.meta_title);
    upsertMeta("twitter:description", page.meta_description);
    upsertMeta("twitter:image", primaryHeroImageUrl);
    upsertMeta("twitter:image:alt", heroImageAlt);

    upsertCanonical(canonicalUrl);
    upsertPreloadImage(primaryHeroImageUrl);

    upsertJsonLd("seo-page-jsonld", {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: page.meta_title,
      description: page.meta_description,
      url: canonicalUrl,
      image: primaryHeroImageUrl,
      primaryImageOfPage: {
        "@type": "ImageObject",
        url: primaryHeroImageUrl,
        width: 1600,
        height: 900,
        caption: heroImageAlt,
      },
      isPartOf: {
        "@type": "WebSite",
        name: "TheDigitalGifter",
        url: SITE_URL,
      },
    });

    if (page.faq.length > 0) {
      upsertJsonLd("seo-faq-jsonld", {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: page.faq.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.answer,
          },
        })),
      });
    } else {
      removeJsonLd("seo-faq-jsonld");
    }
  }, [page, primaryHeroImageUrl, heroImageAlt, canonicalUrl]);

  const funnelUrl = useMemo(() => {
    if (!page) return "/";

    return `${pageTypeToFunnelPrefix[page.page_type]}/${page.slug}`;
  }, [page]);

  if (!safePageType) {
    return <Navigate to="/" replace />;
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f8f4ea] px-6 py-20 text-center text-[#063f2f]">
        Loading...
      </main>
    );
  }

  if (!page) {
    return (
      <main className="min-h-screen bg-[#f8f4ea] px-6 py-20 text-center">
        <h1 className="text-4xl font-semibold text-[#063f2f]">
          Page not found
        </h1>

        <p className="mx-auto mt-4 max-w-xl text-[#3f5f55]">
          This SEO page is not active yet or does not exist in the database.
        </p>

        <Link
          to="/"
          className="mt-6 inline-block rounded-full bg-[#063f2f] px-6 py-3 text-white"
        >
          Go home
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f8f4ea] text-[#063f2f]">
      <section className="mx-auto grid max-w-6xl gap-12 px-6 py-20 md:grid-cols-2 md:items-center">
        <div>
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.25em] text-[#3f6b5d]">
            TheDigitalGifter
          </p>

          <h1 className="text-5xl font-semibold leading-tight md:text-6xl">
            {page.h1}
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-8 text-[#3f5f55]">
            {page.intro}
          </p>

          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              to={funnelUrl}
              className="rounded-full bg-[#063f2f] px-7 py-4 text-sm font-semibold text-white transition hover:opacity-90"
            >
              {page.cta_text}
            </Link>

            {page.faq.length > 0 ? (
              <a
                href="#faq"
                className="rounded-full border border-[#063f2f]/20 px-7 py-4 text-sm font-semibold text-[#063f2f]"
              >
                Read FAQ
              </a>
            ) : null}
          </div>
        </div>

        <div className="rounded-[2rem] border border-[#063f2f]/10 bg-white/70 p-6 shadow-xl">
          <img
            src={visibleHeroImageUrl || fallbackHeroImageUrl}
            alt={heroImageAlt}
            width={1600}
            height={900}
            className="aspect-[4/3] w-full rounded-[1.5rem] object-cover"
            loading="eager"
            decoding="async"
            fetchPriority="high"
            onError={() => {
              if (fallbackHeroImageUrl) {
                setVisibleHeroImageUrl(fallbackHeroImageUrl);
              }
            }}
          />

          <p className="mt-5 text-sm text-[#3f5f55]">
            Upload a photo. Choose a style. Create a meaningful digital gift.
          </p>
        </div>
      </section>

      {page.benefits.length > 0 && (
        <section className="border-y border-[#063f2f]/10 bg-white/40 px-6 py-16">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-3xl font-semibold">
              Why create it with TheDigitalGifter?
            </h2>

            <div className="mt-8 grid gap-5 md:grid-cols-3">
              {page.benefits.map((benefit) => (
                <div
                  key={benefit.title}
                  className="rounded-3xl bg-white p-6 shadow-sm"
                >
                  <h3 className="font-semibold">{benefit.title}</h3>

                  <p className="mt-3 text-sm leading-6 text-[#3f5f55]">
                    {benefit.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {page.faq.length > 0 && (
        <section id="faq" className="mx-auto max-w-4xl px-6 py-16">
          <h2 className="text-3xl font-semibold">FAQ</h2>

          <div className="mt-8 space-y-4">
            {page.faq.map((item) => (
              <div key={item.question} className="rounded-3xl bg-white p-6">
                <h3 className="font-semibold">{item.question}</h3>

                <p className="mt-3 text-sm leading-6 text-[#3f5f55]">
                  {item.answer}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {page.related_pages.length > 0 && (
        <section className="mx-auto max-w-5xl px-6 pb-20">
          <h2 className="text-2xl font-semibold">Related gift ideas</h2>

          <div className="mt-6 flex flex-wrap gap-3">
            {page.related_pages.map((related) => (
              <Link
                key={`${related.label}-${related.url}`}
                to={related.url}
                className="rounded-full border border-[#063f2f]/15 bg-white px-5 py-3 text-sm font-semibold"
              >
                {related.label}
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}