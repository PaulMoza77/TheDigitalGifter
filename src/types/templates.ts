import { Id } from "../../convex/_generated/dataModel";

export type TemplateSummary = {
  _id: Id<"templates">;
  _creationTime: number;
  slug: string;
  title: string;
  category: string;
  subCategory: string;
  // Normalized template type: 'image' | 'video'.
  // Legacy DB values ("photo", "card") are normalized to "image" by server helpers.
  type: "image" | "video";
  orientation: "portrait" | "landscape";
  aspectRatio: string;
  previewUrl: string;
  creditCost: number;
  tags: string[];
  scene: string;
  textDefault: string;
};
