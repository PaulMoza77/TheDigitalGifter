export type TemplateMeta = {
  slug?: string;
  category?: string;
  subCategory?: string;
  type?: "image" | "photo" | "card";
  aspectRatio?: string;
};

export const DEFAULT_TEMPLATE_META: TemplateMeta = {
  slug: "",
  category: "Classic",
  subCategory: "Family / Group",
  type: "image",
  aspectRatio: "4:5",
};

export const TEMPLATE_METADATA: Record<string, TemplateMeta> = {};
