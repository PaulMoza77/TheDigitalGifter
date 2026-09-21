import { describe, expect, it } from "vitest";
import { chunkDecision, isSafeRelpath, partialRelpath, sourceRelpath, VPS_CHUNK_BYTES } from "./vpsTransfer";

const JOB = "9a35ed68-073c-460d-b850-e7bc29ecc4ab";
const ATTEMPT = "5e3a8bbe-98cb-44f6-a357-5958d0db3d15";
const SHA = "ab".repeat(32);

describe("VPS transfer paths", () => {
  it("builds only server-owned relative paths", () => {
    expect(sourceRelpath(SHA)).toBe(`sources/${SHA}/source.mp4`);
    expect(partialRelpath(JOB, ATTEMPT)).toBe(`incoming/${JOB}/${ATTEMPT}.partial`);
    expect(isSafeRelpath(sourceRelpath(SHA))).toBe(true);
    expect(isSafeRelpath(partialRelpath(JOB, ATTEMPT))).toBe(true);
    expect(isSafeRelpath("../etc/passwd")).toBe(false);
    expect(isSafeRelpath("/var/lib/source.mp4")).toBe(false);
    expect(isSafeRelpath("sources/not-a-hash/source.mp4")).toBe(false);
  });

  it("accepts the next chunk and rejects a gap or an oversized body", () => {
    expect(chunkDecision({ currentBytes: 0, offset: 0, chunkBytes: 1024, totalBytes: 4096 })).toEqual({ ok: true, nextBytes: 1024 });
    expect(chunkDecision({ currentBytes: 1024, offset: 1024, chunkBytes: VPS_CHUNK_BYTES, totalBytes: 1024 + VPS_CHUNK_BYTES }).ok).toBe(true);
    const gap = chunkDecision({ currentBytes: 100, offset: 200, chunkBytes: 50, totalBytes: 1000 });
    expect(gap).toMatchObject({ ok: false, error: "offset_mismatch", receivedBytes: 100 });
    expect(chunkDecision({ currentBytes: 100, offset: 50, chunkBytes: 50, totalBytes: 1000 })).toMatchObject({ ok: true, nextBytes: 100 });
    const over = chunkDecision({ currentBytes: 0, offset: 0, chunkBytes: VPS_CHUNK_BYTES + 1, totalBytes: VPS_CHUNK_BYTES + 1 });
    expect(over).toMatchObject({ ok: false, error: "invalid_request" });
  });
});
