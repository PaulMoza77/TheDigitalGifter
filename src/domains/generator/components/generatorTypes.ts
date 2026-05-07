import React from "react";
import type { TemplateSummary } from "@/types/templates";

export const ALL_CATEGORIES = "all";
export const ALL_OCCASIONS = "all";
export const ALL_STYLES = "all";

export type CategoryKey = "all" | "occasions" | "personal" | "spiritual" | "pets";

export type JobRow = {
  id: string;
  type: "image" | "video";
  status: "queued" | "processing" | "done" | "error";
  result_url: string | null;
  error_message: string | null;
};

export type GenerationRow = {
  id: string;
  status: "pending" | "queued" | "processing" | "completed" | "failed" | "error";
  final_image_url: string | null;
  result_image_url?: string | null;
  preview_image_url?: string | null;
  error?: string | null;
};

export type AnyTemplate = TemplateSummary & {
  id?: string;
  _id?: string;
  title?: string;
  prompt?: string | null;
  main_category?: string | null;
  mainCategory?: string | null;
  occasion?: string | null;
  category?: string | null;
  style_id?: string | null;
  styleId?: string | null;
  previewUrl?: string | null;
  thumbnailUrl?: string | null;
  previewurl?: string | null;
  preview_url?: string | null;
  preview_image_url?: string | null;
  thumbnailurl?: string | null;
  thumbnail_url?: string | null;
  image?: string | null;
  imageUrl?: string | null;
  mediaUrl?: string | null;
  creditCost?: number;
  creditcost?: number;
  credit_cost?: number;
  type?: string;
};

export type EdgeResponse = {
  success?: boolean;
  error?: string;
  message?: string;
  imageUrl?: string;
  generation_id?: string;
};

export type CategoryOption = {
  value: CategoryKey;
  label: string;
  description: string;
  icon: React.ElementType;
};

export type FilterOption = {
  value: string;
  label: string;
  count: number;
};