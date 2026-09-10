/**
 * Localization-ready copy for the /christmas flagship landing.
 * Keys are stable; locale packs can be added without rewriting scenes.
 * English ships now. Longer translated strings should wrap via CSS, not truncation.
 */

export const CHRISTMAS_LANDING_LOCALES = ["en"] as const;
export type ChristmasLandingLocale = (typeof CHRISTMAS_LANDING_LOCALES)[number];

export const CHRISTMAS_LANDING_DEFAULT_LOCALE: ChristmasLandingLocale = "en";

/** Future RTL locales (ar, he, …) should flip this map — do not hardcode dir in scenes. */
export const LANDING_LOCALE_DIR: Record<string, "ltr" | "rtl"> = {
  en: "ltr",
  ar: "rtl",
  he: "rtl",
  fa: "rtl",
  ur: "rtl",
};

type CopyBag = Record<string, string>;

const EN: CopyBag = {
  "seo.title": "Christmas Gifts, Portraits & Santa Messages | TheDigitalGifter",
  "seo.description":
    "Create an unforgettable Christmas: find the perfect gift, turn a photo into a Christmas portrait, send a Santa video that says their name, share a wishlist, decorate a tree, open Advent, and write a card that feels personal.",
  "hero.eyebrow": "Christmas at The Digital Gifter",
  "hero.h1": "Create something they’ll remember.",
  "hero.lede":
    "Step into a living Christmas world — gifts under the tree, portraits by the fire, and a message from Santa made just for them.",
  "hero.cta": "Start creating",
  "hero.secondary": "Explore this Christmas",
  "hero.alt": "A luxury mountain cabin at Christmas with floor-to-ceiling windows, a stone fireplace, and a glowing tree",
  "hero.countdown.eyebrow": "Christmas is coming",
  "hero.countdown.days": "Days",
  "hero.countdown.hours": "Hours",
  "hero.countdown.minutes": "Minutes",
  "hero.countdown.seconds": "Seconds",
  "hero.countdown.until": "until Christmas",
  "hero.countdown.arrived": "Merry Christmas — the magic is here.",
  "transition.kicker": "Christmas is more than one gift.",
  "transition.h2": "Turn this season into something magical.",
  "transition.lede": "Keep scrolling. The same room opens into every Christmas moment you might need.",
  "gifts.kicker": "Christmas gifts",
  "gifts.h2": "Open a gift under the tree.",
  "gifts.lede":
    "Tap a glowing present. Reveal a free Christmas surprise — portraits, cards, credits, and more.",
  "gifts.cta": "Find the Perfect Gift",
  "gifts.mom": "Mom",
  "gifts.dad": "Dad",
  "gifts.partner": "Partner",
  "gifts.friend": "Friend",
  "gifts.kids": "Kids",
  "gifts.hint": "Choose a person. The gifts will answer.",
  "gifts.react.mom": "Something thoughtful, warm, and a little luxurious — just for her.",
  "gifts.react.dad": "Useful, surprising, and chosen with care — he’ll notice.",
  "gifts.react.partner": "A gift that feels like a memory, not a receipt.",
  "gifts.react.friend": "The kind of present that makes a friend feel seen.",
  "gifts.react.kids": "Wonder first. Then the smile they can’t fake.",
  "portraits.kicker": "Christmas portraits",
  "portraits.h2": "Turn a favorite photo into Christmas magic.",
  "portraits.lede": "For families, couples and pets. The frame on the mantel becomes the portrait you’ll keep.",
  "portraits.cta": "Create a Christmas Portrait",
  "portraits.family": "Family",
  "portraits.couples": "Couples",
  "portraits.pets": "Pets",
  "portraits.alt.family": "A family Christmas portrait in a gold frame on the mantel",
  "portraits.alt.couples": "A romantic Christmas couple portrait in a gold frame",
  "portraits.alt.pets": "A Christmas pet portrait in a gold frame",
  "portraits.alt.before": "An everyday family photo before it becomes a Christmas portrait",
  "santa.kicker": "Santa video",
  "santa.h2": "Imagine Santa saying their name.",
  "santa.h2Personalized": "Santa has a message for {name}...",
  "santa.lede": "A magical message from Santa, made just for them. Start with their name.",
  "santa.bubble": "Ho ho ho, I’m Santa!",
  "santa.bubblePersonalized": "{name}? I know that name...",
  "santa.label": "Your kid’s name",
  "santa.placeholder": "Emma",
  "santa.placeholders": "Emma|Noah|Sofia|Oliver",
  "santa.cta": "Let Santa Say Their Name",
  "santa.ctaPersonalized": "Create {name}'s Santa Message",
  "santa.reassurance": "It only takes a moment to create the magic.",
  "santa.alt": "Santa standing in the Christmas room, speaking a personal greeting",
  "santa.error": "Please enter a first name using letters, spaces, hyphens, or apostrophes.",
  "wishlist.kicker": "Wishlist",
  "wishlist.h2": "One wishlist. Anything from anywhere.",
  "wishlist.lede": "Share it without ruining the surprise. A letter to Santa that becomes something you can actually use.",
  "wishlist.cta": "Create My Wishlist",
  "wishlist.alt": "A handwritten letter to Santa slipping from a cream envelope",
  "tree.kicker": "Christmas tree",
  "tree.h2": "Build a Christmas tree filled with gifts, memories and surprises.",
  "tree.lede": "Share it with someone you love. Lights, ornaments, and little messages that appear as they open it.",
  "tree.cta": "Create Your Christmas Tree",
  "advent.kicker": "Advent",
  "advent.h2": "A little Christmas magic every day.",
  "advent.lede": "Open today’s surprise. Come back tomorrow. The season becomes a ritual, not a rush.",
  "advent.cta": "Open Today’s Door",
  "advent.alt": "A wooden Advent calendar on a Christmas table — a door opens and warm light spills out",
  "advent.today": "Today’s door is glowing",
  "cards.kicker": "Christmas cards",
  "cards.h2": "Some messages deserve more than a text.",
  "cards.lede": "Create a Christmas card that feels personal — something they can hold, save, and send.",
  "cards.cta": "Create a Christmas Card",
  "cards.hint": "Tap the card to open it",
  "cards.alt": "A Christmas card you can open — elegant, family, romantic, or funny",
  "cards.elegant": "Elegant",
  "cards.family": "Family",
  "cards.romantic": "Romantic",
  "cards.funny": "Funny",
  "messages.kicker": "Messages",
  "messages.h2": "Sometimes you know what you feel.",
  "messages.lede": "You just don’t know how to say it. We’ll help you find the words — then you make them yours.",
  "messages.cta": "Write My Christmas Message",
  "messages.alt": "A cream Christmas letter on a wooden desk, with the words writing themselves",
  "messages.for": "For",
  "messages.tone": "Tone",
  "messages.heartfelt": "Heartfelt",
  "messages.funny": "Funny",
  "messages.warm": "Warm",
  "finale.kicker": "This Christmas",
  "finale.h2": "Make this Christmas unforgettable.",
  "finale.lede": "The room is fuller now. The lights are on. Start creating — a gift, a portrait, a message, a moment.",
  "finale.cta": "Start creating",
  "finale.alt": "The same Christmas living room, warmer and more complete, with lights and gifts",
  "faq.h2": "Christmas questions",
  "faq.1.q": "What can I create for Christmas with The Digital Gifter?",
  "faq.1.a":
    "The Christmas collection includes a gift finder, Christmas portraits for families, couples and pets, a personalized Santa video, a shareable wishlist, an interactive Christmas tree, an Advent calendar, Christmas cards, and a message writer.",
  "faq.2.q": "Can Santa say my child’s name?",
  "faq.2.a":
    "Yes. Enter their first name on this page and continue to the Santa video experience. The name is carried into the next step so you can personalize a message from Santa.",
  "faq.3.q": "Do I need design skills?",
  "faq.3.a":
    "No. Each Christmas experience is guided. Upload a photo, choose who you’re shopping for, or start with a name — then we help you finish something that feels personal.",
  "faq.4.q": "Is this for digital gifts, physical gifts, or both?",
  "faq.4.a":
    "Both. Find a gift from anywhere, build a wishlist you can share privately, and create digital Christmas portraits, cards, and Santa messages to send.",
  "faq.5.q": "Will this work on my phone?",
  "faq.5.a":
    "Yes. The Christmas landing and every experience are designed to feel magical on a phone first, with large tap targets and a simple vertical story.",
  "nav.gifts": "Gifts under the tree",
  "nav.finder": "Gift finder",
  "nav.portraits": "Portraits",
  "nav.santa": "Santa",
  "nav.wishlist": "Wishlist",
  "nav.tree": "Tree",
  "nav.advent": "Advent",
  "nav.cards": "Cards",
  "nav.messages": "Messages",
};

const PACKS: Record<ChristmasLandingLocale, CopyBag> = { en: EN };

export function landingT(
  key: string,
  locale: ChristmasLandingLocale = CHRISTMAS_LANDING_DEFAULT_LOCALE,
): string {
  return PACKS[locale]?.[key] ?? EN[key] ?? key;
}

export function landingDir(locale: string): "ltr" | "rtl" {
  return LANDING_LOCALE_DIR[locale] ?? "ltr";
}

export const LANDING_COPY_KEYS = Object.keys(EN);
