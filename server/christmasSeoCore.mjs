/**
 * Christmas P0 technical SEO registry + HTML injection for SPA crawlers.
 * Pure Node (no React). Used by origin.mjs and build-time prerender.
 *
 * Injects route-specific <title>, meta, canonical, OG/Twitter, BreadcrumbList,
 * and a semantic body shell inside #root (replaced by createRoot on hydrate).
 */

import { getChristmasContentDepth } from "./christmasContentDepth.mjs";
import {
  buildChristmasHreflangHtml,
  christmasPathForLocale,
  listChristmasPrerenderPaths,
  parseChristmasLocalePath,
} from "./christmasI18n.mjs";
import {
  getChristmasLocale,
  isChristmasLocaleSeoIndexable,
} from "./christmasLocale.mjs";
import {
  faqHeadingForLocale,
  getChristmasLocalizedSeoContent,
  homeLabelForLocale,
} from "./i18n/seo/index.mjs";

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
      { href: "/christmas/send-a-gift", label: "Send a Christmas Gift Online" },
      { href: "/christmas/gift-finder", label: "Find a Christmas Gift They’ll Love" },
      { href: "/christmas/planner", label: "Christmas Planner" },
      { href: "/christmas/wishlist", label: "Create a Christmas Wishlist" },
      { href: "/christmas/photo-generator", label: "AI Christmas Photo Generator" },
      { href: "/christmas/kids", label: "Christmas Portraits for Kids" },
      { href: "/christmas/santa-video", label: "Create a Personalized Santa Video" },
      { href: "/christmas/tree", label: "Build a Digital Christmas Tree" },
      { href: "/christmas/advent", label: "Open the Advent Calendar" },
      { href: "/christmas/cards", label: "Create a Christmas Card" },
      { href: "/christmas/messages", label: "Find a Christmas Message" },
      { href: "/christmas/planner", label: "Christmas Planner" },
    ],
    breadcrumbs: [
      { href: "/", label: "Home" },
      { href: "/christmas", label: "Christmas" },
    ],
    ogImage: `${SITE_ORIGIN}/christmas/og-countdown.jpg`,
  },
  {
    path: "/christmas/send-a-gift",
    title: "Send a Christmas Gift Online | Private Gift Link | TheDigitalGifter",
    description:
      "Create a private Christmas gift link with a personal message and send a digital Christmas experience in seconds.",
    canonicalPath: "/christmas/send-a-gift",
    h1: "Send a Little Christmas Magic",
    lede:
      "Choose a Christmas experience, add a personal message, and share one private gift link. Recipient details stay in the link fragment and are not stored by this page.",
    h2: "Choose a Christmas experience to send",
    h2Body:
      "Send an interactive Christmas gift, portrait experience, personalized Santa video, or digital Christmas card from one privacy-first flow.",
    links: [
      { href: "/christmas/tree-gifts", label: "Open an Interactive Christmas Gift" },
      { href: "/christmas/photo-generator", label: "Christmas Portrait Generator" },
      { href: "/christmas/santa-video", label: "Personalized Santa Video" },
      { href: "/christmas/cards", label: "Christmas Card Maker" },
      { href: "/christmas", label: "All Christmas Experiences" },
    ],
    breadcrumbs: [
      { href: "/", label: "Home" },
      { href: "/christmas", label: "Christmas" },
      { href: "/christmas/send-a-gift", label: "Send a Gift" },
    ],
    ogImage: `${SITE_ORIGIN}/christmas/og-countdown.jpg`,
  },
  {
    path: "/christmas/planner",
    title: "Christmas Planner 2026 | Online Christmas Planning | TheDigitalGifter",
    description:
      "Plan gifts, budget, meals, hosting, cards, and traditions in one interactive Christmas Planner. Not a PDF. Built for phone-first Christmas planning.",
    canonicalPath: "/christmas/planner",
    h1: "Your entire Christmas, beautifully planned.",
    lede:
      "Christmas Planner by The Digital Gifter is an interactive Christmas planning experience — gifts, budget, meals, hosting, cards, and traditions in one place. It is not a PDF.",
    h2: "A digital Christmas planner for the whole season",
    h2Body:
      "Use it as a Christmas gift planner, budget planner, and meal planner. Start on your phone from Instagram or TikTok, pay once, and keep access on your account.",
    links: [
      { href: "/christmas", label: "Christmas at TheDigitalGifter" },
      { href: "/christmas/gift-finder", label: "Christmas Gift Finder" },
      { href: "/christmas/wishlist", label: "Christmas Wishlist" },
      { href: "/christmas/cards", label: "Christmas Cards" },
      { href: "/christmas/messages", label: "Christmas Messages" },
    ],
    breadcrumbs: [
      { href: "/", label: "Home" },
      { href: "/christmas", label: "Christmas" },
      { href: "/christmas/planner", label: "Christmas Planner" },
    ],
    ogImage: `${SITE_ORIGIN}/christmas/cabin-hero-1920.webp`,
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
      { href: "/christmas/send-a-gift", label: "Send a Digital Christmas Gift" },
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
      { href: "/christmas/kids", label: "Kids Christmas Portraits" },
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
      { href: "/christmas/kids", label: "Kids Christmas Portraits" },
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
      "Create a privacy-first Christmas portrait for a child or siblings from a photo you have permission to use.",
    canonicalPath: "/christmas/kids",
    h1: "Create a Magical Christmas Portrait for Your Kids",
    lede:
      "With parent or guardian permission, upload a clear photo and create a private Christmas portrait for a child or siblings.",
    h2: "Private by default, built for family-safe use",
    h2Body:
      "No public gallery, and the flow does not ask for school, address, phone, or social profile details.",
    links: [
      { href: "/christmas/family", label: "Family Christmas Portraits" },
      { href: "/christmas/santa-video", label: "Personalized Santa Video" },
      { href: "/christmas/photo-generator", label: "AI Christmas Photo Generator" },
      { href: "/christmas/cards", label: "Christmas Card Maker" },
      { href: "/christmas", label: "Christmas home" },
    ],
    breadcrumbs: [
      { href: "/", label: "Home" },
      { href: "/christmas", label: "Christmas" },
      { href: "/christmas/kids", label: "Kids" },
    ],
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
    path: "/christmas/santa-call",
    title: "Personalized Santa Call | Talk to Santa Online | TheDigitalGifter",
    description:
      "A private 3-minute AI Santa call in the browser. Romania 59 RON · US $12.99. Optional 5-minute extensions. Adult supervision. Instant email delivery.",
    canonicalPath: "/christmas/santa-call",
    h1: "A Magical Call with Santa. Made Just for Your Child.",
    lede:
      "A private, AI-powered voice conversation with Santa in the browser — not a phone dial to your child. 59 RON / 3 minutes in Romania · $12.99 in the US.",
    h2: "How the Santa call works",
    h2Body:
      "Personalize a few parent details, pay securely, open the private link from email, and talk for three minutes. Optional paid five-minute extensions anytime.",
    links: [
      { href: "/christmas/personalized-santa-call", label: "Personalized Santa Call guide" },
      { href: "/christmas/ai-santa-phone-call", label: "AI Santa phone call explained" },
      { href: "/christmas/last-minute-digital-christmas-gifts", label: "Last-minute digital gifts" },
      { href: "/christmas/santa-video", label: "Personalized Santa Video" },
      { href: "/christmas", label: "Christmas home" },
    ],
    breadcrumbs: [
      { href: "/", label: "Home" },
      { href: "/christmas", label: "Christmas" },
      { href: "/christmas/santa-call", label: "Santa Call" },
    ],
    ogImage: `${SITE_ORIGIN}/assets/christmas/north-pole-santa/posters/north_pole_santa_reel_hq.jpg`,
    // Live commercial product (CHRISTMAS_LIVE_PRODUCTS includes christmas_santa_voice_call).
    noindex: false,
  },
  {
    path: "/christmas/personalized-santa-call",
    title: "Personalized Santa Call for Kids | Live AI Voice | TheDigitalGifter",
    description:
      "Book a personalized AI Santa call that uses your child’s name and details. Private browser session, adult supervision, Romania 59 RON · US $12.99.",
    canonicalPath: "/christmas/personalized-santa-call",
    h1: "Personalized Santa calls that use your child’s name",
    lede:
      "Parents personalize a few details, pay securely, then open a private browser link for a 3-minute AI Santa conversation — not a cold phone dial.",
    h2: "Who this is for",
    h2Body:
      "Families who want a last-minute magical moment without shipping delays. Best for ages that can talk with an adult nearby. Extensions available after the first call.",
    links: [
      { href: "/christmas/santa-call", label: "Start Santa Call checkout" },
      { href: "/christmas/santa-video", label: "Prefer a Santa video instead" },
      { href: "/christmas/last-minute-digital-christmas-gifts", label: "More last-minute digital gifts" },
    ],
    breadcrumbs: [
      { href: "/", label: "Home" },
      { href: "/christmas", label: "Christmas" },
      { href: "/christmas/personalized-santa-call", label: "Personalized Santa Call" },
    ],
    ogImage: `${SITE_ORIGIN}/assets/christmas/north-pole-santa/posters/north_pole_santa_reel_hq.jpg`,
    noindex: false,
  },
  {
    path: "/christmas/ai-santa-phone-call",
    title: "AI Santa Phone Call in the Browser | Not a Dialer | TheDigitalGifter",
    description:
      "Clarify the difference: our AI Santa call runs in a private browser room with voice AI — not a PSTN phone call to your child. Pricing and supervision explained.",
    canonicalPath: "/christmas/ai-santa-phone-call",
    h1: "AI Santa “phone call” — what you actually get",
    lede:
      "Searchers looking for an AI Santa phone call usually want a live voice moment. Ours is a secure browser session with Santa voice AI, email delivery of the private link, and adult control.",
    h2: "Browser call vs traditional phone",
    h2Body:
      "No phone number is dialed to the child. You open the private link, stay present, and Santa responds with personalized details you provided. Romania 59 RON / 3 minutes · US $12.99.",
    links: [
      { href: "/christmas/santa-call", label: "Open Santa Call" },
      { href: "/christmas/personalized-santa-call", label: "Personalized Santa Call guide" },
      { href: "/christmas", label: "Christmas home" },
    ],
    breadcrumbs: [
      { href: "/", label: "Home" },
      { href: "/christmas", label: "Christmas" },
      { href: "/christmas/ai-santa-phone-call", label: "AI Santa Phone Call" },
    ],
    ogImage: `${SITE_ORIGIN}/assets/christmas/north-pole-santa/posters/north_pole_santa_reel_hq.jpg`,
    noindex: false,
  },
  {
    path: "/christmas/last-minute-digital-christmas-gifts",
    title: "Last-Minute Digital Christmas Gifts | Deliver Tonight | TheDigitalGifter",
    description:
      "Digital Christmas gifts you can finish tonight: personalized Santa call, Santa video, cards, photo portraits, and a Christmas story preview — no shipping wait.",
    canonicalPath: "/christmas/last-minute-digital-christmas-gifts",
    h1: "Last-minute digital Christmas gifts that still feel personal",
    lede:
      "When there is no time for shipping, choose a gift that arrives by link: a Santa call, a personalized video, a card, or a portrait. Prices shown on each product page.",
    h2: "Fast options that stay thoughtful",
    h2Body:
      "Start with Santa Call for a live moment, Santa Video for an asynchronous keepable clip, or cards/photos when you need something quieter. Christmas Story remains preview-only until owner price approval.",
    links: [
      { href: "/christmas/santa-call", label: "Santa Call (live)" },
      { href: "/christmas/santa-video", label: "Santa Video" },
      { href: "/christmas-story", label: "Christmas Story preview" },
      { href: "/christmas/cards", label: "Christmas cards" },
    ],
    breadcrumbs: [
      { href: "/", label: "Home" },
      { href: "/christmas", label: "Christmas" },
      { href: "/christmas/last-minute-digital-christmas-gifts", label: "Last-minute digital gifts" },
    ],
    noindex: false,
  },
  {
    path: "/christmas/apel-mos-craciun",
    contentLang: "ro",
    title: "Apel de la Moș Crăciun | 59 lei | TheDigitalGifter",
    description:
      "Apel personalizat de la Moș Crăciun AI pentru copilul tău. 3 minute în browser, 59 lei în România. Link privat pe email. Supraveghere adult.",
    canonicalPath: "/christmas/apel-mos-craciun",
    h1: "Apel de la Moș Crăciun — personalizat, în browser",
    lede:
      "Completezi câteva detalii, plătești securizat și primești linkul privat pe email. Copilul vorbește cu Moșul 3 minute, cu un adult alături.",
    h2: "De ce e diferit de un telefon clasic",
    h2Body:
      "Nu formăm numărul copilului. Sesiunea rulează într-o cameră privată din browser, cu voce AI. Prelungire opțională 49 lei / 5 minute.",
    links: [
      { href: "/ro/christmas/santa-call", label: "Începe apelul cu Moșul" },
      { href: "/christmas/cadouri-digitale-de-craciun", label: "Cadouri digitale de Crăciun" },
      { href: "/ro/christmas", label: "Crăciun" },
    ],
    breadcrumbs: [
      { href: "/", label: "Home" },
      { href: "/christmas", label: "Christmas" },
      { href: "/christmas/apel-mos-craciun", label: "Apel Moș Crăciun" },
    ],
    ogImage: `${SITE_ORIGIN}/assets/christmas/north-pole-santa/posters/north_pole_santa_reel_hq.jpg`,
    noindex: false,
  },
  {
    path: "/christmas/apel-personalizat-mos-craciun",
    contentLang: "ro",
    title: "Apel Personalizat Moș Crăciun | Vorbește cu Moșul | TheDigitalGifter",
    description:
      "Vorbește cu Moș Crăciun într-un apel personalizat AI: numele copilului, dorințe și detalii pe care le-ai scris tu. 59 lei / 3 minute.",
    canonicalPath: "/christmas/apel-personalizat-mos-craciun",
    h1: "Apel personalizat cu Moș Crăciun",
    lede:
      "Moșul folosește numele și detaliile pe care le-ai trimis. Ideal când vrei o surpriză rapidă, fără livrare fizică.",
    h2: "Pașii simpli",
    h2Body:
      "Personalizare → plată → email cu link → apel de 3 minute. Poți prelungi conversația dacă vrem să continue magia.",
    links: [
      { href: "/ro/christmas/santa-call", label: "Către checkout Apel Moș" },
      { href: "/christmas/apel-mos-craciun", label: "Ghid Apel de la Moș" },
      { href: "/christmas/cadouri-de-ultim-moment", label: "Cadouri de ultim moment" },
    ],
    breadcrumbs: [
      { href: "/", label: "Home" },
      { href: "/christmas", label: "Christmas" },
      { href: "/christmas/apel-personalizat-mos-craciun", label: "Apel personalizat" },
    ],
    ogImage: `${SITE_ORIGIN}/assets/christmas/north-pole-santa/posters/north_pole_santa_reel_hq.jpg`,
    noindex: false,
  },
  {
    path: "/christmas/cadouri-digitale-de-craciun",
    contentLang: "ro",
    title: "Cadouri Digitale de Crăciun | Livrare pe Link | TheDigitalGifter",
    description:
      "Cadouri digitale de Crăciun gata în câteva minute: apel Moș Crăciun, video personalizat, felicitări și portrete. Fără așteptat curierul.",
    canonicalPath: "/christmas/cadouri-digitale-de-craciun",
    h1: "Cadouri digitale de Crăciun pe care le poți trimite azi",
    lede:
      "Alege un cadou care ajunge pe link: apel live cu Moșul, video, felicitare sau portret. Prețurile apar pe pagina produsului.",
    h2: "Ce merită când timpul e scurt",
    h2Body:
      "Apelul cu Moșul e cel mai interactiv. Video-ul rămâne amintire. Felicitările și portretele sunt mai liniștite. Christmas Story e încă în preview — fără plată live.",
    links: [
      { href: "/ro/christmas/santa-call", label: "Apel Moș Crăciun" },
      { href: "/ro/christmas/santa-video", label: "Video Moș Crăciun" },
      { href: "/christmas-story", label: "Christmas Story (preview)" },
    ],
    breadcrumbs: [
      { href: "/", label: "Home" },
      { href: "/christmas", label: "Christmas" },
      { href: "/christmas/cadouri-digitale-de-craciun", label: "Cadouri digitale" },
    ],
    noindex: false,
  },
  {
    path: "/christmas/cadouri-de-ultim-moment",
    contentLang: "ro",
    title: "Cadouri de Ultim Moment de Crăciun | Digitale | TheDigitalGifter",
    description:
      "Cadouri de ultim moment fără curier: apel personalizat cu Moș Crăciun, video, carduri și portrete digitale. Livrare pe email.",
    canonicalPath: "/christmas/cadouri-de-ultim-moment",
    h1: "Cadouri de ultim moment care totuși par gândite",
    lede:
      "Când magazinul e închis și curierul e plin, un cadou digital personalizat încă poate ajunge diseară.",
    h2: "Ordinea recomandată",
    h2Body:
      "1) Apel Moș dacă vrei o surpriză live. 2) Video dacă vrei ceva de păstrat. 3) Card sau portret pentru un gest mai scurt. Verifică prețul pe pagina produsului înainte de plată.",
    links: [
      { href: "/ro/christmas/santa-call", label: "Apel Moș — live" },
      { href: "/christmas/last-minute-digital-christmas-gifts", label: "EN last-minute guide" },
      { href: "/christmas/cadouri-digitale-de-craciun", label: "Cadouri digitale" },
    ],
    breadcrumbs: [
      { href: "/", label: "Home" },
      { href: "/christmas", label: "Christmas" },
      { href: "/christmas/cadouri-de-ultim-moment", label: "Cadouri de ultim moment" },
    ],
    noindex: false,
  },
  {
    path: "/christmas/personalized-christmas-story",
    title: "Personalized Christmas Story Gift | Preview | TheDigitalGifter",
    description:
      "Preview Our Christmas Story: personal song, memory film, private album and hidden letter. Checkout is not enabled until price and launch are owner-approved.",
    canonicalPath: "/christmas/personalized-christmas-story",
    h1: "A personalized Christmas story gift — preview first",
    lede:
      "Explore the Emma sample and personalize a free preview. Purchases stay off until the commercial price is approved. Planned display price is not an approved live offer.",
    h2: "What is included when live",
    h2Body:
      "Song, memory film, interactive album, and a hidden letter on a private recipient page. Until then: demo + draft personalization only.",
    links: [
      { href: "/christmas-story", label: "Open Christmas Story preview" },
      { href: "/christmas/santa-call", label: "Buy a live Santa Call instead" },
      { href: "/christmas/last-minute-digital-christmas-gifts", label: "Other digital gifts" },
    ],
    breadcrumbs: [
      { href: "/", label: "Home" },
      { href: "/christmas", label: "Christmas" },
      { href: "/christmas/personalized-christmas-story", label: "Personalized Christmas Story" },
    ],
    noindex: false,
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
  const base = CHRISTMAS_SEO_ROUTES.map((r) => r.path);
  const localized = listChristmasPrerenderPaths();
  return [...base, ...localized];
}

/**
 * Resolve SEO entry for a public pathname (EN unprefixed or /{locale}/...).
 * Incomplete localized routes return an EN-content shell with noindex.
 */
export function resolveChristmasSeoRequest(pathname) {
  const parsed = parseChristmasLocalePath(pathname);
  const baseEntry = BY_PATH.get(normalizeSeoPath(parsed.basePath)) ?? null;
  if (!baseEntry) return null;

  const localeCode = parsed.locale;
  const locale = getChristmasLocale(localeCode);

  // Prefixed English aliases are redirected by origin; if applied, use unprefixed EN entry.
  if (parsed.urlPrefix === "en") {
    return {
      locale: "en",
      basePath: parsed.basePath,
      publicPath: parsed.basePath,
      entry: { ...baseEntry, canonicalPath: baseEntry.canonicalPath || parsed.basePath },
      depthOverride: null,
      indexable: !baseEntry.noindex && isChristmasLocaleSeoIndexable("en", parsed.basePath),
      incomplete: false,
      htmlLang: "en",
      dir: "ltr",
    };
  }

  if (localeCode === "en" || !parsed.isPrefixed) {
    // Romanian-primary commercial guides live on unprefixed paths with RO copy.
    const contentLang = baseEntry.contentLang === "ro" ? "ro" : "en";
    return {
      locale: contentLang === "ro" ? "ro" : "en",
      basePath: parsed.basePath,
      publicPath: parsed.basePath,
      entry: baseEntry,
      depthOverride: null,
      indexable: !baseEntry.noindex && isChristmasLocaleSeoIndexable("en", parsed.basePath),
      incomplete: false,
      htmlLang: contentLang,
      dir: "ltr",
    };
  }

  if (!locale?.enabled) return null;

  const localized = getChristmasLocalizedSeoContent(localeCode, parsed.basePath);
  const indexable = isChristmasLocaleSeoIndexable(localeCode, parsed.basePath);
  const publicPath = christmasPathForLocale(parsed.basePath, localeCode);

  // Content-complete + product-ready → indexable localized shell
  if (indexable && localized) {
    return {
      locale: localeCode,
      basePath: parsed.basePath,
      publicPath,
      entry: {
        path: publicPath,
        title: localized.title,
        description: localized.description,
        canonicalPath: publicPath,
        h1: localized.h1,
        lede: localized.lede,
        h2: localized.h2,
        h2Body: localized.h2Body,
        links: localized.links || [],
        breadcrumbs: [
          { href: "/", label: homeLabelForLocale(localeCode) },
          ...(localized.breadcrumbs || []),
        ],
        noindex: false,
        ogImage: baseEntry.ogImage,
      },
      depthOverride: {
        geo: localized.geo,
        sections: localized.sections || [],
        faqs: localized.faqs || [],
        wave: "p3b",
      },
      indexable: true,
      incomplete: false,
      htmlLang: locale.htmlLang,
      dir: locale.dir,
    };
  }

  // Localized content exists but product/SEO gate says noindex (e.g. Santa DE).
  // Still emit localized SSR shell so UX matches language switcher, never index.
  if (localized) {
    return {
      locale: localeCode,
      basePath: parsed.basePath,
      publicPath,
      entry: {
        path: publicPath,
        title: localized.title,
        description: localized.description,
        canonicalPath: publicPath,
        h1: localized.h1,
        lede: localized.lede,
        h2: localized.h2,
        h2Body: localized.h2Body,
        links: localized.links || [],
        breadcrumbs: [
          { href: "/", label: homeLabelForLocale(localeCode) },
          ...(localized.breadcrumbs || []),
        ],
        noindex: true,
        ogImage: baseEntry.ogImage,
      },
      depthOverride: {
        geo: localized.geo,
        sections: localized.sections || [],
        faqs: localized.faqs || [],
        wave: "p3b",
      },
      indexable: false,
      incomplete: true,
      htmlLang: locale.htmlLang,
      dir: locale.dir,
    };
  }

  // No translation pack: soft EN shell, never index.
  return {
    locale: localeCode,
    basePath: parsed.basePath,
    publicPath,
    entry: {
      ...baseEntry,
      path: publicPath,
      canonicalPath: publicPath,
      noindex: true,
    },
    depthOverride: null,
    indexable: false,
    incomplete: true,
    htmlLang: "en",
    dir: "ltr",
  };
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

function buildDepthHtmlFromDepth(depth, faqHeading = "Frequently Asked Questions") {
  if (!depth) return "";

  const sections = (depth.sections || [])
    .map((section) => {
      const list = section.list
        ? `<ul>${section.list
            .map((item) => {
              const arrow = item.includes(" → ") ? item.split(" → ") : null;
              if (arrow && arrow[1]?.startsWith("/")) {
                return `<li><a href="${escapeAttr(arrow[1])}">${escapeHtml(arrow[0])}</a></li>`;
              }
              return `<li>${escapeHtml(item)}</li>`;
            })
            .join("")}</ul>`
        : "";
      const link =
        section.linkHref && section.linkLabel
          ? `<p><a href="${escapeAttr(section.linkHref)}">${escapeHtml(section.linkLabel)}</a></p>`
          : "";
      return (
        `<section data-tdg-depth-section="${escapeAttr(section.h2)}">` +
        `<h2>${escapeHtml(section.h2)}</h2>` +
        `<p>${escapeHtml(section.body)}</p>` +
        list +
        link +
        `</section>`
      );
    })
    .join("");

  const geo = depth.geo
    ? `<section data-tdg-geo="true">` +
      `<h2>${escapeHtml(depth.geo.h2)}</h2>` +
      `<p>${escapeHtml(depth.geo.body)}</p>` +
      `</section>`
    : "";

  // Use <article>, not nested <div>, so shell replace stays robust if a
  // non-nested-aware matcher ever runs against prerendered HTML.
  const faqs = depth.faqs?.length
    ? `<section data-tdg-faq="true"><h2>${escapeHtml(faqHeading)}</h2>${depth.faqs
        .map(
          (item) =>
            `<article><h3>${escapeHtml(item.q)}</h3><p>${escapeHtml(item.a)}</p></article>`,
        )
        .join("")}</section>`
    : "";

  return geo + sections + faqs;
}

/**
 * Replace the entire #tdg-christmas-seo element, including nested tags.
 * A naïve /[\s\S]*?<\/div>/ match stops at the first nested </div> and leaves
 * orphan FAQ markup (seen live when origin re-applies SEO onto prerendered shells).
 */
function replaceChristmasSeoShell(html, shell) {
  const openRe = /<div\b[^>]*\bid="tdg-christmas-seo"[^>]*>/i;
  const openMatch = openRe.exec(html);
  if (!openMatch) return html;

  const start = openMatch.index;
  let pos = start + openMatch[0].length;
  let depth = 1;

  while (pos < html.length && depth > 0) {
    const nextOpen = html.indexOf("<div", pos);
    const nextClose = html.indexOf("</div>", pos);
    if (nextClose === -1) {
      // Malformed shell — fall back to stripping from open tag to EOF root close.
      return `${html.slice(0, start)}${shell}`;
    }

    if (nextOpen !== -1 && nextOpen < nextClose) {
      const after = html.charAt(nextOpen + 4);
      if (after === " " || after === ">" || after === "\n" || after === "\t" || after === "/") {
        depth += 1;
      }
      pos = nextOpen + 4;
      continue;
    }

    depth -= 1;
    pos = nextClose + 6;
  }

  return `${html.slice(0, start)}${shell}${html.slice(pos)}`;
}

function buildDepthHtml(pathname) {
  return buildDepthHtmlFromDepth(getChristmasContentDepth(pathname));
}

function buildFaqJsonLdFromFaqs(faqs) {
  if (!faqs?.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  };
}

function buildFaqJsonLd(pathname) {
  const depth = getChristmasContentDepth(pathname);
  return buildFaqJsonLdFromFaqs(depth?.faqs);
}

function buildSeoShell(entry, options = {}) {
  const { depthOverride = null, locale = "en", basePath = entry.path } = options;
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
  const depth =
    depthOverride ||
    getChristmasContentDepth(basePath) ||
    null;
  const faqHeading =
    faqHeadingForLocale(locale);
  const depthHtml = buildDepthHtmlFromDepth(depth, faqHeading);
  const depthWave = depth?.wave || (depthHtml ? "content" : "");
  const depthAttr = depthWave ? ` data-tdg-depth="${escapeAttr(depthWave)}"` : "";

  return (
    `<div id="tdg-christmas-seo" data-tdg-seo="christmas"${depthAttr} data-path="${escapeAttr(entry.path)}" data-locale="${escapeAttr(locale)}">` +
    `<nav aria-label="Breadcrumb">${crumbs}</nav>` +
    `<h1>${escapeHtml(entry.h1)}</h1>` +
    `<p>${escapeHtml(entry.lede)}</p>` +
    h2 +
    `<ul>${links}</ul>` +
    depthHtml +
    `</div>`
  );
}

function replaceHtmlLangDir(html, lang, dir) {
  let next = html.replace(/<html\b[^>]*>/i, (tag) => {
    let out = tag;
    if (/\blang=/.test(out)) {
      out = out.replace(/\blang="[^"]*"/i, `lang="${escapeAttr(lang)}"`);
    } else {
      out = out.replace(/<html/i, `<html lang="${escapeAttr(lang)}"`);
    }
    if (/\bdir=/.test(out)) {
      out = out.replace(/\bdir="[^"]*"/i, `dir="${escapeAttr(dir)}"`);
    } else {
      out = out.replace(/<html/i, `<html dir="${escapeAttr(dir)}"`);
    }
    return out;
  });
  return next;
}

function replaceHreflangBlock(html, basePath) {
  const block = buildChristmasHreflangHtml(basePath);
  let next = html.replace(
    /\n?\s*<link\s+rel="alternate"\s+hreflang="[^"]*"\s+href="[^"]*"\s*\/>/gi,
    "",
  );
  if (!block) return next;
  return next.replace(/<\/head>/i, `    ${block}\n  </head>`);
}

/**
 * Rewrite SPA index.html with route-specific SEO head + body shell.
 * @param {string} html
 * @param {string} pathname
 * @returns {string}
 */
export function applyChristmasSeo(html, pathname) {
  const resolved = resolveChristmasSeoRequest(pathname);
  if (!resolved) return html;

  const { entry, locale, basePath, depthOverride, indexable, htmlLang, dir } =
    resolved;
  const canonical = `${SITE_ORIGIN}${entry.canonicalPath}`;
  const ogImage = entry.ogImage || `${SITE_ORIGIN}/og-preview.png`;
  let next = html;

  next = replaceHtmlLangDir(next, htmlLang || "en", dir || "ltr");
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

  const robots = !indexable || entry.noindex ? "noindex,follow" : "index,follow";
  next = replaceMetaName(next, "robots", robots);

  // Hreflang only for complete/indexable clusters (incomplete pages still get English cluster if EN base is indexable — but only when this page itself is indexable)
  if (indexable && !entry.noindex) {
    next = replaceHreflangBlock(next, basePath);
  } else {
    next = replaceHreflangBlock(next, ""); // strip any prior
  }

  const breadcrumbLd = JSON.stringify(buildBreadcrumbJsonLd(entry));
  const webPageLd = JSON.stringify({
    ...buildWebPageJsonLd(entry, canonical),
    inLanguage: htmlLang || "en",
  });
  const faqSource = depthOverride?.faqs || getChristmasContentDepth(basePath)?.faqs;
  const faqLd = buildFaqJsonLdFromFaqs(faqSource);
  const ldBlock =
    `\n    <script type="application/ld+json" data-tdg-seo="breadcrumb">${breadcrumbLd}</script>` +
    `\n    <script type="application/ld+json" data-tdg-seo="webpage">${webPageLd}</script>` +
    (faqLd
      ? `\n    <script type="application/ld+json" data-tdg-seo="faq">${JSON.stringify(faqLd)}</script>`
      : "") +
    `\n`;

  next = next.replace(
    /\n?\s*<script type="application\/ld\+json" data-tdg-seo="(?:breadcrumb|webpage|faq)">[\s\S]*?<\/script>/g,
    "",
  );
  next = next.replace(/<\/head>/i, `${ldBlock}  </head>`);

  const shell = buildSeoShell(entry, { depthOverride, locale, basePath });
  if (/id="tdg-christmas-seo"/.test(next)) {
    next = replaceChristmasSeoShell(next, shell);
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
