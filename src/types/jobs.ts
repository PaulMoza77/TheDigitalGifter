export type JobType = "image" | "video" | "card";
export type JobStatus = "queued" | "processing" | "done" | "error";

/** Exact cum e natural în Supabase (coloane snake_case). */
export type DbJobRow = {
  id: string; // uuid
  user_id: string; // uuid (auth.users.id)

  created_at: string; // timestamptz ISO
  updated_at: string | null;

  type: JobType;
  prompt: string;

  status: JobStatus;

  // input(s) - recomandat să fie storage paths (nu IDs)
  input_file_path: string | null;
  input_file_paths: string[] | null;

  // output/result
  result_url: string | null;

  // video optional
  video_url: string | null;
  duration: 4 | 6 | 8 | null;
  resolution: "720p" | "1080p" | null;
  aspect_ratio: string | null; // ex: "16:9" / "9:16"
  generate_audio: boolean | null;
  negative_prompt: string | null;
  seed: number | null;

  // error
  error_message: string | null;

  // billing
  debited: number | null;

  // linkage
  template_id: string | null; // uuid
};

/** UI type (camelCase) – dacă restul codebase folosește așa. */
export type Job = {
  id: string;
  userId: string;

  createdAt: string;
  updatedAt?: string | null;

  type: JobType;
  prompt: string;

  status: JobStatus;

  inputFilePath?: string | null;
  inputFilePaths?: string[] | null;

  resultUrl?: string | null;

  videoUrl?: string | null;
  duration?: 4 | 6 | 8 | null;
  resolution?: "720p" | "1080p" | null;
  aspectRatio?: string | null;
  generateAudio?: boolean | null;
  negativePrompt?: string | null;
  seed?: number | null;

  errorMessage?: string | null;

  debited?: number | null;

  templateId?: string | null;
};

export function dbJobToJob(r: DbJobRow): Job {
  return {
    id: r.id,
    userId: r.user_id,

    createdAt: r.created_at,
    updatedAt: r.updated_at,

    type: r.type,
    prompt: r.prompt,

    status: r.status,

    inputFilePath: r.input_file_path,
    inputFilePaths: r.input_file_paths,

    resultUrl: r.result_url,

    videoUrl: r.video_url,
    duration: r.duration,
    resolution: r.resolution,
    aspectRatio: r.aspect_ratio,
    generateAudio: r.generate_audio,
    negativePrompt: r.negative_prompt,
    seed: r.seed,

    errorMessage: r.error_message,

    debited: r.debited,

    templateId: r.template_id,
  };
}
