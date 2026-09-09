/**
 * Localization-ready copy for `/christmas/photo-generator`.
 * English ships now; packs can be added without rewriting scenes.
 * Longer translations should wrap via CSS — never fragile English concatenation.
 */

export const PHOTO_GEN_LOCALES = ["en"] as const;
export type PhotoGenLocale = (typeof PHOTO_GEN_LOCALES)[number];
export const PHOTO_GEN_DEFAULT_LOCALE: PhotoGenLocale = "en";

/** Future RTL locales should flip this map — do not hardcode dir in components. */
export const PHOTO_GEN_LOCALE_DIR: Record<string, "ltr" | "rtl"> = {
  en: "ltr",
  ar: "rtl",
  he: "rtl",
  fa: "rtl",
  ur: "rtl",
};

type CopyBag = Record<string, string>;

const EN: CopyBag = {
  "seo.title":
    "AI Christmas Photo Generator | Create Christmas Portraits | TheDigitalGifter",
  "seo.description":
    "Turn your favorite photo into a magical Christmas portrait. Create realistic Christmas photos for families, couples and pets in minutes.",
  "seo.h1": "AI Christmas Photo Generator",
  "seo.ogAlt": "Before and after Christmas portrait transformation",

  "hero.kicker": "Christmas portraits",
  "hero.h1": "Turn Your Photo Into Christmas Magic",
  "hero.lede":
    "Upload a favorite photo and create a magical Christmas portrait for your family, partner or pet.",
  "hero.cta": "Create My Christmas Photo",
  "hero.secondary": "See Examples",
  "hero.beforeLabel": "Original",
  "hero.afterLabel": "Christmas",
  "hero.sliderAria": "Drag to compare original and Christmas portrait",

  "category.family": "Family",
  "category.couples": "Couples",
  "category.pets": "Pets",
  "category.aria": "Choose an example category",

  "upload.kicker": "Start here",
  "upload.h2": "Upload your photo",
  "upload.lede":
    "Choose a clear photo and we’ll turn it into a magical Christmas portrait.",
  "upload.choose": "Choose Photo",
  "upload.drop": "Or drop a photo here",
  "upload.hint": "JPEG, PNG, or WebP · under 15 MB",
  "upload.guidanceTitle": "For the best result:",
  "upload.g1": "use a clear photo",
  "upload.g2": "faces should be visible",
  "upload.g3": "avoid extremely blurry images",
  "upload.g4": "include everyone you want in the final portrait",
  "upload.privacy":
    "Your upload stays private by default. Finished portraits are available through your order link.",

  "subject.h2": "Who’s in the photo?",
  "subject.lede": "We’ll guide the Christmas look for your subjects.",
  "subject.family": "Family",
  "subject.couple": "Couple",
  "subject.person": "One person",
  "subject.pet": "Pet",
  "subject.person_pet": "Person + pet",
  "subject.continue": "Continue",

  "style.h2": "Christmas Photo Styles",
  "style.lede": "Pick the Christmas look you want.",
  "style.back": "Back",

  "preview.h2": "Ready to create",
  "preview.lede":
    "This preview is your original photo, softly veiled — the finished Christmas portrait unlocks after checkout.",
  "preview.continue": "Continue",

  "offer.h2": "Unlock your Christmas portrait",
  "offer.ready": "Usually ready a few minutes after payment",
  "offer.private": "Private by default · download via your order link",
  "offer.email": "Email for receipt / recovery (optional)",
  "offer.pay": "Continue to payment",
  "offer.disabled":
    "Checkout is preparing for launch. You can still upload, choose a style, and preview — payment unlocks when pricing goes live.",
  "offer.busy": "Preparing checkout…",

  "checkout.h2": "Secure payment",

  "gen.h2": "Creating your Christmas portrait",
  "gen.step1": "Preparing your Christmas scene…",
  "gen.step2": "Adding the lights…",
  "gen.step3": "Creating a little Christmas magic…",
  "gen.step4": "Your portrait is almost ready…",
  "gen.note": "You can leave this page — reopen your order link anytime.",

  "result.h2": "Your Christmas portrait",
  "result.download": "Download",
  "result.share": "Share",
  "result.another": "Create Another",
  "result.retryStyle": "Try Another Style",
  "result.card": "Turn It Into a Christmas Card",
  "result.tree": "Add It to Your Christmas Tree",
  "result.toggleOriginal": "Original",
  "result.toggleChristmas": "Christmas",

  "examples.h2": "Christmas Photo Examples",
  "examples.lede":
    "Realistic Christmas portraits for families, couples, dogs, cats — and the ones you love most.",
  "examples.demoNote": "Demo examples for inspiration — not customer photos.",
  "examples.family": "Family",
  "examples.couple": "Couple",
  "examples.dog": "Dog",
  "examples.cat": "Cat",
  "examples.familyPet": "Family + pet",
  "examples.before": "Original",
  "examples.after": "Christmas result",

  "ecosystem.h2": "Create Christmas Photos for Family, Couples and Pets",
  "ecosystem.lede":
    "Start here for any Christmas portrait — or go straight to a specialized experience.",

  "family.kicker": "Christmas family photos",
  "family.h2": "Create the Christmas Family Photo You Wish You’d Taken",
  "family.lede":
    "No studio. No matching schedules. No trying to get everyone looking at the camera.",
  "family.cta": "Create a Family Portrait",

  "couples.kicker": "Christmas couple photos",
  "couples.h2": "Your Christmas Story, in One Magical Photo",
  "couples.lede":
    "First Christmas together, engaged, married, long-distance, or the card you’ll send this year.",
  "couples.cta": "Create a Couple Portrait",

  "pets.kicker": "Christmas pet photos",
  "pets.h2": "Make Your Pet the Star of Christmas",
  "pets.lede":
    "Turn a favorite dog or cat photo into a warm, realistic Christmas portrait.",
  "pets.cta": "Create a Pet Christmas Portrait",

  "how.h2": "How the Christmas Photo Generator Works",
  "how.1.title": "Upload a photo",
  "how.1.body": "Choose a favorite photo of the people or pets you love.",
  "how.2.title": "Pick your Christmas style",
  "how.2.body": "Choose the Christmas look you want.",
  "how.3.title": "Create your portrait",
  "how.3.body": "We transform the photo into your Christmas image.",

  "geo.h2": "What is an AI Christmas photo generator?",
  "geo.body":
    "An AI Christmas photo generator transforms an uploaded photo into a Christmas-themed portrait while keeping the people or pets from the original image recognizable.",
  "geo.best": "What photos work best?",
  "geo.bestBody":
    "Clear photos where faces (or pet faces) are visible work best. Include everyone you want in the final portrait.",
  "geo.support": "Who can be in the photo?",
  "geo.supportBody":
    "Families, couples, one person, pets, and person-plus-pet photos are supported. Multi-person results depend on how clearly each person appears in the upload.",
  "geo.time": "How long does it take?",
  "geo.timeBody":
    "After payment, portraits are usually ready within a few minutes. You can reopen your private order link anytime.",
  "geo.privacy": "What happens to my photo?",
  "geo.privacyBody":
    "Uploads and results are stored privately and served through short-lived links. We do not publish a public gallery of your portrait.",

  "faq.h2": "Frequently Asked Questions",
  "faq.1.q": "How does the Christmas photo generator work?",
  "faq.1.a":
    "Upload a photo, tell us who’s in it, choose a Christmas style, then create your portrait. After checkout, we generate a finished Christmas image you can download.",
  "faq.2.q": "What kind of photo should I upload?",
  "faq.2.a":
    "A clear JPEG, PNG, or WebP under 15 MB works best. Faces should be visible, and the image shouldn’t be extremely blurry.",
  "faq.3.q": "Can I create a Christmas family photo?",
  "faq.3.a":
    "Yes. Choose Family after upload, or visit the dedicated Christmas family photo experience.",
  "faq.4.q": "Can I create Christmas photos of my dog or cat?",
  "faq.4.a":
    "Yes. Choose Pet after upload, or use the Christmas pets, dogs, or cats experiences.",
  "faq.5.q": "Can I include multiple people?",
  "faq.5.a":
    "Yes for family and group photos. Keep everyone clearly visible in the original image for the best result.",
  "faq.6.q": "Can I try different Christmas styles?",
  "faq.6.a":
    "Yes. You can choose from a curated set of Christmas styles, and try another style after you create a portrait.",
  "faq.7.q": "How long does generation take?",
  "faq.7.a":
    "Finished portraits are usually ready a few minutes after payment. You can leave the page and return with your order link.",
  "faq.8.q": "Can I download the finished image?",
  "faq.8.a": "Yes. When your portrait is ready, download it privately from the result screen.",
  "faq.9.q": "Can I turn my portrait into a Christmas card?",
  "faq.9.a":
    "Yes. After you create a portrait, you can continue to the Christmas card experience.",
  "faq.10.q": "What happens to my uploaded photo?",
  "faq.10.a":
    "Your upload and result stay private by default. They are stored for order recovery and served through private links — not a public gallery.",

  "error.unsupported":
    "We couldn’t use this photo. Try a clearer image with visible faces.",
  "error.generation":
    "The Christmas magic didn’t work that time. Let’s try again.",
  "error.network": "Connection hiccup. Your selection is saved — please try again.",
  "error.generic": "Something went wrong. Please try again.",
  "error.paidKeepLink":
    "If you already paid, keep your order link — support can retry fulfillment without charging again.",

  "nav.hub": "Christmas hub",
  "nav.family": "Family",
  "nav.couples": "Couples",
  "nav.pets": "Pets",
  "nav.dogs": "Dogs",
  "nav.cats": "Cats",
  "nav.cards": "Christmas cards",
  "nav.tree": "Christmas tree",

  "trust.fact1": "Realistic Christmas portraits from your own photo",
  "trust.fact2": "Built for families, couples, and pets",
  "trust.fact3": "Private by default — no public gallery",

  "busy.working": "Working…",
  "busy.uploading": "Uploading your photo…",
};

const PACKS: Record<PhotoGenLocale, CopyBag> = { en: EN };

export function photoGenT(
  key: string,
  locale: PhotoGenLocale = PHOTO_GEN_DEFAULT_LOCALE,
): string {
  return PACKS[locale]?.[key] ?? EN[key] ?? key;
}

export function photoGenDir(locale: string): "ltr" | "rtl" {
  return PHOTO_GEN_LOCALE_DIR[locale] ?? "ltr";
}

export const PHOTO_GEN_COPY_KEYS = Object.keys(EN);

export const PHOTO_GEN_FAQS = [
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
