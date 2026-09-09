/**
 * Localization-ready copy for `/christmas/advent`.
 * English ships now; packs can be added without rewriting the experience.
 */

export const ADVENT_LOCALES = ["en"] as const;
export type AdventLocale = (typeof ADVENT_LOCALES)[number];
export const ADVENT_DEFAULT_LOCALE: AdventLocale = "en";

/** Future RTL locales should flip this map — do not hardcode dir in components. */
export const ADVENT_LOCALE_DIR: Record<string, "ltr" | "rtl"> = {
  en: "ltr",
  ar: "rtl",
  he: "rtl",
  fa: "rtl",
  ur: "rtl",
};

type CopyBag = Record<string, string>;

const EN: CopyBag = {
  "seo.title":
    "Online Christmas Advent Calendar | Open a Surprise Every Day | TheDigitalGifter",
  "seo.description":
    "Open a new Christmas surprise every day from December 1 to Christmas Eve with TheDigitalGifter's interactive online Advent Calendar.",
  "seo.h1": "Advent Calendar",
  "seo.ogAlt": "Interactive online Christmas Advent Calendar in a cozy Christmas room",

  "brand.kicker": "The Digital Gifter · Christmas",
  "hero.h1": "Advent Calendar",
  "hero.lede": "A little Christmas magic every day.",
  "hero.secondary": "Open a new surprise each day from December 1 to Christmas Eve.",

  "progress": "You've opened {opened} of 24 surprises.",

  "pre.title": "The first door opens December 1.",
  "pre.countdown": "{days} days · {hours} hours · {minutes} minutes",
  "pre.hint": "The calendar is ready — come back when Advent begins.",

  "after.title": "This season's Advent has ended.",
  "after.lede": "Thank you for opening the doors with us. See you next Christmas.",

  "door.aria": "Door {day}",
  "door.aria.today": "Door {day}, today's surprise",
  "door.aria.openable": "Door {day}, ready to open",
  "door.aria.opened": "Door {day}, already opened",
  "door.aria.locked": "Door {day}, still locked",
  "door.hover.today": "Open today's surprise",
  "door.hover.openable": "Open this surprise",
  "door.locked.title": "Not yet",
  "door.locked.body": "Come back on December {day} to open this surprise.",
  "door.preseason.body": "The first door opens December 1.",
  "door.ended.body": "This Advent season has closed.",

  "reveal.found": "You found today's Christmas gift",
  "reveal.openGift": "Open My Gift",
  "reveal.claim": "Claim My Surprise",
  "reveal.revisit": "Your surprise",
  "reveal.close": "Close",
  "reveal.share": "Share today's surprise",
  "reveal.shareText": "I opened today's Christmas surprise on TheDigitalGifter",
  "reveal.shareCta": "Open yours",
  "reveal.save": "Save your gift",
  "reveal.signIn": "Sign in to keep today's reward",
  "reveal.guestReady": "Your daily Christmas surprise is ready.",
  "reveal.already": "You've already claimed this surprise.",
  "reveal.seasonSoon": "Surprises unlock when Advent goes live.",

  "editorial.h2": "Come back every day for a little Christmas magic.",
  "editorial.lede":
    "Twenty-four doors. A new daily surprise. Open gifts, revisit favorites, and share the Christmas experience.",
  "editorial.tree": "Build Your Christmas Tree",
  "editorial.hub": "Explore Christmas",

  "geo.h2": "What is an online Advent calendar?",
  "geo.lede":
    "An online Advent calendar is a digital version of the traditional Christmas calendar, with a new door or surprise unlocked each day from December 1 through December 24.",

  "faq.1.q": "When does the Advent calendar start?",
  "faq.1.a":
    "Doors unlock daily from December 1 through December 24, using TheDigitalGifter's Advent day in Europe/Bucharest.",
  "faq.2.q": "Can I open previous days?",
  "faq.2.a":
    "Yes. Once a day has passed during Advent, you can still open that door unless a specific reward is marked as time-limited.",
  "faq.3.q": "Is it free?",
  "faq.3.a":
    "Opening the calendar and discovering daily surprises is free. Some rewards may invite you to save an account or continue into a Christmas experience.",
  "faq.4.q": "What can I find behind the doors?",
  "faq.4.a":
    "Each day can reveal a different surprise — seasonal messages, Christmas creative unlocks, templates, gift ideas, and other holiday moments.",
  "faq.5.q": "Can I open it on mobile?",
  "faq.5.a": "Yes. The Advent calendar is designed for phones and desktops, with doors sized for easy tapping.",
  "faq.6.q": "Do I need an account?",
  "faq.6.a":
    "You can enjoy the calendar and some seasonal surprises as a guest. Sign in when you want to save a reward to your account.",
  "faq.7.q": "Can I share it?",
  "faq.7.a":
    "Yes. After opening a surprise, you can share that you opened today's door — without spoiling the gift for someone else.",

  "sound.mute": "Mute sounds",
  "sound.unmute": "Unmute sounds",
  "nav.home": "Christmas",
  "loading": "Warming the Christmas room…",
  "error.generic": "Something went quiet for a moment. Please try again.",
};

const PACKS: Record<AdventLocale, CopyBag> = { en: EN };

export function adventT(
  key: string,
  locale: AdventLocale = ADVENT_DEFAULT_LOCALE,
  vars?: Record<string, string | number>,
): string {
  const pack = PACKS[locale] || EN;
  let text = pack[key] ?? EN[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replaceAll(`{${k}}`, String(v));
    }
  }
  return text;
}

export const ADVENT_FAQS = [
  { qKey: "faq.1.q", aKey: "faq.1.a" },
  { qKey: "faq.2.q", aKey: "faq.2.a" },
  { qKey: "faq.3.q", aKey: "faq.3.a" },
  { qKey: "faq.4.q", aKey: "faq.4.a" },
  { qKey: "faq.5.q", aKey: "faq.5.a" },
  { qKey: "faq.6.q", aKey: "faq.6.a" },
  { qKey: "faq.7.q", aKey: "faq.7.a" },
] as const;
