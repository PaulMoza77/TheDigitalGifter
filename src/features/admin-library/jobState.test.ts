import { describe, expect, it } from "vitest";
import {
  canResetEstimateStatus,
  canSubmitPaidGeneration,
  claimSubmitInStore,
  markSubmitUnconfirmedInStore,
  persistProviderIdInStore,
  resumeAction,
  type MemoryJob,
} from "./jobState";
import { evaluateClipSpec, evaluateSourcePhoto, isFtypMp4, probeImageBuffer } from "./mediaSpec";

function png(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  bytes[12] = 0x49;
  bytes[13] = 0x48;
  bytes[14] = 0x44;
  bytes[15] = 0x52;
  bytes[16] = (width >>> 24) & 0xff;
  bytes[17] = (width >>> 16) & 0xff;
  bytes[18] = (width >>> 8) & 0xff;
  bytes[19] = width & 0xff;
  bytes[20] = (height >>> 24) & 0xff;
  bytes[21] = (height >>> 16) & 0xff;
  bytes[22] = (height >>> 8) & 0xff;
  bytes[23] = height & 0xff;
  return bytes;
}

describe("submit claim and resume", () => {
  it("lets only one concurrent claim win and never auto-submits submitting-without-id", async () => {
    const store = new Map<string, MemoryJob>();
    store.set("job-1", {
      id: "job-1",
      status: "estimated",
      provider_request_id: null,
      submit_claimed_at: null,
      budget_usd: null,
    });
    const results = await Promise.all(
      [1, 2, 3].map(async () => claimSubmitInStore(store, "job-1", 1.5, "2026-09-18T00:00:00.000Z")),
    );
    expect(results.filter((r) => r.claimed)).toHaveLength(1);
    expect(results.filter((r) => !r.claimed).every((r) => r.reason === "already_submitting")).toBe(true);
    expect(canSubmitPaidGeneration("submitting", null)).toBe(false);
    expect(resumeAction("submitting", null, Date.parse("2026-09-18T00:00:00.000Z"), Date.parse("2026-09-18T00:01:00.000Z"))).toBe(
      "wait",
    );
    expect(resumeAction("submitting", null, Date.parse("2026-09-18T00:00:00.000Z"), Date.parse("2026-09-18T00:20:00.000Z"))).toBe(
      "mark_unconfirmed",
    );
    expect(resumeAction("submit_unconfirmed", null)).toBe("none");
    expect(resumeAction("submit_unconfirmed", "hf-req-1")).toBe("poll");
  });

  it("does not reset in-flight jobs back to estimated", () => {
    expect(canResetEstimateStatus("submitting", null)).toBe(false);
    expect(canResetEstimateStatus("submit_unconfirmed", null)).toBe(false);
    expect(canResetEstimateStatus("queued", "abc")).toBe(false);
    expect(canResetEstimateStatus("estimated", null)).toBe(true);
  });

  it("treats provider accept + failed ID persist as unconfirmed, not a second POST", async () => {
    const store = new Map<string, MemoryJob>();
    store.set("job-1", {
      id: "job-1",
      status: "estimated",
      provider_request_id: null,
      submit_claimed_at: null,
      budget_usd: null,
    });
    const claim = claimSubmitInStore(store, "job-1", 1, new Date().toISOString());
    expect(claim.claimed).toBe(true);
    markSubmitUnconfirmedInStore(store, "job-1", null);
    expect(canSubmitPaidGeneration("submit_unconfirmed", null)).toBe(false);
    expect(resumeAction("submitting", null)).toBe("wait");
    const second = claimSubmitInStore(store, "job-1", 1, new Date().toISOString());
    expect(second.claimed).toBe(false);
    expect(second.reason).toBe("submit_unconfirmed");
    persistProviderIdInStore(store, "job-1", "hf-req-1");
    expect(store.get("job-1")?.provider_request_id).toBe("hf-req-1");
    expect(canSubmitPaidGeneration(store.get("job-1")!.status, store.get("job-1")!.provider_request_id)).toBe(false);
  });

  it("keeps the provider id when persist of queued status fails after accept", () => {
    const store = new Map<string, MemoryJob>();
    store.set("job-1", {
      id: "job-1",
      status: "submitting",
      provider_request_id: null,
      submit_claimed_at: new Date().toISOString(),
      budget_usd: 1,
    });
    markSubmitUnconfirmedInStore(store, "job-1", "hf-accepted-1");
    expect(store.get("job-1")?.status).toBe("submit_unconfirmed");
    expect(store.get("job-1")?.provider_request_id).toBe("hf-accepted-1");
    expect(claimSubmitInStore(store, "job-1", 1, new Date().toISOString()).claimed).toBe(false);
    expect(resumeAction("submit_unconfirmed", "hf-accepted-1")).toBe("poll");
  });
});

describe("media spec", () => {
  it("reads PNG dimensions and rejects undersized or non-9:16 stills", () => {
    expect(probeImageBuffer(png(1080, 1920))).toEqual({ format: "png", width: 1080, height: 1920 });
    expect(evaluateSourcePhoto({ width: 1080, height: 1920 }).ok).toBe(true);
    expect(evaluateSourcePhoto({ width: 720, height: 1280 }).ok).toBe(false);
    expect(evaluateSourcePhoto({ width: 941, height: 1672 }).ok).toBe(false);
    expect(evaluateSourcePhoto({ width: 941, height: 1672 }).notes.join(" ")).toMatch(/Paid submit stays blocked/);
    expect(evaluateSourcePhoto({ width: 1920, height: 1080 }).ok).toBe(false);
  });

  it("flags nonconforming clips without implying a verified 1080p 9:16 5s result", () => {
    const bad = evaluateClipSpec({ durationSeconds: 3, width: 720, height: 1280 });
    expect(bad.ok).toBe(false);
    expect(bad.notes.join(" ")).toMatch(/Original file kept/);
    expect(evaluateClipSpec({ durationSeconds: 5.1, width: 1080, height: 1920 }).ok).toBe(true);
    const ftyp = new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
    expect(isFtypMp4(ftyp)).toBe(true);
    expect(isFtypMp4(new Uint8Array([1, 2, 3, 4]))).toBe(false);
  });
});
