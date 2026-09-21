import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  SUPABASE_SAFE_OBJECT_BYTES,
  assertSafeObjectPath,
  chooseStorageBackend,
  isPermanentSupabaseReject,
  persistObjectToVps,
  resolveVpsAbsolutePath,
} from "./storage";

const originalDir = process.env.LONG_FORM_DATA_DIR;

afterEach(() => {
  if (originalDir === undefined) delete process.env.LONG_FORM_DATA_DIR;
  else process.env.LONG_FORM_DATA_DIR = originalDir;
});

describe("long-form VPS storage", () => {
  it("blocks path traversal", () => {
    expect(() => assertSafeObjectPath("productions/../secret")).toThrow();
    expect(() => assertSafeObjectPath("/etc/passwd")).toThrow();
    expect(assertSafeObjectPath("productions/a91b5dd4-581b-4ba2-9a99-6e332d7ebe9a/final.mp4")).toContain("final.mp4");
  });

  it("selects VPS for large files when the mount exists and never retries 413", async () => {
    const dir = await mkdtemp(join(tmpdir(), "tdg-lf-data-"));
    process.env.LONG_FORM_DATA_DIR = dir;
    expect(chooseStorageBackend(1_600_000_000)).toBe("vps");
    expect(chooseStorageBackend(12)).toBe("vps");
    expect(isPermanentSupabaseReject("Storage upload failed (413). Maximum size exceeded")).toBe(true);
    expect(isPermanentSupabaseReject("ok")).toBe(false);
    await rm(dir, { recursive: true, force: true });
  });

  it("refuses oversized Supabase uploads when VPS is missing", () => {
    delete process.env.LONG_FORM_DATA_DIR;
    const previousVitest = process.env.VITEST;
    const previousLocal = process.env.LONG_FORM_ALLOW_LOCAL;
    delete process.env.VITEST;
    delete process.env.LONG_FORM_ALLOW_LOCAL;
    try {
      expect(() => chooseStorageBackend(SUPABASE_SAFE_OBJECT_BYTES + 1)).toThrow(/Persistent VPS storage is not mounted/);
    } finally {
      if (previousVitest !== undefined) process.env.VITEST = previousVitest;
      if (previousLocal !== undefined) process.env.LONG_FORM_ALLOW_LOCAL = previousLocal;
    }
  });

  it("finalizes files atomically under the production id", async () => {
    const dir = await mkdtemp(join(tmpdir(), "tdg-lf-data-"));
    process.env.LONG_FORM_DATA_DIR = dir;
    const srcDir = await mkdtemp(join(tmpdir(), "tdg-lf-src-"));
    const src = join(srcDir, "final.mp4");
    await writeFile(src, "demo-bytes");
    const objectPath = "productions/a91b5dd4-581b-4ba2-9a99-6e332d7ebe9a/final.mp4";
    const stored = await persistObjectToVps(src, objectPath);
    expect(stored.bytes).toBe(10);
    expect(stored.absolutePath).toBe(resolveVpsAbsolutePath(objectPath));
    await mkdir(join(dir, "productions"), { recursive: true });
    await rm(dir, { recursive: true, force: true });
    await rm(srcDir, { recursive: true, force: true });
  });
});
