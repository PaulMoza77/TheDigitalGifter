import { Id } from "../../convex/_generated/dataModel";

// Shared Job type used by the frontend.
// This type extends the existing job shape with optional video-specific fields.
// All new fields are optional to preserve backward compatibility with existing image jobs.
export type Job = {
  _id: Id<"jobs">;
  _creationTime: number;
  userId: Id<"users">;
  // Keep legacy values possible (e.g. 'card') while preferring 'image'|'video'.
  type: "image" | "video" | "card";
  prompt: string;
  // Single legacy input file (kept for backward compatibility)
  inputFileId?: Id<"_storage"> | null;
  // New optional array of input files (video starter frames / multi-input)
  inputFileIds?: Id<"_storage">[];
  // Video-specific optional fields
  videoUrl?: string | null;
  duration?: 4 | 6 | 8;
  resolution?: "720p" | "1080p";
  aspectRatio?: "16:9" | "9:16" | string;
  generateAudio?: boolean;
  negativePrompt?: string | null;
  seed?: number | null;

  status: "queued" | "processing" | "done" | "error";
  resultUrl?: string | null;
  errorMessage?: string | null;
  debited?: number;
  createdAt?: number;
  updatedAt?: number;
  templateId?: Id<"templates">;
};
