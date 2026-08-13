import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectImageMime, validateImageUpload } from "./imageValidation.ts";

const jpegHeader = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const pngHeader = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const textHeader = Uint8Array.from([0x3c, 0x68, 0x74, 0x6d, 0x6c]);

describe("detectImageMime", () => {
  it("detects JPEG and PNG magic bytes", () => {
    assert.equal(detectImageMime(jpegHeader), "image/jpeg");
    assert.equal(detectImageMime(pngHeader), "image/png");
    assert.equal(detectImageMime(textHeader), null);
  });
});

describe("validateImageUpload", () => {
  it("accepts a real JPEG under the size limit", () => {
    const result = validateImageUpload({
      fileName: "photo.jpg",
      reportedMime: "image/jpeg",
      sizeBytes: 120_000,
      headerBytes: jpegHeader,
    });
    assert.equal(result.ok, true);
  });

  it("rejects a renamed text file", () => {
    const result = validateImageUpload({
      fileName: "photo.jpg",
      reportedMime: "image/jpeg",
      sizeBytes: 1200,
      headerBytes: textHeader,
    });
    assert.equal(result.ok, false);
  });

  it("rejects oversized files", () => {
    const result = validateImageUpload({
      fileName: "photo.jpg",
      reportedMime: "image/jpeg",
      sizeBytes: 20 * 1024 * 1024,
      headerBytes: jpegHeader,
    });
    assert.equal(result.ok, false);
  });
});
