export type TemplateType = "image" | "video";
export type TemplateOrientation = "portrait" | "landscape";
export type TemplateMainCategory = "occasions" | "personal" | "spiritual" | "pets";

export type DbTemplateRow = {
  id: string;
  created_at: string;
  updated_at: string | null;

  slug: string | null;
  title: string | null;
  prompt: string | null;

  main_category: TemplateMainCategory | null;
  occasion: string | null;
  category: string | null;
  sub_category: string | null;

  type: TemplateType | null;
  scene: string | null;
  orientation: TemplateOrientation | null;
  aspect_ratio: string | null;

  preview_url: string | null;
  thumbnail_url: string | null;
  video_url?: string | null;

  text_default: string | null;
  credit_cost: number | null;
  tags: string[] | null;

  style_id: string | null;

  default_duration?: number | null;
  default_aspect_ratio?: string | null;
  default_resolution?: string | null;
  generate_audio_default?: boolean | null;
  negative_prompt_default?: string | null;

  is_active: boolean | null;
};

export type TemplateSummary = {
  id: string;
  _id: string;
  createdAt: string;
  updatedAt?: string | null;
  _creationTime: number;

  slug: string;
  title: string;
  prompt?: string | null;

  mainCategory?: TemplateMainCategory | null;
  main_category?: TemplateMainCategory | null;

  occasion: string;
  category: string;

  subCategory: string;
  sub_category?: string;

  type: TemplateType;

  scene: string;
  orientation: TemplateOrientation;
  aspectRatio: string;
  aspect_ratio?: string;

  previewUrl: string;
  preview_url?: string;

  thumbnailUrl?: string | null;
  thumbnail_url?: string | null;

  videoUrl?: string | null;
  video_url?: string | null;

  textDefault: string;
  text_default?: string;

  creditCost: number;
  credit_cost?: number;

  tags: string[];

  styleId?: string | null;
  style_id?: string | null;

  defaultDuration?: number | null;
  defaultAspectRatio?: string | null;
  defaultResolution?: string | null;
  generateAudioDefault?: boolean | null;
  negativePromptDefault?: string | null;

  isActive?: boolean;
  is_active?: boolean;
};

function safeString(value: unknown, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function normalizeSlug(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function dbTemplateToSummary(row: DbTemplateRow): TemplateSummary {
  const createdAt = row.created_at || new Date().toISOString();
  const creationMs = Number.isFinite(Date.parse(createdAt))
    ? Date.parse(createdAt)
    : Date.now();

  const id = safeString(row.id);
  const title = safeString(row.title, "Untitled Template");
  const occasion = safeString(row.occasion, "general");
  const category = safeString(row.category, "general");
  const subCategory = safeString(row.sub_category);

  const slug =
    safeString(row.slug) ||
    normalizeSlug(`${occasion}-${category}-${title}-${id.slice(0, 6)}`);

  const type: TemplateType = row.type === "video" ? "video" : "image";
  const orientation: TemplateOrientation =
    row.orientation === "landscape" ? "landscape" : "portrait";

  return {
    id,
    _id: id,
    createdAt,
    updatedAt: row.updated_at ?? null,
    _creationTime: creationMs,

    slug,
    title,
    prompt: row.prompt ?? null,

    mainCategory: row.main_category ?? null,
    main_category: row.main_category ?? null,

    occasion,
    category,

    subCategory,
    sub_category: subCategory,

    type,
    scene: safeString(row.scene),
    orientation,
    aspectRatio: safeString(row.aspect_ratio, "match_input_image"),
    aspect_ratio: safeString(row.aspect_ratio, "match_input_image"),

    previewUrl: safeString(row.preview_url),
    preview_url: safeString(row.preview_url),

    thumbnailUrl: row.thumbnail_url ?? null,
    thumbnail_url: row.thumbnail_url ?? null,

    videoUrl: row.video_url ?? null,
    video_url: row.video_url ?? null,

    textDefault: row.text_default ?? "",
    text_default: row.text_default ?? "",

    creditCost: Number(row.credit_cost ?? 1),
    credit_cost: Number(row.credit_cost ?? 1),

    tags: Array.isArray(row.tags) ? row.tags : [],

    styleId: row.style_id ?? null,
    style_id: row.style_id ?? null,

    defaultDuration: row.default_duration ?? null,
    defaultAspectRatio: row.default_aspect_ratio ?? null,
    defaultResolution: row.default_resolution ?? null,
    generateAudioDefault: row.generate_audio_default ?? null,
    negativePromptDefault: row.negative_prompt_default ?? null,

    isActive: row.is_active !== false,
    is_active: row.is_active !== false,
  };
}

export function dbTemplatesToSummaries(
  rows: DbTemplateRow[] | null | undefined
): TemplateSummary[] {
  if (!Array.isArray(rows)) return [];
  return rows.map(dbTemplateToSummary);
}

export function isTemplateSummary(obj: unknown): obj is TemplateSummary {
  return (
    !!obj &&
    typeof obj === "object" &&
    typeof (obj as TemplateSummary).id === "string" &&
    typeof (obj as TemplateSummary).title === "string"
  );
}

export function isDbTemplateRow(obj: unknown): obj is DbTemplateRow {
  return (
    !!obj &&
    typeof obj === "object" &&
    typeof (obj as DbTemplateRow).id === "string"
  );
}