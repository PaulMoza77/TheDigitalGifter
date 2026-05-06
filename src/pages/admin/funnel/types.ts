import React from "react";

export type MainCategory = "occasions" | "personal" | "spiritual" | "pets";

export type TemplateDbRow = {
  id: string;
  title: string | null;
  prompt: string | null;
  occasion: string | null;
  category: string | null;
  main_category: MainCategory | null;
  style_id: string | null;
  isactive: boolean | null;
  is_active: boolean | null;
  preview_url: string | null;
  previewurl: string | null;
  thumbnail_url: string | null;
  thumbnailurl: string | null;
  preview_image_url: string | null;
  created_at: string | null;
};

export type OccasionCollectionRow = {
  id: string;
  slug: string;
  title: string;
  main_category: MainCategory;
  label: string | null;
  description: string | null;
  image_url: string | null;
  gradient_from: string | null;
  gradient_to: string | null;
  sort_order: number;
  is_active: boolean;
  is_trending: boolean;
  created_at: string;
  updated_at: string;
};

export type OccasionGroup = {
  id: string;
  slug: string;
  title: string;
  label: string;
  description: string | null;
  mainCategory: MainCategory;
  sortOrder: number;
  isActive: boolean;
  isTrending: boolean;
  total: number;
  active: number;
  inactive: number;
  previewUrl: string | null;
};

export type MainCategoryConfig = {
  key: MainCategory;
  label: string;
  description: string;
  icon: React.ElementType;
};

export type CollectionFormState = {
  slug: string;
  title: string;
  main_category: MainCategory;
  label: string;
  description: string;
  image_url: string;
  gradient_from: string;
  gradient_to: string;
  sort_order: number;
  is_active: boolean;
  is_trending: boolean;
};

export type StyleFormState = {
  occasion: string;
  main_category: MainCategory;
  title: string;
  style_id: string;
  prompt: string;
  isactive: boolean;
  ai_notes: string;
};