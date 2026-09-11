/**
 * Christmas P0 technical SEO registry + HTML injection for SPA crawlers.
 * Pure Node (no React). Used by origin.mjs and build-time prerender.
 *
 * Injects route-specific <title>, meta, canonical, OG/Twitter, BreadcrumbList,
 * and a semantic body shell inside #root (replaced by createRoot on hydrate).
 */

export const SITE_ORIGIN = "https://www.thedigitalgifter.com";

/** @typedef {{ href: string, label: string }} SeoLink */
/** @typedef {{
 *   path: string,
 *   title: string,
 *   description: string,
 *   canonicalPath: string,
 *   h1: string,
 *   lede: string,
 *   h2?: string,
 *   h2Body?: string,
 *   links: SeoLink[],
 *   breadcrumbs: SeoLink[],
 *   noindex?: boolean,
 *   ogImage?: string,
 * }} ChristmasSeoEntry */

/** @type {ChristmasSeoEntry[]} */
export const CHRISTMAS_SEO_ROUTES = [
  {
    path: "/christmas",
    title: "Christmas at TheDigitalGifter | Gifts, Photos, Santa & More",
    description:
      "Create Christmas gifts, AI portraits, Santa videos, wishlists, cards, and advent surprises — personalized digital Christmas experiences from TheDigitalGifter.",
    canonicalPath: "/christmas",
    h1: "Create Something They’ll Remember This Christmas",
    lede:
      "Explore Christmas gifts, photo portraits, Santa videos, digital trees, advent calendars, cards, and messages — all in one place at TheDigitalGifter.",
    h2: "Christmas experiences",
    h2Body: "Pick a Christmas product below and create something personal in minutes.",
    links: [
      { href: "/christmas/gift-finder", label: "Find a Christmas Gift They’ll Love" },
      { href: "/christmas/wishlist", label: "Create a Christmas Wishlist" },
      { href: "/christmas/photo-generator", label: "AI Christmas Photo Generator" },
      { href: "/christmas/santa-video", label: "Create a Personalized Santa Video" },
      { href: "/christmas/tree", label: "Build a Digital Christmas Tree" },
      { href: "/christmas/advent", label: "Open the Advent Calendar" },
      { href: "/christmas/cards", label: "Create a Christmas Card" },
      { href: "/christmas/messages", label: "Find a Christmas Message" },
    ],
    breadcrumbs: [
      { href: "/", label: "Home" },
      { href: "/christmas", label: "Christmas" },
    ],
    ogImage: `${SITE_ORIGIN}/christmas/og-countdown.jpg`,
  },
  {
    path: "/christmas/gift-finder",
    title: "Christmas Gift Finder | Find the Perfect Gift | TheDigitalGifter",
    description:
      "Find thoughtful Christmas gift ideas based on who you’re shopping for, their interests, personality, and your budget.",
    canonicalPath: "/christmas/gift-finder",
    h1: "Find a Christmas Gift They’ll Actually Love",
    lede:
      "Answer a few questions about who you’re shopping for and get personalized Christmas gift ideas matched to interests, personality, and budget.",
    h2: "Related Christmas tools",
    links: [
      { href: "/christmas/wishlist", label: "Create a Christmas Wishlist" },
      { href: "/christmas/photo-generator", label: "Christmas Photo Generator" },
      { href: "/christmas/tree", label: "Digital Christmas Tree" },
      { href: "/christmas", label: "All Christmas experiences" },
    ],
    breadcrumbs: [
      { href: "/", label: "Home" },
      { href: "/christmas", label: "Christmas" },
      { href: "/christmas/gift-finder", label: "Gift Finder" },
    ],
  },
  {
    path: "/christmas/wishlist",
    title: "Christmas Wishlist Maker | Create & Share Your Wish List",
    description:
      "Create a Christmas wishlist, add gifts from anywhere, and share one simple link with family and friends.",
    canonicalPath: "/christmas/wishlist",
    h1: "Create a Christmas Wishlist and Share One Simple Link",
    lede:
      "Build a shareable Christmas wishlist in minutes. Add gifts from any store or write your own wishes, then send one link to family and friends.",
    h2: "How it works",
    h2Body: "Create your list, add wishes, share one link, and let people coordinate gifts without spoiling the surprise.",
    links: [
      { href: "/christmas/gift-finder", label: "Try the Christmas Gift Finder" },
      { href: "/christmas/tree", label: "Put gifts under a Digital Christmas Tree" },
      { href: "/christmas/photo-generator", label: "Add a Christmas Portrait" },
      { href: "/christmas", label: "Back to Christmas" },
    ],
    breadcrumbs: [
      { href: "/", label: "Home" },
      { href: "/christmas", label: "Christmas" },
      { href: "/christmas/wishlist", label: "Wishlist" },
    ],
  },
  {
    path: "/christmas/photo-generator",
    title: "AI Christmas Photo Generator | Family, Couples & Pets",
    description:
      "Turn your favorite photo into a magical Christmas portrait. Create festive photos for family, couples, and pets in minutes.",
    canonicalPath: "/christmas/photo-generator",
    h1: "Turn Your Photo Into Christmas Magic",
    lede:
      "Upload a photo, choose a festive Christmas scene, and create a personalized Christmas portrait you can download and share privately.",
    h2: "Christmas photo styles",
    h2Body: "Create portraits for family, couples, pets, dogs, and cats from one Christmas photo experience.",
    links: [
      { href: "/christmas/family", label: "Family Christmas Portraits" },
      { href: "/christmas/couples", label: "Couple Christmas Portraits" },
      { href: "/christmas/pets", label: "Pet Christmas Portraits" },
      { href: "/christmas/dogs", label: "Christmas Dog Portraits" },
      { href: "/christmas/cats", label: "Christmas Cat Portraits" },
      { href: "/christmas/cards", label: "Turn a portrait into a Christmas Card" },
      { href: "/christmas", label: "Christmas home" },
    ],
    breadcrumbs: [
      { href: "/", label: "Home" },
      { href: "/christmas", label: "Christmas" },
      { href: "/christmas/photo-generator", label: "Photo Generator" },
    ],
  },
  {
    path: "/christmas/family",
    title: "Family Christmas Photo Generator | Christmas Family Portraits",
    description:
      "Create a personalized family Christmas portrait from your favorite family photo. Choose a festive Christmas scene and turn your photo into a holiday memory.",
    canonicalPath: "/christmas/family",
    h1: "Turn Your Family Photo Into a Magical Christmas Portrait",
    lede:
      "Create a personalized family Christmas portrait from your favorite family photo. Choose a festive Christmas scene and turn your photo into a holiday memory.",
    h2: "More Christmas portraits",
    links: [
      { href: "/christmas/photo-generator", label: "AI Christmas Photo Generator" },
      { href: "/christmas/couples", label: "Couple Christmas Portraits" },
      { href: "/christmas/pets", label: "Pet Christmas Portraits" },
      { href: "/christmas/cards", label: "Christmas Card Maker" },
      { href: "/christmas", label: "Christmas home" },
    ],
    breadcrumbs: [
      { href: "/", label: "Home" },
      { href: "/christmas", label: "Christmas" },
      { href: "/christmas/photo-generator", label: "Photo Generator" },
      { href: "/christmas/family", label: "Family" },
    ],
  },
  {
    path: "/christmas/couples",
    title: "Couple Christmas Photo Generator | Romantic Christmas Portraits",
    description:
      "Create a romantic Christmas couple portrait from your photo. Perfect for a first Christmas together or a personalized couple gift.",
    canonicalPath: "/christmas/couples",
    h1: "Create a Magical Christmas Portrait Together",
    lede:
      "Upload one photo with both of you and create a romantic Christmas couple portrait — private by default.",
    h2: "More Christmas portraits",
    links: [
      { href: "/christmas/photo-generator", label: "AI Christmas Photo Generator" },
      { href: "/christmas/family", label: "Family Christmas Portraits" },
      { href: "/christmas/pets", label: "Pet Christmas Portraits" },
      { href: "/christmas", label: "Christmas home" },
    ],
    breadcrumbs: [
      { href: "/", label: "Home" },
      { href: "/christmas", label: "Christmas" },
      { href: "/christmas/photo-generator", label: "Photo Generator" },
      { href: "/christmas/couples", label: "Couples" },
    ],
  },
  {
    path: "/christmas/pets",
    title: "Christmas Pet Photo Generator | Festive Pet Portraits",
    description:
      "Turn your pet photo into a festive Christmas portrait. Dogs and cats welcome — private by default.",
    canonicalPath: "/christmas/pets",
    h1: "Turn Your Pet Into Christmas Magic",
    lede:
      "Upload a clear pet photo and create a festive Christmas pet portrait for dogs or cats.",
    h2: "Species-specific Christmas portraits",
    links: [
      { href: "/christmas/dogs", label: "Christmas Dog Portraits" },
      { href: "/christmas/cats", label: "Christmas Cat Portraits" },
      { href: "/christmas/photo-generator", label: "AI Christmas Photo Generator" },
      { href: "/christmas", label: "Christmas home" },
    ],
    breadcrumbs: [
      { href: "/", label: "Home" },
      { href: "/christmas", label: "Christmas" },
      { href: "/christmas/photo-generator", label: "Photo Generator" },
      { href: "/christmas/pets", label: "Pets" },
    ],
  },
  {
    path: "/christmas/dogs",
    title: "Christmas Dog Photo Generator | Festive Dog Portraits",
    description:
      "Create a magical Christmas portrait of your dog from a clear photo. Species-checked and private by default.",
    canonicalPath: "/christmas/dogs",
    h1: "Create a Magical Christmas Portrait of Your Dog",
    lede:
      "Upload a clear dog photo, pick a holiday style, and create a festive Christmas dog portrait.",
    h2: "Related pet portraits",
    links: [
      { href: "/christmas/cats", label: "Christmas Cat Portraits" },
      { href: "/christmas/pets", label: "All Pet Christmas Portraits" },
      { href: "/christmas/photo-generator", label: "AI Christmas Photo Generator" },
      { href: "/christmas", label: "Christmas home" },
    ],
    breadcrumbs: [
      { href: "/", label: "Home" },
      { href: "/christmas", label: "Christmas" },
      { href: "/christmas/photo-generator", label: "Photo Generator" },
      { href: "/christmas/pets", label: "Pets" },
      { href: "/christmas/dogs", label: "Dogs" },
    ],
  },
  {
    path: "/christmas/cats",
    title: "Christmas Cat Photo Generator | Festive Cat Portraits",
    description:
      "Create a magical Christmas portrait of your cat from a clear photo. Species-checked and private by default.",
    canonicalPath: "/christmas/cats",
    h1: "Create a Magical Christmas Portrait of Your Cat",
    lede:
      "Upload a clear cat photo, pick a holiday style, and create a festive Christmas cat portrait.",
    h2: "Related pet portraits",
    links: [
      { href: "/christmas/dogs", label: "Christmas Dog Portraits" },
      { href: "/christmas/pets", label: "All Pet Christmas Portraits" },
      { href: "/christmas/photo-generator", label: "AI Christmas Photo Generator" },
      { href: "/christmas", label: "Christmas home" },
    ],
    breadcrumbs: [
      { href: "/", label: "Home" },
      { href: "/christmas", label: "Christmas" },
      { href: "/christmas/photo-generator", label: "Photo Generator" },
      { href: "/christmas/pets", label: "Pets" },
      { href: "/christmas/cats", label: "Cats" },
    ],
  },
  {
    path: "/christmas/kids",
    title: "Christmas Photos for Kids | Magical Holiday Portraits",
    description:
      "Create magical Christmas portraits for kids. Privacy controls are required before this product launches.",
    canonicalPath: "/christmas/kids",
    h1: "Create Magical Christmas Portraits for Kids",
    lede:
      "Kids Christmas portraits are coming soon. Privacy-first controls are required before launch.",
    h2: "Available now",
    links: [
      { href: "/christmas/family", label: "Family Christmas Portraits" },
      { href: "/christmas/santa-video", label: "Personalized Santa Video" },
      { href: "/christmas/photo-generator", label: "AI Christmas Photo Generator" },
      { href: "/christmas", label: "Christmas home" },
    ],
    breadcrumbs: [
      { href: "/", label: "Home" },
      { href: "/christmas", label: "Christmas" },
      { href: "/christmas/kids", label: "Kids" },
    ],
    noindex: true,
  },
  {
    path: "/christmas/santa-video",
    title: "Personalized Santa Video | Santa Says Your Child’s Name",
    description:
      "Create a personalized Christmas video from Santa that can include the recipient’s name and other supported personal details.",
    canonicalPath: "/christmas/santa-video",
    h1: "Create a Personalized Video From Santa",
    lede:
      "Create a personalized Christmas video from Santa that can include the recipient’s name and other supported personal details.",
    h2: "How Santa videos work",
    h2Body: "Tell Santa who it’s for, add a few details, then create a personalized Christmas message video.",
    links: [
      { href: "/christmas/family", label: "Family Christmas Portraits" },
      { href: "/christmas/kids", label: "Christmas Photos for Kids" },
      { href: "/christmas/cards", label: "Christmas Card Maker" },
      { href: "/christmas", label: "Christmas home" },
    ],
    breadcrumbs: [
      { href: "/", label: "Home" },
      { href: "/christmas", label: "Christmas" },
      { href: "/christmas/santa-video", label: "Santa Video" },
    ],
  },
  {
    path: "/christmas/tree",
    title: "Digital Christmas Tree | Gifts, Messages & Memories",
    description:
      "Build a digital Christmas tree filled with gifts, messages, and memories you can decorate and securely share.",
    canonicalPath: "/christmas/tree",
    h1: "Build a Christmas Tree Filled With Surprises",
    lede:
      "Create, decorate, and share a personalized digital Christmas tree with gifts and messages underneath.",
    h2: "Pair with Christmas gifts",
    links: [
      { href: "/christmas/wishlist", label: "Christmas Wishlist Maker" },
      { href: "/christmas/gift-finder", label: "Christmas Gift Finder" },
      { href: "/christmas/messages", label: "Christmas Message Generator" },
      { href: "/christmas", label: "Christmas home" },
    ],
    breadcrumbs: [
      { href: "/", label: "Home" },
      { href: "/christmas", label: "Christmas" },
      { href: "/christmas/tree", label: "Digital Tree" },
    ],
  },
  {
    path: "/christmas/advent",
    title: "Online Christmas Advent Calendar | A Surprise Every Day",
    description:
      "Open a new digital Christmas surprise every day from December 1 through December 24.",
    canonicalPath: "/christmas/advent",
    h1: "A Little Christmas Magic Every Day",
    lede:
      "Open a new digital Christmas surprise every day from December 1 through December 24.",
    h2: "More Christmas magic",
    links: [
      { href: "/christmas/santa-video", label: "Personalized Santa Video" },
      { href: "/christmas/cards", label: "Christmas Card Maker" },
      { href: "/christmas/wishlist", label: "Christmas Wishlist" },
      { href: "/christmas", label: "Christmas home" },
    ],
    breadcrumbs: [
      { href: "/", label: "Home" },
      { href: "/christmas", label: "Christmas" },
      { href: "/christmas/advent", label: "Advent Calendar" },
    ],
  },
  {
    path: "/christmas/cards",
    title: "Christmas Card Maker | Personalized Christmas Cards",
    description:
      "Create a personalized Christmas card they’ll want to keep — choose a design, add your message, and share or download.",
    canonicalPath: "/christmas/cards",
    h1: "Create a Christmas Card They’ll Want to Keep",
    lede:
      "Design a personalized Christmas card with festive layouts and your own message. Some messages deserve more than a text.",
    h2: "Pair with Christmas messages",
    links: [
      { href: "/christmas/messages", label: "Christmas Message Generator" },
      { href: "/christmas/photo-generator", label: "Christmas Photo Generator" },
      { href: "/christmas/family", label: "Family Christmas Portraits" },
      { href: "/christmas", label: "Christmas home" },
    ],
    breadcrumbs: [
      { href: "/", label: "Home" },
      { href: "/christmas", label: "Christmas" },
      { href: "/christmas/cards", label: "Cards" },
    ],
  },
  {
    path: "/christmas/messages",
    title: "Christmas Message Generator | Wishes for Family & Friends",
    description:
      "Find the perfect Christmas message for family, friends, and coworkers — then use it in a personalized Christmas card.",
    canonicalPath: "/christmas/messages",
    h1: "Find the Perfect Christmas Message",
    lede:
      "Generate warm, funny, romantic, or professional Christmas wishes, then drop your favorite into a Christmas card.",
    h2: "Turn words into a card",
    links: [
      { href: "/christmas/cards", label: "Christmas Card Maker" },
      { href: "/christmas/wishlist", label: "Christmas Wishlist" },
      { href: "/christmas/tree", label: "Digital Christmas Tree" },
      { href: "/christmas", label: "Christmas home" },
    ],
    breadcrumbs: [
      { href: "/", label: "Home" },
      { href: "/christmas", label: "Christmas" },
      { href: "/christmas/messages", label: "Messages" },
    ],
  },
  {
    path: "/christmas-ai-photos",
    title: "Create Your Christmas Photos | TheDigitalGifter",
    description:
      "Create personalized Christmas photos with TheDigitalGifter. Upload a photo and generate a festive AI Christmas portrait.",
    canonicalPath: "/christmas-ai-photos",
    h1: "Create Your Christmas Photos",
    lede:
      "Create your Christmas photos with TheDigitalGifter’s AI photo experience — festive portraits from your own picture.",
    h2: "More Christmas photo options",
    links: [
      { href: "/christmas/photo-generator", label: "AI Christmas Photo Generator" },
      { href: "/christmas/family", label: "Family Christmas Portraits" },
      { href: "/christmas", label: "Christmas at TheDigitalGifter" },
    ],
    breadcrumbs: [
      { href: "/", label: "Home" },
      { href: "/christmas-ai-photos", label: "Christmas AI Photos" },
    ],
    // Paid acquisition funnel — same organic intent as /christmas/photo-generator.
    noindex: true,
  },
  {
    path: "/christmas-ai-photos/order",
    title: "Your Christmas AI Photos | TheDigitalGifter",
    description: "View your AI Christmas portraits after checkout.",
    canonicalPath: "/christmas-ai-photos",
    h1: "Your Christmas Photos",
    lede: "Transactional order results for Christmas AI photos.",
    links: [
      { href: "/christmas/photo-generator", label: "AI Christmas Photo Generator" },
      { href: "/christmas", label: "Christmas home" },
    ],
    breadcrumbs: [
      { href: "/", label: "Home" },
      { href: "/christmas-ai-photos", label: "Christmas AI Photos" },
    ],
    noindex: true,
  },
];

const BY_PATH = new Map(CHRISTMAS_SEO_ROUTES.map((r) => [r.path, r]));

export function normalizeSeoPath(pathname) {
  const raw = String(pathname || "/").split("?")[0].split("#")[0];
  const trimmed = raw.replace(/\/+$/, "") || "/";
  return trimmed;
}

/** @returns {ChristmasSeoEntry | null} */
export function getChristmasSeo(pathname) {
  return BY_PATH.get(normalizeSeoPath(pathname)) ?? null;
}

export function listChristmasSeoPaths() {
  return CHRISTMAS_SEO_ROUTES.map((r) => r.path);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, "&#39;");
}

function replaceMetaName(html, name, content) {
  const re = new RegExp(
    `<meta(\\s+)name="${name}"(\\s+)content="[^"]*"`,
    "i",
  );
  if (re.test(html)) {
    return html.replace(re, `<meta$1name="${name}"$2content="${escapeAttr(content)}"`);
  }
  return html.replace(
    /<\/head>/i,
    `    <meta name="${name}" content="${escapeAttr(content)}" />\n  </head>`,
  );
}

function replaceMetaProperty(html, property, content) {
  const re = new RegExp(
    `<meta(\\s+)property="${property}"(\\s+)content="[^"]*"`,
    "i",
  );
  if (re.test(html)) {
    return html.replace(
      re,
      `<meta$1property="${property}"$2content="${escapeAttr(content)}"`,
    );
  }
  return html.replace(
    /<\/head>/i,
    `    <meta property="${property}" content="${escapeAttr(content)}" />\n  </head>`,
  );
}

function replaceCanonical(html, href) {
  const re = /<link(\s+)rel="canonical"(\s+)href="[^"]*"/i;
  if (re.test(html)) {
    return html.replace(re, `<link$1rel="canonical"$2href="${escapeAttr(href)}"`);
  }
  return html.replace(
    /<\/head>/i,
    `    <link rel="canonical" href="${escapeAttr(href)}" />\n  </head>`,
  );
}

function buildBreadcrumbJsonLd(entry) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: entry.breadcrumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.label,
      item: `${SITE_ORIGIN}${crumb.href === "/" ? "/" : crumb.href}`,
    })),
  };
}

function buildWebPageJsonLd(entry, canonical) {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: entry.title,
    description: entry.description,
    url: canonical,
    isPartOf: {
      "@type": "WebSite",
      name: "TheDigitalGifter",
      url: SITE_ORIGIN,
    },
  };
}

function buildSeoShell(entry) {
  const links = entry.links
    .map(
      (link) =>
        `<li><a href="${escapeAttr(link.href)}">${escapeHtml(link.label)}</a></li>`,
    )
    .join("");
  const crumbs = entry.breadcrumbs
    .map((c, i) => {
      const sep = i === 0 ? "" : " / ";
      return `${sep}<a href="${escapeAttr(c.href)}">${escapeHtml(c.label)}</a>`;
    })
    .join("");
  const h2 = entry.h2
    ? `<h2>${escapeHtml(entry.h2)}</h2>${
        entry.h2Body ? `<p>${escapeHtml(entry.h2Body)}</p>` : ""
      }`
    : "";

  return (
    `<div id="tdg-christmas-seo" data-tdg-seo="christmas" data-path="${escapeAttr(entry.path)}">` +
    `<nav aria-label="Breadcrumb">${crumbs}</nav>` +
    `<h1>${escapeHtml(entry.h1)}</h1>` +
    `<p>${escapeHtml(entry.lede)}</p>` +
    h2 +
    `<ul>${links}</ul>` +
    `</div>`
  );
}

/**
 * Rewrite SPA index.html with route-specific SEO head + body shell.
 * @param {string} html
 * @param {string} pathname
 * @returns {string}
 */
export function applyChristmasSeo(html, pathname) {
  const entry = getChristmasSeo(pathname);
  if (!entry) return html;

  const canonical = `${SITE_ORIGIN}${entry.canonicalPath}`;
  const ogImage = entry.ogImage || `${SITE_ORIGIN}/og-preview.png`;
  let next = html;

  next = next.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(entry.title)}</title>`);
  next = replaceMetaName(next, "description", entry.description);
  next = replaceMetaProperty(next, "og:title", entry.title);
  next = replaceMetaProperty(next, "og:description", entry.description);
  next = replaceMetaProperty(next, "og:url", canonical);
  next = replaceMetaProperty(next, "og:image", ogImage);
  next = replaceMetaName(next, "twitter:title", entry.title);
  next = replaceMetaName(next, "twitter:description", entry.description);
  next = replaceMetaName(next, "twitter:image", ogImage);
  next = replaceCanonical(next, canonical);
  next = replaceMetaName(next, "robots", entry.noindex ? "noindex,follow" : "index,follow");

  const breadcrumbLd = JSON.stringify(buildBreadcrumbJsonLd(entry));
  const webPageLd = JSON.stringify(buildWebPageJsonLd(entry, canonical));
  const ldBlock =
    `\n    <script type="application/ld+json" data-tdg-seo="breadcrumb">${breadcrumbLd}</script>` +
    `\n    <script type="application/ld+json" data-tdg-seo="webpage">${webPageLd}</script>\n`;

  // Remove prior injected Christmas route LD if re-applying
  next = next.replace(
    /\n?\s*<script type="application\/ld\+json" data-tdg-seo="(?:breadcrumb|webpage)">[\s\S]*?<\/script>/g,
    "",
  );
  next = next.replace(/<\/head>/i, `${ldBlock}  </head>`);

  const shell = buildSeoShell(entry);
  if (/id="tdg-christmas-seo"/.test(next)) {
    next = next.replace(
      /<div id="tdg-christmas-seo"[\s\S]*?<\/div>/,
      shell,
    );
  } else if (/<div id="root"><\/div>/i.test(next)) {
    next = next.replace(
      /<div id="root"><\/div>/i,
      `<div id="root">${shell}</div>`,
    );
  } else if (/<div id="root">/i.test(next)) {
    next = next.replace(/<div id="root">/i, `<div id="root">${shell}`);
  }

  return next;
}
