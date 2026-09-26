import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  GENERATION_UNAVAILABLE_MESSAGE,
  HIGGSFIELD_IMAGE_MODEL,
  HIGGSFIELD_PROVIDER,
  authoritativeCreditCost,
  buildGeneratorPrompt,
  completionDebit,
  downloadNameForResult,
  extractHiggsfieldImageUrl,
  higgsfieldImageRequest,
  isPublicGenerator,
  providerAction,
  readHiggsfieldAuthorization,
  resolveAspectRatio,
  sniffStoredImage,
  templateImageUrl,
} from "../../../supabase/functions/_shared/higgsfieldImage";
import { templateMatchesLook } from "./components/generatorUtils";

function read(path: string) {
  return readFileSync(path, "utf8");
}

describe("public generator higgsfield request", () => {
  it("builds a higgsfield image request with both references and aspect ratio", () => {
    const prompt = buildGeneratorPrompt({
      sourceCount: 2,
      templateTitle: "Christmas Magic",
      occasion: "christmas",
      templatePrompt: "snowy porch",
      userInstructions: "Keep our faces natural",
    });
    expect(prompt).toContain("REFERENCE images 1 through 2");
    expect(prompt).toContain("REFERENCE 3 is the selected template");
    expect(prompt).toContain("face");
    const request = higgsfieldImageRequest({
      prompt,
      aspectRatio: "9:16",
      imageReferences: ["https://cdn.example/source-a.jpg", "https://cdn.example/source-b.jpg", "https://cdn.example/template.jpg"],
    });
    expect(request.path).toBe(`/${HIGGSFIELD_IMAGE_MODEL}`);
    expect(request.body.aspect_ratio).toBe("9:16");
    expect(request.body.resolution).toBe("2k");
    expect(request.body.image_references).toEqual([
      "https://cdn.example/source-a.jpg",
      "https://cdn.example/source-b.jpg",
      "https://cdn.example/template.jpg",
    ]);
    expect(JSON.stringify(request)).not.toContain("replicate");
  });

  it("rejects unsupported ratios instead of sending match_input_image", () => {
    expect(resolveAspectRatio("9:16")).toBe("9:16");
    expect(resolveAspectRatio("match_input_image")).toBeNull();
    expect(resolveAspectRatio("9:21")).toBeNull();
  });

  it("stores the template credit cost and debits only once on completion", () => {
    expect(authoritativeCreditCost(1)).toBe(1);
    expect(authoritativeCreditCost(10)).toBe(10);
    expect(authoritativeCreditCost(null)).toBe(1);
    expect(() => authoritativeCreditCost(0)).toThrow();
    expect(
      completionDebit({
        previousStatus: "processing",
        nextStatus: "failed",
        creditCost: 10,
        email: "a@example.com",
        alreadyDebited: false,
      }),
    ).toBe(0);
    expect(
      completionDebit({
        previousStatus: "processing",
        nextStatus: "completed",
        creditCost: 10,
        email: "a@example.com",
        alreadyDebited: false,
      }),
    ).toBe(10);
    expect(
      completionDebit({
        previousStatus: "completed",
        nextStatus: "completed",
        creditCost: 10,
        email: "a@example.com",
        alreadyDebited: false,
      }),
    ).toBe(0);
    expect(
      completionDebit({
        previousStatus: "processing",
        nextStatus: "completed",
        creditCost: 10,
        email: "a@example.com",
        alreadyDebited: true,
      }),
    ).toBe(0);
    expect(
      completionDebit({
        previousStatus: "pending",
        nextStatus: "completed",
        creditCost: 1,
        email: "a@example.com",
        alreadyDebited: false,
      }),
    ).toBe(1);
  });

  it("does not submit a second provider job when a request id already exists", () => {
    expect(providerAction({ providerRequestId: "req_123" })).toBe("poll");
    expect(providerAction({ providerOutputUrl: "https://cdn.example/out.jpg" })).toBe("store_output");
    expect(providerAction({ status: "completed", finalImageUrl: "https://cdn.example/final.jpg" })).toBe(
      "return_completed",
    );
    expect(providerAction({})).toBe("submit");
  });

  it("fails closed when higgsfield credentials are missing and never reads replicate", () => {
    expect(readHiggsfieldAuthorization({ get: () => undefined })).toBeNull();
    expect(GENERATION_UNAVAILABLE_MESSAGE).toBe(
      "Generation is temporarily unavailable. Please try again shortly.",
    );
    const auth = readHiggsfieldAuthorization({
      get: (name) => (name === "HF_CREDENTIALS" ? "key-id:key-secret" : undefined),
    });
    expect(auth?.startsWith("Key ")).toBe(true);
    expect(auth).not.toContain("replicate");
  });

  it("names jpeg downloads jpg and reads the template image url", () => {
    expect(sniffStoredImage(new Uint8Array([0xff, 0xd8, 0xff, 0x00])).extension).toBe("jpg");
    expect(sniffStoredImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0])).extension).toBe("png");
    expect(downloadNameForResult({ contentType: "image/jpeg" })).toBe("creation.jpg");
    expect(downloadNameForResult({ contentType: "image/png" })).toBe("creation.png");
    expect(downloadNameForResult({ url: "https://cdn.example/generations/1.jpg" })).toBe("creation.jpg");
    expect(
      templateImageUrl({
        preview_image_url: "https://cdn.example/template.jpg",
      }),
    ).toBe("https://cdn.example/template.jpg");
    expect(extractHiggsfieldImageUrl({ images: [{ url: "https://cdn.example/out.jpg" }] })).toBe(
      "https://cdn.example/out.jpg",
    );
    expect(isPublicGenerator({ source: "tdg_generator_page" })).toBe(true);
    expect(isPublicGenerator({ source: "legacy" })).toBe(false);
    expect(HIGGSFIELD_PROVIDER).toBe("higgsfield");
  });
});

describe("public generator wiring", () => {
  it("routes the public generator to higgsfield and keeps replicate off that path", () => {
    const index = read("supabase/functions/generate-nano-banana/index.ts");
    const handler = index.split("Deno.serve")[1] || "";
    const branch = handler.indexOf("isPublicGenerator");
    const legacy = handler.indexOf("generateWithReplicate");
    expect(branch).toBeGreaterThan(-1);
    expect(legacy).toBeGreaterThan(branch);
    const publicHandler = read("supabase/functions/generate-nano-banana/publicGenerator.ts");
    const client = read("supabase/functions/_shared/higgsfieldClient.ts");
    const rules = read("supabase/functions/_shared/higgsfieldImage.ts");
    expect(publicHandler).toContain("handlePublicGenerator");
    expect(publicHandler).not.toContain("api.replicate.com");
    expect(publicHandler).not.toContain("REPLICATE_API_TOKEN");
    expect(client).not.toContain("api.replicate.com");
    expect(publicHandler).toContain("credit_cost: creditCost");
    expect(rules).toContain("image_references");
    expect(publicHandler).toContain("Not enough credits");
  });

  it("hides video controls and shows the real template cost", () => {
    const page = read("src/domains/generator/components/Generator.tsx");
    const bar = read("src/domains/generator/components/GenerationBar.tsx");
    const upload = read("src/domains/generator/components/UploadSection.tsx");
    const result = read("src/domains/generator/components/BeforeAfterPreview.tsx");
    expect(page).not.toContain("useCreateVideoJobMutation");
    expect(page).not.toContain("negativePrompt");
    expect(page).not.toContain('bucket: "uploads"');
    expect(page).toContain("GENERATOR_SOURCE_BUCKET");
    expect(bar).toContain("Create my image");
    expect(bar).not.toContain("With Audio");
    expect(bar).not.toContain("Negative Prompt");
    expect(upload).toContain("Upload a photo");
    expect(upload).toContain("JPG, PNG or WEBP");
    expect(result).toContain("Your creation is ready");
    expect(result).toContain("downloadNameForResult");
  });

  it("keeps the database debit idempotent", () => {
    const sql = read("supabase/migrations/20260729120000_remote_baseline.sql");
    expect(sql).toContain("debit_credits_on_generation_complete");
    expect(sql).toContain("generation:' || new.id::text");
    expect(sql).toContain("old.status is distinct from 'completed'");
    const billing = read("supabase/migrations/20260926120000_public_generator_higgsfield.sql");
    expect(billing).toContain("generator-sources");
    expect(billing).toContain("public = false");
    expect(billing).toContain("claim_public_generator_submit");
  });

  it("limits the image generator to real photos and supported looks", () => {
    expect(templateMatchesLook({ type: "video", occasion: "christmas" }, "christmas")).toBe(false);
    expect(templateMatchesLook({ type: "image", occasion: "christmas" }, "christmas")).toBe(true);
    expect(templateMatchesLook({ type: "image", occasion: "birthday" }, "christmas")).toBe(false);
    expect(templateMatchesLook({ type: "image", occasion: "dogs", main_category: "pets" }, "pets")).toBe(true);
  });
});
