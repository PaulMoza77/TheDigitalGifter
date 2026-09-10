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
  "finder.kicker": "Christmas Gift Finder",
  "finder.h2": "Find the Perfect Christmas Gift",
  "finder.lede":
    "Not sure what to buy? Use the Christmas Gift Finder to match ideas to the person, their interests, and your budget — including thoughtful options for someone who already seems to have everything. Save favorites to a wishlist when you’re ready.",
  "finder.cta": "Find a Christmas gift they’ll actually love",
  "finder.hint": "Choose who you’re shopping for, then continue into the finder.",
  "portraits.kicker": "Christmas portraits",
  "portraits.h2": "Create Magical Christmas Photos",
  "portraits.lede":
    "Upload a clear photo and turn it into a festive Christmas portrait for family, couples, or pets — including dog and cat paths. Download privately, or carry a portrait into a Christmas card.",
  "portraits.cta": "Turn your photo into Christmas magic",
  "portraits.family": "Family",
  "portraits.couples": "Couples",
  "portraits.pets": "Pets",
  "portraits.alt.family": "Family transformed into a cozy fireplace Christmas portrait",
  "portraits.alt.couples": "Couple transformed into a romantic Christmas portrait",
  "portraits.alt.pets": "Pet transformed into a festive Christmas portrait",
  "portraits.alt.before": "An everyday family photo before it becomes a Christmas portrait",
  "santa.kicker": "Santa video",
  "santa.h2": "Get a Personalized Message From Santa",
  "santa.h2Personalized": "Santa has a message for {name}...",
  "santa.lede":
    "Create a personalized Christmas video from Santa. Include their name and optional details like age, something they did well, a hobby, or a Christmas wish — then download and share the video.",
  "santa.bubble": "Ho ho ho, I’m Santa!",
  "santa.bubblePersonalized": "{name}? I know that name...",
  "santa.label": "Your kid’s name",
  "santa.placeholder": "Emma",
  "santa.placeholders": "Emma|Noah|Sofia|Oliver",
  "santa.cta": "Create a personalized Santa video",
  "santa.ctaPersonalized": "Create {name}'s Santa Message",
  "santa.reassurance": "It only takes a moment to create the magic.",
  "santa.alt": "Santa standing in the Christmas room, speaking a personal greeting",
  "santa.error": "Please enter a first name using letters, spaces, hyphens, or apostrophes.",
  "wishlist.kicker": "Wishlist",
  "wishlist.h2": "Create & Share a Christmas Wishlist",
  "wishlist.lede":
    "Add wishes from product links or free text, share one simple link with family, and let people reserve gifts so Christmas shopping stays coordinated without spoiling the surprise.",
  "wishlist.cta": "Create a Christmas wishlist",
  "wishlist.alt": "A handwritten letter to Santa slipping from a cream envelope",
  "tree.kicker": "Christmas tree",
  "tree.h2": "Build a Christmas tree filled with gifts, memories and surprises.",
  "tree.lede": "Share it with someone you love. Lights, ornaments, and little messages that appear as they open it.",
  "tree.cta": "Create Your Christmas Tree",
  "advent.kicker": "Advent",
  "advent.h2": "A little Christmas magic every day.",
  "advent.lede": "Open today’s surprise. Come back tomorrow. The season becomes a ritual, not a rush.",
  "advent.cta": "Open Today’s Door",
  "advent.alt": "An elegant wooden Advent calendar with one glowing door for today",
  "advent.today": "Today’s door",
  "cards.kicker": "Christmas cards",
  "cards.h2": "Create a Personalized Christmas Card",
  "cards.lede":
    "Combine a photo, a festive design, and a personal message into a Christmas card you can download or share digitally. Some messages deserve more than a text.",
  "cards.cta": "Create a Christmas card they’ll want to keep",
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
  "finale.lede": "The room is fuller now. The lights are on. Start creating — a gift, a portrait, a message, a moment.",
  "finale.cta": "Start creating",
  "finale.alt": "The same Christmas living room, warmer and more complete, with lights and gifts",
  "geo.h2": "What can you create with TheDigitalGifter for Christmas?",
  "geo.body":
    "TheDigitalGifter is a Christmas creation hub. You can find gift ideas with the Gift Finder, turn a photo into a Christmas portrait for family, couples, or pets, create a personalized Santa video that can include a recipient’s name, build a shareable Christmas wishlist, design a Christmas card with your photo and message, write Christmas wishes, decorate a digital Christmas tree, and open daily Advent surprises.",
  "faq.h2": "Frequently Asked Questions",
  "faq.1.q": "What can I create for Christmas with TheDigitalGifter?",
  "faq.1.a":
    "Gift ideas, Christmas portraits for families, couples and pets, a personalized Santa video, a shareable wishlist, Christmas cards, Christmas messages, a digital tree, and an Advent calendar.",
  "faq.2.q": "Can Santa say my child’s name?",
  "faq.2.a":
    "Yes. Start with their first name on the Christmas page or Santa Video experience, then add optional details before creating the video.",
  "faq.3.q": "Do I need design skills?",
  "faq.3.a":
    "No. Each Christmas experience is guided — upload a photo, answer a few questions, or start with a name.",
  "faq.4.q": "Is this for digital gifts, physical gifts, or both?",
  "faq.4.a":
    "Both. Use the Gift Finder and wishlist for shopping anywhere, and create digital portraits, cards, and Santa videos to send.",
  "faq.5.q": "Will this work on my phone?",
  "faq.5.a":
    "Yes. The Christmas hub and product experiences are designed to work on phones as well as desktops.",
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
