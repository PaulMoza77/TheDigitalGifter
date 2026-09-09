import {
  absoluteUrl,
  localizePath,
  specForCanonicalPath,
} from "./factory";
import {
  CHRISTMAS_SEO_OG_IMAGE,
  CHRISTMAS_SEO_SITE_ORIGIN,
  type ChristmasSeoLocale,
  type ChristmasSeoPageRow,
} from "./types";

function escapeHtml(value: string): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function paragraphHtml(text: string): string {
  return escapeHtml(text)
    .split(/\n{2,}/)
    .map((block) => `<p>${block.replace(/\n/g, "<br />")}</p>`)
    .join("");
}

export function hreflangTags(canonicalPath: string): string {
  const spec = specForCanonicalPath(canonicalPath);
  if (!spec) return "";
  const en = absoluteUrl(localizePath(canonicalPath, "en"));
  const ro = absoluteUrl(localizePath(canonicalPath, "ro"));
  return [
    `<link rel="alternate" hreflang="en" href="${escapeHtml(en)}" />`,
    `<link rel="alternate" hreflang="ro" href="${escapeHtml(ro)}" />`,
    `<link rel="alternate" hreflang="x-default" href="${escapeHtml(en)}" />`,
  ].join("\n    ");
}

export function christmasSeoJsonLd(row: ChristmasSeoPageRow, locale: ChristmasSeoLocale) {
  const canonical = absoluteUrl(localizePath(row.canonical_path, locale));
  const image = row.hero_image_url || CHRISTMAS_SEO_OG_IMAGE;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${canonical}#webpage`,
        url: canonical,
        name: row.meta_title,
        description: row.meta_description,
        inLanguage: locale,
        isPartOf: { "@id": `${CHRISTMAS_SEO_SITE_ORIGIN}/#website` },
        primaryImageOfPage: { "@type": "ImageObject", url: image },
      },
      {
        "@type": "FAQPage",
        mainEntity: row.faq.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: { "@type": "Answer", text: item.answer },
        })),
      },
    ],
  };
}

export function renderChristmasSeoHtml(row: ChristmasSeoPageRow, locale: ChristmasSeoLocale): string {
  const localizedPath = localizePath(row.canonical_path, locale);
  const canonical = absoluteUrl(localizedPath);
  const image = row.hero_image_url || CHRISTMAS_SEO_OG_IMAGE;
  const jsonLd = christmasSeoJsonLd(row, locale);
  const otherLocale: ChristmasSeoLocale = locale === "ro" ? "en" : "ro";
  const otherHref = localizePath(row.canonical_path, otherLocale);
  const htmlLang = locale === "ro" ? "ro" : "en";

  const sections = row.sections
    .map((section) => {
      const items = (section.items ?? [])
        .map(
          (item) => `
            <article class="idea">
              <h3>${escapeHtml(item.title)}</h3>
              <p>${escapeHtml(item.text)}</p>
            </article>`,
        )
        .join("");
      return `
        <section>
          <h2>${escapeHtml(section.heading)}</h2>
          ${paragraphHtml(section.body)}
          ${items ? `<div class="ideas">${items}</div>` : ""}
        </section>`;
    })
    .join("");

  const benefits = row.benefits
    .map(
      (benefit) => `
        <article class="card">
          <h3>${escapeHtml(benefit.title)}</h3>
          <p>${escapeHtml(benefit.text)}</p>
        </article>`,
    )
    .join("");

  const faqs = row.faq
    .map(
      (item) => `
        <article class="card" id="faq">
          <h3>${escapeHtml(item.question)}</h3>
          <p>${escapeHtml(item.answer)}</p>
        </article>`,
    )
    .join("");

  const related = row.related_pages
    .map((item) => `<a class="chip" href="${escapeHtml(item.url)}">${escapeHtml(item.label)}</a>`)
    .join("");

  return `<!doctype html>
<html lang="${htmlLang}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(row.meta_title)}</title>
    <meta name="description" content="${escapeHtml(row.meta_description)}" />
    <meta name="robots" content="index,follow" />
    <link rel="canonical" href="${escapeHtml(canonical)}" />
    ${hreflangTags(row.canonical_path)}
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="TheDigitalGifter" />
    <meta property="og:title" content="${escapeHtml(row.meta_title)}" />
    <meta property="og:description" content="${escapeHtml(row.meta_description)}" />
    <meta property="og:url" content="${escapeHtml(canonical)}" />
    <meta property="og:image" content="${escapeHtml(image)}" />
    <meta property="og:locale" content="${locale === "ro" ? "ro_RO" : "en_US"}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(row.meta_title)}" />
    <meta name="twitter:description" content="${escapeHtml(row.meta_description)}" />
    <meta name="twitter:image" content="${escapeHtml(image)}" />
    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
    <style>
      :root { color-scheme: dark; }
      body { margin:0; font-family: Georgia, "Times New Roman", serif; background:#0c1a14; color:#f4efe4; line-height:1.65; }
      a { color:#e4c56a; }
      header, main, footer { max-width: 920px; margin: 0 auto; padding: 24px 20px; }
      .kicker { letter-spacing: .22em; text-transform: uppercase; font-size: 12px; color:#c9b48a; }
      h1 { font-size: clamp(2rem, 5vw, 3.4rem); line-height:1.15; margin: 12px 0 18px; }
      h2 { font-size: 1.6rem; margin-top: 42px; }
      .hero { display:grid; gap: 20px; }
      .hero img { width:100%; border-radius: 24px; aspect-ratio: 16/9; object-fit: cover; }
      .cta { display:inline-block; margin-right:12px; margin-top: 12px; background:#e4c56a; color:#0c1a14; text-decoration:none; padding: 12px 18px; border-radius:999px; font-weight:700; }
      .cta.secondary { background:transparent; color:#e4c56a; border:1px solid #e4c56a; }
      .ideas, .cards { display:grid; gap:14px; }
      @media (min-width: 720px) { .ideas, .cards { grid-template-columns: 1fr 1fr; } }
      .idea, .card { background:#14241c; border:1px solid rgba(228,197,106,.18); border-radius:18px; padding:16px 18px; }
      .chips { display:flex; flex-wrap:wrap; gap:10px; }
      .chip { display:inline-block; border:1px solid rgba(228,197,106,.3); border-radius:999px; padding:8px 14px; text-decoration:none; }
      footer { color:#c9b48a; font-size:14px; }
    </style>
  </head>
  <body>
    <header>
      <p class="kicker"><a href="/christmas">TheDigitalGifter</a> · Christmas</p>
      <p><a href="${escapeHtml(otherHref)}">${locale === "ro" ? "English" : "Română"}</a></p>
    </header>
    <main>
      <section class="hero">
        <div>
          <p class="kicker">${escapeHtml(row.cluster)}</p>
          <h1>${escapeHtml(row.h1)}</h1>
          ${paragraphHtml(row.intro)}
          <p>
            <a class="cta" href="${escapeHtml(row.cta_href)}">${escapeHtml(row.cta_text)}</a>
            <a class="cta secondary" href="#faq">FAQ</a>
          </p>
        </div>
        <img src="${escapeHtml(image)}" alt="${escapeHtml(row.image_alt)}" width="1600" height="900" />
      </section>
      ${sections}
      <section>
        <h2>${locale === "ro" ? "De ce TheDigitalGifter" : "Why TheDigitalGifter"}</h2>
        <div class="cards">${benefits}</div>
      </section>
      <section>
        <h2>FAQ</h2>
        <div class="cards">${faqs}</div>
      </section>
      <section>
        <h2>${locale === "ro" ? "În cluster" : "In this cluster"}</h2>
        <div class="chips">${related}</div>
      </section>
    </main>
    <footer>
      <p><a href="/christmas">Christmas hub</a> · <a href="/christmas/gift-finder">Gift Finder</a> · <a href="/christmas/messages">Messages</a> · <a href="/christmas/cards">Cards</a></p>
      <p>Indexable guide. No checkout on this page.</p>
    </footer>
  </body>
</html>`;
}

export function renderChristmasSeoNotFound(locale: ChristmasSeoLocale = "en"): string {
  const title = locale === "ro" ? "Ghidul de Crăciun nu există" : "Christmas guide not found";
  const body =
    locale === "ro"
      ? "Pagina de cluster nu e activă în seo_pages. Înapoi la hub-ul de Crăciun."
      : "This cluster page is not active in seo_pages. Back to the Christmas hub.";
  return `<!doctype html>
<html lang="${locale}">
  <head>
    <meta charset="utf-8" />
    <meta name="robots" content="noindex,follow" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="font-family:Georgia,serif;background:#0c1a14;color:#f4efe4;padding:48px 24px">
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(body)}</p>
    <p><a href="/christmas" style="color:#e4c56a">/christmas</a></p>
  </body>
</html>`;
}
