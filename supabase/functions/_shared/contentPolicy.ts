/**
 * App Store Guideline 1.1 — intimate physical contact / suggestive catalog.
 * Stable IDs/slugs are the primary blocklist. Text matching is a
 * defensive extra layer and must not treat lighting-only "intimate"
 * mood copy as a hit.
 *
 * Keep this file free of React Native imports so it can be copied into
 * Edge Functions without changes.
 */

export const CONTENT_POLICY_VERSION = "2026-08-15.2";

export const TEMPLATE_UNAVAILABLE_MESSAGE =
  "This template is no longer available.";

export const REQUEST_UNAVAILABLE_MESSAGE =
  "This request isn't available. Please choose another style or rephrase your note.";

/** Catalog rows confirmed to generate hugging, kissing, cuddling, embrace, or suggestive content. */
export const PROHIBITED_TEMPLATE_IDS = [
  "468cce17-ced1-4f71-8383-2a96828323e2", // Mistletoe Kiss image
  "9344cd41-f3bd-451d-8f63-3dddd4478a5c", // mistletoe kiss video prompt
  "3d2c7c77-cbf8-4607-a8a6-b8c3ecfceb14", // duplicate mistletoe kiss
  "7d6e9b94-0996-4853-a08c-0fbe1316aa90", // couple wrapped together / cuddle
  "5ae5d021-7ac4-4e5c-9327-13248283a869", // sleigh, heads together under blanket
  "d8cd5188-a05c-4eb7-856a-692eb2faa6cb", // sledding hug
  "636a6f52-1845-4f94-a690-8d38232e558e", // ski-lift hug
  "521daf56-40b7-4764-b892-edd541e458f2", // ski-lift hug duplicate
  "8ecdeca4-df52-4d72-9331-a9753598717c", // close head-to-head embrace portrait
  "c06186cf-2e6c-496e-bcc5-ee14fa97c2d3", // heads pressed together
  "7c298f43-2843-4ecf-ac63-c78b252c2bc2", // Valentine forehead-to-forehead
  "454b9427-719f-4213-8490-59788c7bc381", // Valentine forehead-to-forehead
  "3fa5b3e9-4022-4821-a439-e8e52ac820f8", // wedding embrace
  "e319aec9-d76e-4386-b3da-577ef8a1c570", // wedding embrace
  "6735f541-1f1c-4443-a365-cd4cf235a64c", // anniversary hug / forehead touch
  "02c71e97-0837-4e67-8418-f430c2d8e775", // anniversary hug / forehead touch
  "96604587-2f74-44ec-b879-b5e4208a2c9e", // card preview shows couple in intimate contact
  "4f5cb1a2-d62b-46f1-ba34-4f7d1361745b", // duplicate card preview with intimate contact
  "d5b6e3a9-a29b-4d7a-90f3-55dc7e04c5d1", // Classic Sexy Christmas Girl (suggestive title)
  "e23be1fa-f846-471c-a9b3-8b5e55581e6d", // Classic (Sexy Christmas Girl) #25
  "a233afb8-fc0d-457d-b568-aca5353db4aa", // cozy couple fireplace, bodies touching
  "68083702-22a6-4e7b-a71b-daa517ea917f", // cozy couple winter, bodies touching
  "d2d23125-d97e-45aa-8aae-4ed8aaeeb8f6", // hot chocolate couple, bodies touching
] as const;

export const PROHIBITED_STYLE_IDS = [
  "romantic-couple-duo-12",
  "romantic-couple-duo-21",
  "romantic-couple-duo",
  "cozy-couple-duo-7",
  "romantic-couple-duo-13",
  "snowy-couple-duo-9",
  "snowy-couple-duo",
  "snowy-couple-duo-33",
  "cozy-couple-duo",
  "classic-couple-duo-1",
  "hearts-evening",
  "romantic-glow",
  "garden-romance",
  "editorial-luxury",
  "romantic-candlelight",
  "timeless-elegant",
  "romantic-card-no-people",
  "romantic-card-no-people-14",
  "classic-sexy-christmas-girl",
  "classic-sexy-christmas-girl-24",
  "cozy-couple-duo-4",
  "cozy-couple-duo-31",
  "cozy-couple-duo-32",
] as const;

export const PROHIBITED_SLUGS = [
  "christmas-romantic-couple-duo-12",
  "christmas-romantic-couple-duo-21",
  "christmas-romantic-couple-duo",
  "christmas-cozy-couple-duo-7",
  "christmas-romantic-couple-duo-13",
  "christmas-snowy-couple-duo-9",
  "christmas-snowy-couple-duo",
  "christmas-snowy-couple-duo-33",
  "christmas-cozy-couple-duo",
  "christmas-classic-couple-duo-1",
  "valentines-day-hearts-evening",
  "valentines-day-romantic-glow",
  "wedding-garden-romance",
  "wedding-editorial-luxury",
  "anniversary-romantic-candlelight",
  "anniversary-timeless-elegant",
  "christmas-romantic-card-no-people",
  "christmas-romantic-card-no-people-14",
  "christmas-classic-sexy-christmas-girl",
  "christmas-classic-sexy-christmas-girl-24",
  "christmas-cozy-couple-duo-4",
  "christmas-cozy-couple-duo-31",
  "christmas-cozy-couple-duo-32",
] as const;

const ID_SET = new Set(PROHIBITED_TEMPLATE_IDS.map((x) => x.toLowerCase()));
const STYLE_SET = new Set(PROHIBITED_STYLE_IDS.map((x) => x.toLowerCase()));
const SLUG_SET = new Set(PROHIBITED_SLUGS.map((x) => x.toLowerCase()));

const CONTACT_RE =
  /\b(kiss(es|ing|ed)?|hug(s|ging|ged)?|embrac(e|es|ing|ed)|cuddle(s|d|ing)?|smooch(es|ing|ed)?|make[\s-]?out|lip[\s-]?lock|nuzzle|snuggl(?:e|ing)|mistletoe kiss|wrapped together|in each other'?s arms|arms around (?:each other|her|him|one another)|foreheads? touching|lean(?:ing)? in (?:for|to) (?:a |the )?kiss)\b/i;

const RO_CONTACT_RE =
  /(?:^|[^\p{L}])(s[aă]rut(?:uri|a[tț]|ând)?|pup(?:at|ici)?|îmbr[aă][tț]i[sș](?:are|a)?|imbratis(?:are|a)?)(?:$|[^\p{L}])/iu;

const EXPLICIT_RE =
  /\b(nsfw|nude|naked|porn|sexual|sexually|intercourse|genitals?|lingerie strip|undress|explicit (?:content|material|images?|photos?|nudes?))\b/i;

/** Suggestive catalog labels (title/style/slug), not lighting adjectives alone. */
const SUGGESTIVE_LABEL_RE =
  /\b(sexy|sensual|seductive|erotic|boudoir|pin[- ]?up|lingerie|cleavage|suggestive)\b/i;

function norm(value: string | null | undefined): string {
  return String(value || "").trim().toLowerCase();
}

export type TemplateIdentity = {
  id?: string | null;
  style_id?: string | null;
  slug?: string | null;
  title?: string | null;
  occasion?: string | null;
  category?: string | null;
  sub_category?: string | null;
  prompt?: string | null;
};

export function isProhibitedIdentity(template: TemplateIdentity): boolean {
  const id = norm(template.id);
  const styleId = norm(template.style_id);
  const slug = norm(template.slug);
  if (id && ID_SET.has(id)) return true;
  if (styleId && STYLE_SET.has(styleId)) return true;
  if (slug && SLUG_SET.has(slug)) return true;
  const labelHay = [template.title, template.style_id, template.slug, template.sub_category]
    .map((x) => String(x || ""))
    .join("\n");
  if (SUGGESTIVE_LABEL_RE.test(labelHay)) return true;
  return false;
}

export function describesIntimateContact(text: string | null | undefined): boolean {
  const value = String(text || "");
  if (!value.trim()) return false;
  if (CONTACT_RE.test(value) || RO_CONTACT_RE.test(value)) {
    // Ignore lip-sync / lipstick false positives from a bare "lip" search.
    return true;
  }
  return false;
}

export function describesExplicitContent(text: string | null | undefined): boolean {
  return EXPLICIT_RE.test(String(text || ""));
}

export function isTemplateAllowed(template: TemplateIdentity): boolean {
  if (isProhibitedIdentity(template)) return false;
  const haystack = [
    template.title,
    template.slug,
    template.style_id,
    template.sub_category,
    template.prompt,
  ].join("\n");
  return !describesIntimateContact(haystack) && !describesExplicitContent(haystack);
}

export function isUserTextAllowed(text: string | null | undefined): boolean {
  const value = String(text || "").trim();
  if (!value) return true;
  return !describesIntimateContact(value) && !describesExplicitContent(value);
}

export function assertTemplateAllowed(template: TemplateIdentity): void {
  if (!isTemplateAllowed(template)) {
    throw new Error(TEMPLATE_UNAVAILABLE_MESSAGE);
  }
}

export function assertUserTextAllowed(text: string | null | undefined): void {
  if (!isUserTextAllowed(text)) {
    throw new Error(REQUEST_UNAVAILABLE_MESSAGE);
  }
}
