import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
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
};

const pageTypeToBasePath: Record<PageType, string> = {
  occasion: "occasion",
  recipient: "recipient",
  style: "style",
  generator: "generator",
};

const pageTypeToFunnelPrefix: Record<PageType, string> = {
  occasion: "/funnel/homepage",
  recipient: "/funnel/recipient",
  style: "/funnel/style",
  generator: "/funnel/homepage",
};

export default function SeoPage() {
  const { pageType, slug } = useParams<{
    pageType: PageType;
    slug: string;
  }>();

  const [page, setPage] = useState<SeoPageRow | null>(null);
  const [loading, setLoading] = useState(true);

  const safePageType = pageType as PageType | undefined;
  const safeSlug = slug?.trim().toLowerCase();

  useEffect(() => {
    async function loadPage() {
      if (!safePageType || !safeSlug) return;

      setLoading(true);

      const { data, error } = await supabase
        .from("seo_pages")
        .select(
          "page_type,slug,title,meta_title,meta_description,h1,intro,cta_text,benefits,faq,related_pages"
        )
        .eq("page_type", safePageType)
        .eq("slug", safeSlug)
        .eq("is_active", true)
        .single();

      if (error || !data) {
        setPage(null);
      } else {
        setPage(data as SeoPageRow);
      }

      setLoading(false);
    }

    loadPage();
  }, [safePageType, safeSlug]);

  useEffect(() => {
    if (!page) return;

    document.title = page.meta_title;

    let description = document.querySelector("meta[name='description']");
    if (!description) {
      description = document.createElement("meta");
      description.setAttribute("name", "description");
      document.head.appendChild(description);
    }

    description.setAttribute("content", page.meta_description);

    let canonical = document.querySelector("link[rel='canonical']");
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }

    canonical.setAttribute(
      "href",
      `https://thedigitalgifter.com/${pageTypeToBasePath[page.page_type]}/${page.slug}`
    );
  }, [page]);

  const funnelUrl = useMemo(() => {
    if (!page) return "/";
    return `${pageTypeToFunnelPrefix[page.page_type]}/${page.slug}`;
  }, [page]);

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
              className="rounded-full bg-[#063f2f] px-7 py-4 text-sm font-semibold text-white"
            >
              {page.cta_text}
            </Link>

            <a
              href="#faq"
              className="rounded-full border border-[#063f2f]/20 px-7 py-4 text-sm font-semibold text-[#063f2f]"
            >
              Read FAQ
            </a>
          </div>
        </div>

        <div className="rounded-[2rem] border border-[#063f2f]/10 bg-white/70 p-6 shadow-xl">
          <div className="aspect-[4/3] rounded-[1.5rem] bg-gradient-to-br from-[#fff7d6] to-[#eaf4eb]" />
          <p className="mt-5 text-sm text-[#3f5f55]">
            Upload a photo. Choose a style. Create a meaningful digital gift.
          </p>
        </div>
      </section>

      {page.benefits?.length > 0 && (
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

      {page.faq?.length > 0 && (
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

      {page.related_pages?.length > 0 && (
        <section className="mx-auto max-w-5xl px-6 pb-20">
          <h2 className="text-2xl font-semibold">Related gift ideas</h2>

          <div className="mt-6 flex flex-wrap gap-3">
            {page.related_pages.map((related) => (
              <Link
                key={related.url}
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