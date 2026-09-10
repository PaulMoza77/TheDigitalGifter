/** Gift Finder copy keys — EN now; RO labels live in taxonomy for chips. */

export type GiftFinderLocale = "en" | "ro";

const EN: Record<string, string> = {
  "seo.title": "Christmas Gift Finder | Find the Perfect Gift | TheDigitalGifter",
  "seo.description":
    "Find thoughtful Christmas gift ideas based on who you’re shopping for, their interests, personality, and your budget.",

  "brand.name": "The Digital Gifter",
  "hero.kicker": "Christmas Gift Finder",
  "hero.h1": "Find a Christmas Gift They’ll Actually Love",
  "hero.sub":
    "Tell us who you’re shopping for, what they’re into and your budget. We’ll help you find thoughtful gift ideas in moments.",
  "hero.cta": "Find Their Gift",
  "hero.demo.for": "For: Mom, 58",
  "hero.demo.loves": "Loves: cooking, travel, home",
  "hero.demo.budget": "Budget: $50–$100",
  "hero.demo.match": "Top Match: Personalized Recipe Book",
  "hero.demo.why":
    "Why she may love it: It combines her love of cooking with something personal and meaningful.",
  "hero.demo.note": "Demo preview — not a live result",

  "progress.of": "{current} of {total}",
  "nav.back": "Back",
  "nav.continue": "Continue",
  "nav.skip": "Skip",
  "nav.find": "Find Their Gift",
  "nav.openWishlist": "Open Wishlist",
  "nav.refine": "Refine My Answers",
  "nav.restart": "Start over",

  "step.recipient.title": "Who are you shopping for?",
  "step.age.title": "How old are they?",
  "step.interests.title": "What are they into?",
  "step.interests.hint": "Pick a few — up to 6",
  "step.interests.other": "Something else",
  "step.interests.otherPlaceholder": "Add a custom interest (optional)",
  "step.personality.title": "What are they like?",
  "step.personality.hint": "Select all that fit",
  "step.budget.title": "What’s your budget?",
  "step.detail.title": "Tell us one thing about them",
  "step.detail.optional": "Optional — but it can make recommendations much better",
  "step.detail.placeholder": "e.g. She just moved into a new home.",
  "step.detail.examples":
    "Examples: “He loves Formula 1 and coffee.” · “She says she doesn’t want anything.”",

  "loading.1": "Finding gifts that fit them…",
  "loading.2": "Matching their interests…",
  "loading.3": "Looking for something they’ll actually love…",

  "results.title": "Best Matches for {recipient}",
  "results.why": "Why it fits",
  "results.price": "Typical price: {range}",
  "results.priceFlexible": "Budget flexible",
  "results.seeGift": "See Gift",
  "results.save": "Save to Wishlist",
  "results.moreLike": "More Like This",
  "results.notForThem": "Not for Them",
  "results.saved": "Saved to your wishlist",
  "results.ideaOnly": "Gift idea",
  "results.shopLater": "Shop links coming soon",

  "feedback.title": "Want better matches?",
  "feedback.none": "None of these feel right",
  "feedback.missing": "What’s missing?",
  "feedback.missingPlaceholder": "Tell us what would feel more right…",
  "feedback.apply": "Update results",

  "crossSell.title": "Want something more personal?",
  "crossSell.portrait": "Create a Christmas Portrait",
  "crossSell.santa": "Make a Santa Video",
  "crossSell.card": "Send a Personalized Christmas Card",

  "error.generic": "We couldn’t find the right match yet. Let’s adjust one detail.",
  "error.rate": "Please wait a bit before searching again.",
  "error.retry": "Try again",

  "seo.section.recipient": "Find Gifts by Recipient",
  "seo.section.budget": "Find Christmas Gifts by Budget",
  "seo.section.personality": "Christmas Gifts by Personality",
  "seo.section.how": "How the Christmas Gift Finder Works",
  "seo.section.howBody":
    "Choose the recipient, share their interests and personality, set a budget, and optionally add one personal detail. You’ll get ranked gift ideas with short explanations — then refine, restart, or save ideas to your Christmas Wishlist.",
  "seo.section.hasEverything": "Gifts for Someone Who Has Everything",
  "seo.section.hasEverythingBody":
    "When someone already owns “all the things,” useful Christmas gifts usually lean toward experiences, personalized keepsakes, hobby upgrades, sentimental moments, or practical premium items. Choosing a “has everything” personality steers the finder that way instead of generic clutter.",
  "seo.geo.title": "What is a Christmas Gift Finder?",
  "seo.geo.body":
    "A Christmas Gift Finder is a guided tool that recommends Christmas gift ideas based on who you’re shopping for, their interests and personality, and your budget. On TheDigitalGifter, you answer a short set of questions and receive curated ideas with clear reasons they may fit — then you can refine or save ideas to a wishlist.",
  "seo.faq.title": "Frequently Asked Questions",
  "seo.section.wishlist": "Save ideas to your wishlist",
  "seo.section.wishlistBody":
    "Like an idea? Save it to your Christmas Wishlist and share one list with family so shopping stays coordinated.",

  "breadcrumb.christmas": "Christmas",
  "breadcrumb.finder": "Gift Finder",
};

export function gfT(key: string, locale: GiftFinderLocale = "en", vars?: Record<string, string>): string {
  const pack = locale === "ro" ? EN : EN;
  let text = pack[key] || EN[key] || key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replaceAll(`{${k}}`, v);
    }
  }
  return text;
}
