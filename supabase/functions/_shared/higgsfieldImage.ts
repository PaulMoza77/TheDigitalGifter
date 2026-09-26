/**
 * Public /generator image request rules for Higgsfield.
 * Pure module: no credentials, no network. The edge function performs I/O.
 *
 * Higgsfield's production image model labeled "Nano Banana Pro" is job id
 * `nano_banana_2` (up to 14 image references, explicit aspect ratio, 1k/2k/4k).
 * There is no separate `nano_banana_pro` application id in the current catalog.
 */

export const HIGGSFIELD_API_BASE = "https://api.higgsfield.ai";
export const PUBLIC_GENERATOR_SOURCE = "tdg_generator_page";
export const HIGGSFIELD_IMAGE_MODEL = "nano_banana_2";
export const HIGGSFIELD_IMAGE_MODEL_LABEL = "Nano Banana Pro";
export const HIGGSFIELD_IMAGE_RESOLUTION = "2k";
export const HIGGSFIELD_PROVIDER = "higgsfield";
export const MAX_GENERATOR_SOURCE_IMAGES = 4;
export const GENERATOR_SOURCE_BUCKET = "generator-sources";

export const GENERATION_UNAVAILABLE_MESSAGE =
  "Generation is temporarily unavailable. Please try again shortly.";

export const HIGGSFIELD_IMAGE_ASPECT_RATIOS = [
  "1:1",
  "3:2",
  "2:3",
  "4:3",
  "3:4",
  "4:5",
  "5:4",
  "9:16",
  "16:9",
  "21:9",
] as const;

export type HiggsfieldAspectRatio = (typeof HIGGSFIELD_IMAGE_ASPECT_RATIOS)[number];

const PRIMARY_ASPECT_RATIOS = ["9:16", "1:1", "16:9"] as const;

export const GENERATOR_ASPECT_CHOICES = [
  { id: "9:16", label: "Portrait", detail: "9:16", group: "primary" },
  { id: "1:1", label: "Square", detail: "1:1", group: "primary" },
  { id: "16:9", label: "Landscape", detail: "16:9", group: "primary" },
  { id: "4:5", label: "4:5", detail: "4:5", group: "more" },
  { id: "3:4", label: "3:4", detail: "3:4", group: "more" },
  { id: "2:3", label: "2:3", detail: "2:3", group: "more" },
  { id: "4:3", label: "4:3", detail: "4:3", group: "more" },
  { id: "3:2", label: "3:2", detail: "3:2", group: "more" },
  { id: "5:4", label: "5:4", detail: "5:4", group: "more" },
  { id: "21:9", label: "21:9", detail: "21:9", group: "more" },
] as const;

export function isPublicGenerator(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== "object") return false;
  return String((metadata as { source?: unknown }).source || "") === PUBLIC_GENERATOR_SOURCE;
}

export function resolveAspectRatio(value: unknown): HiggsfieldAspectRatio | null {
  const raw = String(value ?? "").trim();
  if ((HIGGSFIELD_IMAGE_ASPECT_RATIOS as readonly string[]).includes(raw)) {
    return raw as HiggsfieldAspectRatio;
  }
  return null;
}

/** Live /generator rows stored the Replicate placeholder. Map only that value. */
export function aspectRatioForStoredGeneration(value: unknown): HiggsfieldAspectRatio | null {
  if (String(value ?? "").trim() === "match_input_image") return "9:16";
  return resolveAspectRatio(value);
}

const TDG_PUBLIC_UPLOAD_PREFIX =
  "https://kjlsocejpmnzhhduyumy.supabase.co/storage/v1/object/public/uploads/";

/** Public upload URL from the generator that is still live during the backend cutover. */
export function legacyGeneratorSourceUrl(value: unknown): string | null {
  const url = String(value ?? "").trim();
  if (!url.startsWith(TDG_PUBLIC_UPLOAD_PREFIX)) return null;
  if (url.includes("..") || url.includes("\\") || /\s/.test(url)) return null;
  return url;
}

export function isPrimaryAspectRatio(value: string): boolean {
  return (PRIMARY_ASPECT_RATIOS as readonly string[]).includes(value);
}

export function authoritativeCreditCost(value: unknown): number {
  if (value === null || value === undefined || value === "") return 1;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error("Template credit cost is not configured.");
  }
  return Math.floor(parsed);
}

/**
 * Mirrors public.debit_credits_on_generation_complete.
 * Debit happens only on the transition into completed, once per generation note.
 */
export function completionDebit(input: {
  previousStatus: string | null | undefined;
  nextStatus: string | null | undefined;
  creditCost: number;
  email: string | null | undefined;
  alreadyDebited: boolean;
}): number {
  if (String(input.nextStatus || "") !== "completed") return 0;
  if (String(input.previousStatus || "") === "completed") return 0;
  if (input.alreadyDebited) return 0;
  const email = String(input.email || "").trim().toLowerCase();
  if (!email) return 0;
  const configured = Math.floor(Number(input.creditCost));
  if (!Number.isFinite(configured) || configured < 1) return 1;
  return configured;
}

export function providerAction(input: {
  status?: string | null;
  providerRequestId?: string | null;
  providerOutputUrl?: string | null;
  finalImageUrl?: string | null;
}): "return_completed" | "store_output" | "poll" | "submit" {
  const status = String(input.status || "");
  if (status === "completed" && String(input.finalImageUrl || "").trim()) {
    return "return_completed";
  }
  if (String(input.providerOutputUrl || "").trim()) return "store_output";
  if (String(input.providerRequestId || "").trim()) return "poll";
  return "submit";
}

export function collectHttpUrls(values: unknown[], limit: number): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const value of values) {
    const url = String(value ?? "").trim();
    if (!/^https?:\/\//i.test(url) || seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
    if (urls.length >= limit) break;
  }
  return urls;
}

export function templateImageUrl(template: Record<string, unknown> | null | undefined): string {
  if (!template) return "";
  const candidates = [
    template.preview_image_url,
    template.preview_url,
    template.previewurl,
    template.thumbnail_url,
    template.thumbnailurl,
  ];
  for (const candidate of candidates) {
    const url = String(candidate ?? "").trim();
    if (/^https?:\/\//i.test(url)) return url;
  }
  return "";
}

export function buildGeneratorPrompt(input: {
  sourceCount: number;
  templateTitle?: string | null;
  occasion?: string | null;
  templatePrompt?: string | null;
  userInstructions?: string | null;
  personalizedName?: string | null;
}): string {
  const sourceCount = Math.max(1, Math.min(MAX_GENERATOR_SOURCE_IMAGES, input.sourceCount));
  const templateIndex = sourceCount + 1;
  const name = String(input.personalizedName || "").trim();
  const occasion = String(input.occasion || "").trim().toLowerCase().replace(/-/g, "_");
  const lines = [
    "Create one premium photorealistic personalized image.",
    sourceCount === 1
      ? "REFERENCE 1 is the customer's uploaded photo. Preserve the customer's recognizable identity: face, age, skin tone, hair, body and subject characteristics, and the number of people."
      : `REFERENCE images 1 through ${sourceCount} are the customer's uploaded photos. Preserve each real person from those photos: face, age, skin tone, hair, body and subject characteristics, and the number of people. Do not invent extra people and do not drop someone who is clearly in the photos.`,
    `REFERENCE ${templateIndex} is the selected template image. Use it for composition, environment, lighting, props, visual direction, mood, and overall scene style.`,
    "Recreate the selected visual concept while keeping the customer recognizable. Do not copy the customer's original background unless it fits the template.",
    "Do not distort hands, eyes, mouths, or limbs. Avoid random text, logos, watermarks, captions, and unreadable typography.",
    occasion === "name_cards" && name
      ? `Include the name "${name}" as the main readable name text. Spell it exactly: ${name}.`
      : "",
    String(input.templateTitle || "").trim() ? `Template title: ${String(input.templateTitle).trim()}.` : "",
    String(input.occasion || "").trim() ? `Occasion: ${String(input.occasion).trim()}.` : "",
    String(input.templatePrompt || "").trim()
      ? `Template-specific instruction: ${String(input.templatePrompt).trim()}`
      : "",
    String(input.userInstructions || "").trim()
      ? `Customer request: ${String(input.userInstructions).trim()}`
      : "",
  ];
  return lines.filter(Boolean).join("\n");
}

export function higgsfieldImageRequest(input: {
  prompt: string;
  aspectRatio: HiggsfieldAspectRatio;
  imageReferences: string[];
}): { path: string; body: Record<string, unknown> } {
  if (input.imageReferences.length < 2) {
    throw new Error("Higgsfield image generation requires the customer photo and the template image.");
  }
  return {
    path: `/${HIGGSFIELD_IMAGE_MODEL}`,
    body: {
      prompt: input.prompt,
      aspect_ratio: input.aspectRatio,
      resolution: HIGGSFIELD_IMAGE_RESOLUTION,
      image_references: input.imageReferences,
    },
  };
}

export function readHiggsfieldAuthorization(env: {
  get(name: string): string | undefined;
}): string | null {
  const combined = String(env.get("HF_CREDENTIALS") || env.get("HF_KEY") || "").trim();
  const splitAt = combined.indexOf(":");
  if (splitAt > 0) {
    const keyId = combined.slice(0, splitAt).trim();
    const secret = combined.slice(splitAt + 1).trim();
    if (keyId && secret) return `Key ${keyId}:${secret}`;
  }
  const keyId = String(env.get("HF_API_KEY_ID") || env.get("HF_API_KEY") || "").trim();
  const secret = String(
    env.get("HF_API_KEY_SECRET") || env.get("HF_SECRET") || env.get("HF_API_SECRET") || "",
  ).trim();
  if (keyId && secret) return `Key ${keyId}:${secret}`;
  return null;
}

export function isTerminalHiggsfieldStatus(status: string): boolean {
  return ["completed", "succeeded", "failed", "nsfw", "canceled", "cancelled", "error"].includes(
    status.toLowerCase(),
  );
}

export function isSuccessfulHiggsfieldStatus(status: string): boolean {
  return ["completed", "succeeded"].includes(status.toLowerCase());
}

export function extractHiggsfieldImageUrl(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  const images = record.images;
  if (Array.isArray(images)) {
    for (const image of images) {
      if (image && typeof image === "object" && typeof (image as { url?: unknown }).url === "string") {
        return (image as { url: string }).url;
      }
      if (typeof image === "string" && /^https?:\/\//i.test(image)) return image;
    }
  }
  if (typeof record.image_url === "string") return record.image_url;
  const image = record.image;
  if (image && typeof image === "object" && typeof (image as { url?: unknown }).url === "string") {
    return (image as { url: string }).url;
  }
  const output = record.output;
  if (typeof output === "string" && /^https?:\/\//i.test(output)) return output;
  if (Array.isArray(output) && typeof output[0] === "string") return output[0];
  return null;
}

export function sniffStoredImage(bytes: Uint8Array): { contentType: string; extension: "jpg" | "png" | "webp" } {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { contentType: "image/jpeg", extension: "jpg" };
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return { contentType: "image/png", extension: "png" };
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { contentType: "image/webp", extension: "webp" };
  }
  return { contentType: "image/jpeg", extension: "jpg" };
}

export function downloadNameForResult(input: {
  contentType?: string | null;
  url?: string | null;
  extension?: string | null;
}): string {
  const explicit = String(input.extension || "").toLowerCase().replace(/^\./, "");
  if (explicit === "jpg" || explicit === "jpeg") return "creation.jpg";
  if (explicit === "png") return "creation.png";
  if (explicit === "webp") return "creation.webp";
  const type = String(input.contentType || "").toLowerCase();
  if (type.includes("png")) return "creation.png";
  if (type.includes("webp")) return "creation.webp";
  if (type.includes("jpeg") || type.includes("jpg")) return "creation.jpg";
  const url = String(input.url || "").toLowerCase().split("?")[0];
  if (url.endsWith(".png")) return "creation.png";
  if (url.endsWith(".webp")) return "creation.webp";
  if (url.endsWith(".jpg") || url.endsWith(".jpeg")) return "creation.jpg";
  return "creation.jpg";
}

export function aspectLabel(value: string): string {
  if (value === "9:16") return "Portrait";
  if (value === "1:1") return "Square";
  if (value === "16:9") return "Landscape";
  return value;
}
