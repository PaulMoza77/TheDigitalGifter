import { Id } from "../../convex/_generated/dataModel";

export type TemplateSummary = {
  _id: Id<"templates">;
  _creationTime: number;
  slug: string;
  title: string;
  category: string;
  subCategory: string;
  type: string;
  orientation: "portrait" | "landscape";
  aspectRatio: string;
  previewUrl: string;
  creditCost: number;
  tags: string[];
  scene: string;
  textDefault: string;
};
