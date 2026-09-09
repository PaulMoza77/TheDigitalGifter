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
    "Christmas at The Digital Gifter: Gift Finder ideas, portraits, a Santa video that says their name, a shareable wishlist, a Christmas Tree you decorate, Advent, cards, and personal messages.",
  "hero.eyebrow": "Christmas at The Digital Gifter",
  "hero.h1": "Create something they’ll remember.",
  "hero.lede":
    "Portraits by the fire, a message from Santa, and a Gift Finder for someone you love — then a wishlist, a tree you decorate, and a card worth sending.",
  "hero.cta": "Start creating",
  "hero.secondary": "Explore this Christmas",
  "hero.alt": "A cozy Christmas living room with a glowing tree, fireplace, and wrapped gifts",
  "transition.kicker": "Christmas is more than one gift.",
  "transition.h2": "Turn this season into something magical.",
  "transition.lede": "Keep scrolling. The same room opens into every Christmas moment you might need.",
  "gifts.kicker": "Gift Finder",
  "gifts.h2": "Who are you shopping for?",
  "gifts.lede": "Pick a person. We’ll help you find a Christmas gift idea they’ll actually love.",
  "gifts.note": "Gift Finder finds ideas. It is not Send a Gift, and it is not a Christmas Tree.",
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
  "santa.lede": "A magical message from Santa, made just for them. Start with their name.",
  "santa.bubble": "Ho ho ho, I’m Santa!",
  "santa.label": "Your kid’s name",
  "santa.placeholder": "Emma",
  "santa.cta": "Let Santa speak to them",
  "santa.alt": "Santa standing in the Christmas room, speaking a personal greeting",
  "santa.error": "Please enter a first name using letters only.",
  "wishlist.kicker": "Wishlist",
  "wishlist.h2": "One wishlist. Anything from anywhere.",
  "wishlist.lede": "Share it without ruining the surprise. A letter to Santa that becomes something you can actually use.",
  "wishlist.cta": "Create My Wishlist",
  "wishlist.alt": "A handwritten letter to Santa slipping from a cream envelope",
  "tree.kicker": "Shareable Christmas Tree",
  "tree.h2": "Decorate a Christmas Tree they can open with you.",
  "tree.lede": "Lights, ornaments, and little messages on a tree you share — not a gift-idea list, and not a prepaid send.",
  "tree.note": "Christmas Tree is a tree you decorate and share. Not Gift Finder. Not Send a Gift.",
  "tree.cta": "Decorate a Christmas Tree",
  "advent.kicker": "Advent",
  "advent.h2": "A little Christmas magic every day.",
  "advent.lede": "Open today’s surprise. Come back tomorrow. The season becomes a ritual, not a rush.",
  "advent.cta": "Open Today’s Door",
  "advent.alt": "An elegant wooden Advent calendar with one glowing door for today",
  "advent.today": "Today’s door",
  "cards.kicker": "Christmas cards",
  "cards.h2": "Some messages deserve more than a text.",
  "cards.lede": "Create a Christmas card that feels personal — something they can hold, save, and send.",
  "cards.cta": "Create a Christmas Card",
  "cards.elegant": "Elegant",
  "cards.family": "Family",
  "cards.romantic": "Romantic",
  "cards.funny": "Funny",
  "cards.alt": "An open Christmas card on a wooden table beside pine and candlelight",
  "messages.kicker": "Messages",
  "messages.h2": "Sometimes you know what you feel.",
  "messages.lede": "You just don’t know how to say it. We’ll help you find the words — then you make them yours.",
  "messages.cta": "Write My Christmas Message",
  "messages.for": "For",
  "messages.tone": "Tone",
  "messages.heartfelt": "Heartfelt",
  "messages.funny": "Funny",
  "messages.warm": "Warm",
  "finale.kicker": "This Christmas",
  "finale.h2": "Make this Christmas unforgettable.",
  "finale.lede": "The room is fuller now. The lights are on. Start with a portrait, Santa, or the Gift Finder — or keep using the classic generator.",
  "finale.cta": "Start creating",
  "finale.secondary": "Browse Christmas experiences",
  "finale.alt": "The same Christmas living room, warmer and more complete, with lights and gifts",
  "faq.h2": "Christmas questions",
  "faq.1.q": "What can I create for Christmas with The Digital Gifter?",
  "faq.1.a":
    "This Christmas suite includes Gift Finder (gift ideas), portraits for families, couples and pets, a personalized Santa video, a shareable wishlist, a Christmas Tree you decorate, Advent, cards, and a message writer. Send a Gift and Gift Tree are separate products.",
  "faq.2.q": "Can Santa say my child’s name?",
  "faq.2.a":
    "Yes. Enter their first name on this page and continue to the Santa video experience. The name is carried into the next step so you can personalize a message from Santa.",
  "faq.3.q": "Do I need design skills?",
  "faq.3.a":
    "No. Each Christmas experience is guided. Upload a photo, choose who you’re shopping for, or start with a name — then we help you finish something that feels personal.",
  "faq.4.q": "Is this for digital gifts, physical gifts, or both?",
  "faq.4.a":
    "Both. Gift Finder helps you choose an idea from anywhere, the wishlist is a list you share privately, and portraits, cards, and Santa videos are digital Christmas pieces you can give.",
  "faq.5.q": "Will this work on my phone?",
  "faq.5.a":
    "Yes. The Christmas landing and every experience are designed for a phone first, with large tap targets, a jump list at the top of the suite, and a simple vertical story.",
  "faq.6.q": "Is Gift Finder the same as Christmas Tree or Send a Gift?",
  "faq.6.a":
    "No. Gift Finder helps you pick a Christmas gift idea. Christmas Tree is a shareable tree you decorate. Send a Gift is a separate prepaid send — it is not part of this suite, and it is not Gift Tree.",
  "nav.gifts": "Gift Finder",
  "nav.portraits": "Portraits",
  "nav.santa": "Santa",
  "nav.wishlist": "Wishlist",
  "nav.tree": "Christmas Tree",
  "nav.advent": "Advent",
  "nav.cards": "Cards",
  "nav.messages": "Messages",
  "nav.suite": "Christmas experiences",
  "nav.priority": "Start here",
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
