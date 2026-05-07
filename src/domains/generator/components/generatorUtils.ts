import { occasions } from "@/constants/occasions";
import type { AnyTemplate, CategoryKey, EdgeResponse } from "./generatorTypes";
import { ALL_CATEGORIES } from "./generatorTypes";

export function normalizeKey(value: unknown) {
  const raw = String(value ?? "").trim().toLowerCase();

  if (!raw || raw === "all") return raw;

  if (raw === "new-born" || raw === "new_born" || raw === "newborn") return "new_born";
  if (raw === "valentines" || raw === "valentines-day") return "valentines_day";
  if (raw === "mothers-day") return "mothers_day";
  if (raw === "fathers-day") return "fathers_day";
  if (raw === "new-years-eve") return "new_years_eve";
  if (raw === "baby-reveal") return "baby_reveal";
  if (raw === "thank-you") return "thank_you";
  if (raw === "name-cards") return "name_cards";
  if (raw === "bible-verses") return "bible_verses";
  if (raw === "pet-loss") return "pet_loss";

  return raw.replace(/-/g, "_");
}

export function normalizeCategory(value: unknown): CategoryKey {
  const key = normalizeKey(value);

  if (key === "occasions" || key === "personal" || key === "spiritual" || key === "pets") {
    return key;
  }

  return ALL_CATEGORIES;
}

export function safeString(value: unknown) {
  return String(value ?? "").trim();
}

export function isHttpUrl(value: unknown) {
  return /^https?:\/\//i.test(safeString(value));
}

export function formatLabel(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return "Other";

  return raw
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace(/\bNew Born\b/g, "Newborn")
    .replace(/\bNew Years Eve\b/g, "New Year's Eve")
    .replace(/\bValentines Day\b/g, "Valentine's Day")
    .replace(/\bMothers Day\b/g, "Mother's Day")
    .replace(/\bFathers Day\b/g, "Father's Day")
    .replace(/\bBible Verses\b/g, "Bible Verses")
    .replace(/\bPet Loss\b/g, "Pet Loss");
}

export function getPublicSupabaseConfig(): { url: string; anon: string } {
  const env = import.meta.env as {
    VITE_SUPABASE_URL?: string;
    VITE_SUPABASE_ANON_KEY?: string;
  };

  const url = (env.VITE_SUPABASE_URL || "").trim();
  const anon = (env.VITE_SUPABASE_ANON_KEY || "").trim();

  if (!url || !anon) {
    throw new Error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.");
  }

  return { url, anon };
}

export async function safeReadJson(res: Response): Promise<EdgeResponse> {
  try {
    return (await res.json()) as EdgeResponse;
  } catch {
    return {};
  }
}

export function getTemplateId(template: AnyTemplate) {
  return safeString(template.id || template._id);
}

export function getTemplateMainCategory(template: AnyTemplate): CategoryKey {
  const direct = normalizeCategory(template.main_category || template.mainCategory);
  if (direct !== "all") return direct;

  const occasionKey = normalizeKey(template.occasion);
  const found = occasions.find((item) => normalizeKey(item.id) === occasionKey);

  return normalizeCategory(found?.category || "occasions");
}

export function getTemplateStyleId(template: AnyTemplate) {
  return (
    safeString(template.style_id) ||
    safeString(template.styleId) ||
    normalizeKey(template.category || "general")
  );
}

export function getTemplateImageUrl(template: AnyTemplate) {
  const candidates = [
    template.previewUrl,
    template.thumbnailUrl,
    template.preview_image_url,
    template.preview_url,
    template.previewurl,
    template.thumbnail_url,
    template.thumbnailurl,
    template.imageUrl,
    template.image,
    template.mediaUrl,
  ];

  for (const candidate of candidates) {
    const url = safeString(candidate);
    if (url) return url;
  }

  return "";
}

export function normalizeTemplate(t: AnyTemplate): AnyTemplate {
  const id = getTemplateId(t);
  const previewUrl = getTemplateImageUrl(t);

  const thumbnailUrl =
    safeString(t.thumbnailUrl) ||
    safeString(t.thumbnail_url) ||
    safeString(t.thumbnailurl) ||
    previewUrl;

  const creditCost =
    typeof t.creditCost === "number"
      ? t.creditCost
      : typeof t.credit_cost === "number"
        ? t.credit_cost
        : typeof t.creditcost === "number"
          ? t.creditcost
          : 1;

  const normalizedOccasion = normalizeKey(t.occasion || "");
  const mainCategory = getTemplateMainCategory(t);
  const style = safeString(t.category || "general");

  return {
    ...(t as any),
    id,
    _id: id,
    main_category: mainCategory,
    mainCategory,
    occasion: normalizedOccasion || t.occasion,
    category: style,
    previewUrl,
    thumbnailUrl,
    creditCost,
    type: String(t.type ?? "image").toLowerCase(),
  };
}

export function dispatchCreditsRefresh() {
  window.dispatchEvent(new Event("credits:refresh"));
}

export function buildPrompt(input: {
  template: AnyTemplate;
  customInstructions: string;
  personalizedName: string;
}) {
  const templatePrompt = safeString((input.template as any).prompt);
  const title = safeString(input.template.title);
  const occasion = safeString(input.template.occasion);
  const custom = safeString(input.customInstructions);
  const name = safeString(input.personalizedName);
  const isNameCard = normalizeKey(occasion) === "name_cards";

  return [
    "Create one premium realistic personalized gift image using the two provided input images.",
    "Input image 1 is the customer's uploaded photo. Preserve the real people from image 1: face identity, age, skin tone, hair color, hairstyle, body shape, expression, and number of people.",
    "Input image 2 is the selected template/reference image. Use image 2 for scene, composition, pose direction, camera angle, background, props, lighting, mood, colors, and premium style.",
    "Final task: create a new image that looks like the template/reference image but personalized with the people from the customer's photo.",
    "Do not copy the customer's original background unless it naturally fits the template.",
    "Do not create extra people. Do not duplicate faces. Do not distort hands, eyes, mouths, or limbs.",
    "Avoid random text, logos, watermarks, captions, signatures, or unreadable typography.",
    isNameCard && name
      ? `Important: include the name "${name}" as the main readable name text in the design. The name must be spelled exactly: ${name}.`
      : "",
    "Make the result clean, beautiful, realistic, emotional, and gift-ready.",
    title ? `Template title: ${title}.` : "",
    occasion ? `Occasion: ${occasion}.` : "",
    templatePrompt ? `Template-specific instruction: ${templatePrompt}` : "",
    custom ? `User extra instruction: ${custom}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}