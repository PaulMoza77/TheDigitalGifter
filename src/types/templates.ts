// src/types/templates.ts
// Supabase-based implementation
// Fully backward compatible with previous Convex-style usage (_id, _creationTime)

export type TemplateType = "image" | "video";
export type TemplateOrientation = "portrait" | "landscape";

/* ============================================================
   DATABASE ROW (Supabase - snake_case, matches table columns)
============================================================ */

export type DbTemplateRow = {
  id: string; // uuid
  created_at: string; // timestamptz ISO
  updated_at: string | null;

  slug: string;
  title: string;

  occasion: string;
  category: string;
  sub_category: string;

  type: TemplateType;

  orientation: TemplateOrientation;
  aspect_ratio: string;

  preview_url: string;
  thumbnail_url: string | null;

  credit_cost: number;

  tags: string[]; // jsonb text[] in Supabase
  scene: string;
  text_default: string;
};

/* ============================================================
   UI SUMMARY (camelCase)
   + Convex backward compatibility fields
============================================================ */

export type TemplateSummary = {
  // ✅ New primary identifiers
  id: string;
  createdAt: string;
  updatedAt?: string | null;

  // ✅ Backward compatibility (Convex-style)
  _id: string;
  _creationTime: number;

  slug: string;
  title: string;

  occasion: string;
  category: string;

  // Keep both camelCase and legacy snake alias
  subCategory: string;
  sub_category?: string;

  type: TemplateType;

  orientation: TemplateOrientation;
  aspectRatio: string;

  previewUrl: string;
  thumbnailUrl?: string | null;

  creditCost: number;

  tags: string[];

  scene: string;
  textDefault: string;
};

/* ============================================================
   DB → UI MAPPER
============================================================ */

export function dbTemplateToSummary(row: DbTemplateRow): TemplateSummary {
  const creationMs = Number.isFinite(Date.parse(row.created_at))
    ? Date.parse(row.created_at)
    : Date.now();

  return {
    // new primary
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? null,

    // backward compat
    _id: row.id,
    _creationTime: creationMs,

    slug: row.slug,
    title: row.title,

    occasion: row.occasion,
    category: row.category,

    subCategory: row.sub_category,
    sub_category: row.sub_category,

    type: row.type,

    orientation: row.orientation,
    aspectRatio: row.aspect_ratio,

    previewUrl: row.preview_url,
    thumbnailUrl: row.thumbnail_url ?? null,

    creditCost: row.credit_cost,

    tags: Array.isArray(row.tags) ? row.tags : [],

    scene: row.scene,
    textDefault: row.text_default,
  };
}

/* ============================================================
   BULK MAPPER
============================================================ */

export function dbTemplatesToSummaries(
  rows: DbTemplateRow[] | null | undefined
): TemplateSummary[] {
  if (!rows || !Array.isArray(rows)) return [];
  return rows.map(dbTemplateToSummary);
}

/* ============================================================
   OPTIONAL: UI → DB (for inserts / updates)
============================================================ */

export function summaryToDbTemplate(
  summary: TemplateSummary
): DbTemplateRow {
  return {
    id: summary.id,
    created_at: summary.createdAt,
    updated_at: summary.updatedAt ?? null,

    slug: summary.slug,
    title: summary.title,

    occasion: summary.occasion,
    category: summary.category,
    sub_category: summary.subCategory,

    type: summary.type,

    orientation: summary.orientation,
    aspect_ratio: summary.aspectRatio,

    preview_url: summary.previewUrl,
    thumbnail_url: summary.thumbnailUrl ?? null,

    credit_cost: summary.creditCost,

    tags: Array.isArray(summary.tags) ? summary.tags : [],

    scene: summary.scene,
    text_default: summary.textDefault,
  };
}

/* ============================================================
   TYPE GUARDS (optional but safe)
============================================================ */

export function isTemplateSummary(obj: any): obj is TemplateSummary {
  return (
    obj &&
    typeof obj === "object" &&
    typeof obj.id === "string" &&
    typeof obj.slug === "string" &&
    typeof obj.type === "string"
  );
}

export function isDbTemplateRow(obj: any): obj is DbTemplateRow {
  return (
    obj &&
    typeof obj === "object" &&
    typeof obj.id === "string" &&
    typeof obj.created_at === "string"
  );
}
