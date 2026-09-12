import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { PageHead } from "@/components/PageHead";
import { parseChristmasSeoPath, localizePath, absoluteUrl } from "./factory";
import { christmasSeoJsonLd } from "./renderHtml";
import { fetchChristmasSeoPage } from "./seoPagesService";
import { CHRISTMAS_SEO_HERO_PATH, type ChristmasSeoPageRow } from "./types";
import { upsertJsonLd } from "../landing/seo";

export default function ChristmasSeoClusterPage() {
  const location = useLocation();
  const parsed = useMemo(() => parseChristmasSeoPath(location.pathname), [location.pathname]);
  const [page, setPage] = useState<ChristmasSeoPageRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!parsed) {
        setPage(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      const row = await fetchChristmasSeoPage(parsed.canonicalPath, parsed.locale);
      if (!cancelled) {
        setPage(row);
        setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [parsed]);

  useEffect(() => {
    if (!page || !parsed) return;
    upsertJsonLd("christmas-seo-jsonld", christmasSeoJsonLd(page, parsed.locale));
    document.documentElement.lang = parsed.locale;
  }, [page, parsed]);

  if (!parsed) {
    return (
      <main className="min-h-screen bg-[#0c1a14] px-6 py-20 text-[#f4efe4]">
        <h1 className="text-3xl">Page not found</h1>
        <Link className="mt-4 inline-block text-[#e4c56a]" to="/christmas">
          Back to Christmas
        </Link>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0c1a14] px-6 py-20 text-center text-[#f4efe4]">
        Loading…
      </main>
    );
  }

  if (!page) {
    return (
      <main className="min-h-screen bg-[#0c1a14] px-6 py-20 text-[#f4efe4]">
        <PageHead
          title={parsed.locale === "ro" ? "Ghidul de Crăciun nu există" : "Christmas guide not found"}
          description="This Christmas SEO cluster page is not active."
          url={absoluteUrl(localizePath(parsed.canonicalPath, parsed.locale))}
          exactTitle
          noindex
        />
        <h1 className="text-3xl">{parsed.locale === "ro" ? "Ghidul nu există" : "Guide not found"}</h1>
        <p className="mt-4 max-w-xl text-[#c9b48a]">
          {parsed.locale === "ro"
            ? "Pagina nu e activă în seo_pages."
            : "This page is not active in seo_pages."}
        </p>
        <Link className="mt-6 inline-block text-[#e4c56a]" to="/christmas">
          /christmas
        </Link>
      </main>
    );
  }

  const otherLocale = parsed.locale === "ro" ? "en" : "ro";
  const canonical = absoluteUrl(localizePath(page.canonical_path, parsed.locale));

  return (
    <main className="min-h-screen bg-[#0c1a14] text-[#f4efe4]">
      <PageHead
        title={page.meta_title}
        description={page.meta_description}
        image={page.hero_image_url}
        url={canonical}
        exactTitle
      />
      <article className="mx-auto max-w-4xl px-6 py-16">
        <p className="text-xs uppercase tracking-[0.22em] text-[#c9b48a]">
          <Link to="/christmas">TheDigitalGifter</Link> · {page.cluster}
        </p>
        <p className="mt-3">
          <Link className="text-[#e4c56a]" to={localizePath(page.canonical_path, otherLocale)}>
            {parsed.locale === "ro" ? "English" : "Română"}
          </Link>
        </p>
        <h1 className="mt-6 text-4xl font-semibold leading-tight md:text-5xl">{page.h1}</h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-[#e8e0d0]">{page.intro}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to={page.cta_href}
            className="rounded-full bg-[#e4c56a] px-6 py-3 text-sm font-semibold text-[#0c1a14]"
          >
            {page.cta_text}
          </Link>
          <a
            href="#faq"
            className="rounded-full border border-[#e4c56a]/40 px-6 py-3 text-sm font-semibold text-[#e4c56a]"
          >
            FAQ
          </a>
        </div>
        {page.hero_image_url ? (
          <img
            src={CHRISTMAS_SEO_HERO_PATH}
            alt={page.image_alt}
            width={1600}
            height={900}
            className="mt-10 aspect-[16/9] w-full rounded-3xl object-cover"
          />
        ) : null}

        {page.sections.map((section) => (
          <section key={section.heading} className="mt-14">
            <h2 className="text-2xl font-semibold">{section.heading}</h2>
            <p className="mt-4 leading-7 text-[#e8e0d0]">{section.body}</p>
            {section.items?.length ? (
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {section.items.map((item) => (
                  <article
                    key={item.title}
                    className="rounded-2xl border border-[#e4c56a]/15 bg-[#14241c] p-5"
                  >
                    <h3 className="font-semibold text-[#e4c56a]">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-[#e8e0d0]">{item.text}</p>
                  </article>
                ))}
              </div>
            ) : null}
          </section>
        ))}

        {page.benefits.length ? (
          <section className="mt-14">
            <h2 className="text-2xl font-semibold">
              {parsed.locale === "ro" ? "De ce TheDigitalGifter" : "Why TheDigitalGifter"}
            </h2>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {page.benefits.map((benefit) => (
                <article key={benefit.title} className="rounded-2xl bg-[#14241c] p-5">
                  <h3 className="font-semibold">{benefit.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#e8e0d0]">{benefit.text}</p>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {page.faq.length ? (
          <section id="faq" className="mt-14">
            <h2 className="text-2xl font-semibold">FAQ</h2>
            <div className="mt-6 space-y-4">
              {page.faq.map((item) => (
                <article key={item.question} className="rounded-2xl bg-[#14241c] p-5">
                  <h3 className="font-semibold">{item.question}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#e8e0d0]">{item.answer}</p>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {page.related_pages.length ? (
          <section className="mt-14">
            <h2 className="text-2xl font-semibold">
              {parsed.locale === "ro" ? "În cluster" : "In this cluster"}
            </h2>
            <div className="mt-5 flex flex-wrap gap-3">
              {page.related_pages.map((related) => (
                <Link
                  key={`${related.label}-${related.url}`}
                  to={related.url}
                  className="rounded-full border border-[#e4c56a]/25 px-4 py-2 text-sm"
                >
                  {related.label}
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <p className="mt-16 text-sm text-[#c9b48a]">
          <Link to="/christmas">Christmas hub</Link>
          {" · "}
          <Link to="/christmas/gift-finder">Gift Finder</Link>
          {" · "}
          <Link to="/christmas/messages">Messages</Link>
          {" · "}
          <Link to="/christmas/cards">Cards</Link>
        </p>
      </article>
    </main>
  );
}
