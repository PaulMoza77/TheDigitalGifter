import { Id } from "../../convex/_generated/dataModel";

export type TemplateSummary = {
  _id: Id<"templates">;
  _creationTime: number;
  slug: string;
  title: string;
  occasion: string;
  category: string;
  subCategory: string;
  type: "image" | "video";
  orientation: "portrait" | "landscape";
  aspectRatio: string;
  previewUrl: string;
  thumbnailUrl?: string;
  creditCost: number;
  tags: string[];
  scene: string;
  textDefault: string;
};
