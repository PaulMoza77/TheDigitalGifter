import { describe, expect, it } from "vitest";
import { normalizeBackupS3 } from "./backup-s3-url.mjs";

describe("normalizeBackupS3", () => {
  it("keeps a host-only https endpoint", () => {
    expect(normalizeBackupS3("https://abc.r2.cloudflarestorage.com", "example-bucket")).toEqual({
      endpoint: "https://abc.r2.cloudflarestorage.com",
      bucket: "example-bucket",
      repository: "s3:https://abc.r2.cloudflarestorage.com/example-bucket",
    });
  });

  it("strips a trailing bucket path so restic copy does not double the bucket", () => {
    expect(
      normalizeBackupS3("https://abc.r2.cloudflarestorage.com/example-bucket", "example-bucket"),
    ).toEqual({
      endpoint: "https://abc.r2.cloudflarestorage.com",
      bucket: "example-bucket",
      repository: "s3:https://abc.r2.cloudflarestorage.com/example-bucket",
    });
  });

  it("rejects extra path segments", () => {
    expect(() =>
      normalizeBackupS3("https://abc.r2.cloudflarestorage.com/other/example-bucket", "example-bucket"),
    ).toThrow(/path/);
  });
});
