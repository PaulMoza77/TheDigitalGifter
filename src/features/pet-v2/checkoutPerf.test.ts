import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { prepareV2CheckoutUpload } from "./photo";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
function readSrc(relative: string) {
  return readFileSync(resolve(root, relative), "utf8");
}

describe("V2 checkout performance helpers", () => {
  it("exposes staged loading copy for bootstrap phases", () => {
    const hook = readSrc("src/features/pet-v2/useV2EmbeddedCheckout.ts");
    expect(hook).toContain('case "preparing_photo"');
    expect(hook).toContain('case "uploading"');
    expect(hook).toContain("Preparing your photo…");
    expect(hook).toContain("Uploading your photo…");
  });

  it("prepareV2CheckoutUpload returns usable photo metadata without throwing", async () => {
    // jsdom may lack createImageBitmap — then helper returns the original file safely.
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9, ...new Array(2_000).fill(1)]);
    const file = new File([bytes], "buddy.png", { type: "image/png" });
    const prepared = await prepareV2CheckoutUpload(file);
    expect(prepared.photo.byteSize).toBeGreaterThan(0);
    expect(prepared.photo.fileName.length).toBeGreaterThan(0);
    expect(["image/jpeg", "image/png"]).toContain(prepared.photo.contentType);
  });
});
