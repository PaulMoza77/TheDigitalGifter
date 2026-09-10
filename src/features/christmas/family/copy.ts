/**
 * Localization-ready copy for `/christmas/family`.
 * Warm, emotional, Christmas-first — AI is secondary.
 */

export const FAMILY_LOCALES = ["en"] as const;
export type FamilyLocale = (typeof FAMILY_LOCALES)[number];
export const FAMILY_DEFAULT_LOCALE: FamilyLocale = "en";

export const FAMILY_LOCALE_DIR: Record<string, "ltr" | "rtl"> = {
  en: "ltr",
  ar: "rtl",
  he: "rtl",
  fa: "rtl",
  ur: "rtl",
};

type CopyBag = Record<string, string>;

const EN: CopyBag = {
  "seo.title":
    "Family Christmas Photo Generator | Christmas Family Portraits",
  "seo.description":
    "Create a personalized family Christmas portrait from your favorite family photo. Choose a festive Christmas scene and turn your photo into a holiday memory.",
  "seo.h1": "Turn Your Family Photo Into a Magical Christmas Portrait",
  "seo.ogAlt": "Family Christmas portrait transformation in a cozy living room",

  "hero.kicker": "THE DIGITAL GIFTER · CHRISTMAS",
  "hero.h1": "Turn Your Family Photo Into a Magical Christmas Portrait",
  "hero.lede":
    "Upload a family photo, choose a Christmas style, and create a beautiful portrait made for the people you love most.",
  "hero.cta": "Upload your photo",
  "hero.privacy": "Family photos stay private by default.",
  "hero.hint": "JPEG, PNG or WebP · up to 15 MB",
  "hero.beforeLabel": "Before",
  "hero.afterLabel": "After",
  "hero.sliderAria": "Compare the everyday family photo with the Christmas portrait",
  "hero.stylesAria": "Choose a Christmas style example",

  "trust.privateTitle": "Private by default",
  "trust.privateBody": "Your family photo is not displayed publicly.",
  "trust.memoriesTitle": "Made for real memories",
  "trust.memoriesBody": "Create something worth keeping.",
  "trust.stylesTitle": "Beautiful Christmas styles",
  "trust.stylesBody": "Choose the atmosphere that feels like your family.",

  "moment.kicker": "Family Christmas",
  "moment.h2": "Create a Family Christmas Photo in Minutes",
  "moment.title": "Create the family Christmas photo you wish you’d taken.",
  "moment.lede":
    "No studio booking. No matching schedules. No trying to get everyone looking at the camera — just upload a photo and create the moment.",
  "moment.cta": "Create Our Christmas Portrait",

  "examples.h2": "Christmas Family Photo Examples",
  "examples.lede":
    "Warm, realistic Christmas portraits for every kind of family — from three to five-plus, babies, grandparents, and the pets who belong in the picture.",
  "examples.demoNote": "Demo examples for inspiration — not customer photos.",
  "examples.family3": "Family of 3",
  "examples.family4": "Family of 4",
  "examples.family5": "Family of 5+",
  "examples.baby": "Parents + baby",
  "examples.grandparents": "Grandparents + family",
  "examples.dog": "Family + dog",
  "examples.cat": "Family + cat",
  "examples.before": "Everyday photo",
  "examples.after": "Christmas portrait",

  "styles.h2": "Choose Your Christmas Style",
  "styles.lede": "Pick the Christmas world that feels like home.",
  "styles.cozy": "Cozy Fireplace",
  "styles.cozyDesc": "Warm living room, tree, and firelight.",
  "styles.snowy": "Snowy Christmas",
  "styles.snowyDesc": "Soft snow and cool winter light.",
  "styles.classic": "Classic Christmas",
  "styles.classicDesc": "Red, green, and traditional warmth.",
  "styles.elegant": "Elegant Gold",
  "styles.elegantDesc": "Luxury interiors with gold details.",
  "styles.morning": "Christmas Morning",
  "styles.morningDesc": "Pajamas, gifts, soft morning light.",
  "styles.cabin": "Winter Cabin",
  "styles.cabinDesc": "Wood cabin and snowy windows.",
  "styles.wonderland": "Winter Wonderland",
  "styles.wonderlandDesc": "Cinematic snowy landscape.",

  "how.h2": "How It Works",
  "how.1.title": "Upload your family photo",
  "how.1.body": "Choose a clear picture with everyone you want in the portrait.",
  "how.2.title": "Choose your Christmas world",
  "how.2.body": "Pick the scene you love — fireplace, snow, morning, or classic.",
  "how.3.title": "Create your portrait",
  "how.3.body": "Turn your family into a Christmas memory worth keeping.",

  "geo.h2": "What is a Christmas family photo generator?",
  "geo.body":
    "A Christmas family photo generator turns an everyday family picture into a personalized Christmas family portrait — the holiday photo you wish you’d taken together.",
  "geo.best": "What photos work best?",
  "geo.bestBody":
    "Clear group photos where faces are visible work best. Include everyone you want in the finished Christmas family picture.",
  "geo.support": "Who can be in the portrait?",
  "geo.supportBody":
    "Families of any size, parents with a baby, grandparents, and family-plus-pet photos. Keep everyone clearly visible in the original image.",
  "geo.time": "How long does it take?",
  "geo.timeBody":
    "After payment, portraits are usually ready within a few minutes. You can reopen your private order link anytime.",
  "geo.privacy": "What happens to my family photo?",
  "geo.privacyBody":
    "Uploads and results stay private by default and are served through short-lived links — not a public gallery.",

  "faq.h2": "Frequently Asked Questions",
  "faq.1.q": "How does the Christmas family portrait work?",
  "faq.1.a":
    "Upload a family photo, choose a Christmas style, then create your portrait. After checkout, you receive a finished Christmas family picture you can download privately.",
  "faq.2.q": "What kind of photo should I upload?",
  "faq.2.a":
    "A clear JPEG, PNG, or WebP under 15 MB works best. Faces should be visible, and the image shouldn’t be extremely blurry.",
  "faq.3.q": "Can I include the whole family?",
  "faq.3.a":
    "Yes. This experience is built for groups. Keep everyone clearly visible in the original photo for the best result.",
  "faq.4.q": "Can I include grandparents or a baby?",
  "faq.4.a":
    "Yes. Parents with a baby, grandparents with the family, and multi-generation photos are welcome.",
  "faq.5.q": "Can I include our dog or cat?",
  "faq.5.a":
    "Yes when the pet is clearly visible in the family photo. For pet-only portraits, try the Christmas pets experience.",
  "faq.6.q": "Can I try different Christmas styles?",
  "faq.6.a":
    "Yes. Choose from cozy fireplace, snowy scenes, classic Christmas, elegant gold, Christmas morning, and more.",
  "faq.7.q": "How long does it take?",
  "faq.7.a":
    "Finished portraits are usually ready a few minutes after payment. You can leave the page and return with your order link.",
  "faq.8.q": "Is my family photo private?",
  "faq.8.a":
    "Yes. Family photos stay private by default. We do not publish a public gallery of your portrait.",
  "faq.9.q": "Can I turn the portrait into a Christmas card?",
  "faq.9.a":
    "Yes. After you create a portrait, you can continue to the Christmas card experience.",
  "faq.10.q": "Is this an AI Christmas family photo maker?",
  "faq.10.a":
    "We use AI behind the scenes to create your Christmas family portrait — the product is the warm holiday photo, not a technical tool.",

  "upload.kicker": "Start here",
  "upload.h2": "Upload your family photo",
  "upload.lede": "A clear group photo is all you need to begin.",
  "upload.choose": "Upload your photo",
  "upload.drop": "Or drop a photo here",
  "upload.hint": "JPEG, PNG or WebP · up to 15 MB",
  "upload.privacy": "Family photos stay private by default.",

  "style.h2": "Choose your Christmas world",
  "style.lede": "Pick the atmosphere that feels like your family.",
  "style.back": "Back",

  "preview.h2": "Ready to create",
  "preview.lede":
    "This soft preview is your original photo — the finished Christmas portrait unlocks after checkout.",
  "preview.continue": "Continue",

  "offer.h2": "Unlock your Christmas family portrait",
  "offer.ready": "Usually ready a few minutes after payment",
  "offer.private": "Private by default · download via your order link",
  "offer.email": "Email for receipt / recovery (optional)",
  "offer.pay": "Continue to payment",
  "offer.disabled":
    "Checkout is preparing for launch. You can still upload, choose a style, and preview — payment unlocks when pricing goes live.",
  "offer.busy": "Preparing checkout…",

  "checkout.h2": "Secure payment",

  "gen.h2": "Creating your Christmas portrait",
  "gen.step1": "Warming the fireplace…",
  "gen.step2": "Lighting the tree…",
  "gen.step3": "Gathering your family in the scene…",
  "gen.step4": "Your Christmas portrait is almost ready…",
  "gen.note": "You can leave this page — reopen your order link anytime.",

  "result.h2": "Your Christmas family portrait",
  "result.download": "Download",
  "result.share": "Share",
  "result.another": "Create another",
  "result.retryStyle": "Try another style",
  "result.card": "Turn it into a Christmas card",
  "result.tree": "Add it to your Christmas tree",
  "result.toggleOriginal": "Original",
  "result.toggleChristmas": "Christmas",

  "error.unsupported":
    "We couldn’t use this photo. Try a clearer family image with visible faces.",
  "error.generation": "The Christmas magic didn’t work that time. Let’s try again.",
  "error.network": "Connection hiccup. Your selection is saved — please try again.",
  "error.generic": "Something went wrong. Please try again.",
  "error.paidKeepLink":
    "If you already paid, keep your order link — support can retry fulfillment without charging again.",

  "nav.hub": "Christmas hub",
  "nav.photo": "Photo generator",
  "nav.couples": "Couples",
  "nav.pets": "Pets",
  "nav.cards": "Christmas cards",
  "nav.tree": "Christmas tree",

  "busy.uploading": "Uploading your photo…",
  "busy.working": "Working…",

  "cross.couples": "Couples Christmas",
  "cross.classic": "Classic portrait",
  "cross.pets": "Pet Christmas",
};

const PACKS: Record<FamilyLocale, CopyBag> = { en: EN };

export function familyT(
  key: string,
  locale: FamilyLocale = FAMILY_DEFAULT_LOCALE,
): string {
  return PACKS[locale]?.[key] ?? EN[key] ?? key;
}

export function familyDir(locale: string): "ltr" | "rtl" {
  return FAMILY_LOCALE_DIR[locale] ?? "ltr";
}

export const FAMILY_COPY_KEYS = Object.keys(EN);

export const FAMILY_FAQS = [
  { qKey: "faq.1.q", aKey: "faq.1.a" },
  { qKey: "faq.2.q", aKey: "faq.2.a" },
  { qKey: "faq.3.q", aKey: "faq.3.a" },
  { qKey: "faq.4.q", aKey: "faq.4.a" },
  { qKey: "faq.5.q", aKey: "faq.5.a" },
  { qKey: "faq.6.q", aKey: "faq.6.a" },
  { qKey: "faq.7.q", aKey: "faq.7.a" },
  { qKey: "faq.8.q", aKey: "faq.8.a" },
  { qKey: "faq.9.q", aKey: "faq.9.a" },
  { qKey: "faq.10.q", aKey: "faq.10.a" },
] as const;
