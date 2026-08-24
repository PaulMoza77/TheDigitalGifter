import { describe, expect, it } from "vitest";
import { FunnelIngestError } from "../../src/features/pet/funnelEventContract";
import {
  ingestFromUnknown,
  originAllowed,
  parseJsonBody,
  resolveIsTest,
  resolveWriteEnvironment,
} from "./writePetFunnelEvent";

const session = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("pet funnel ingest writer helpers", () => {
  it("marks preview and development as test and ignores production client flags", () => {
    expect(resolveIsTest("preview", false)).toBe(true);
    expect(resolveIsTest("development", false)).toBe(true);
    expect(resolveIsTest("production", true)).toBe(false);
    expect(resolveIsTest("production", false)).toBe(false);
  });

  it("allows first-party origins only", () => {
    expect(originAllowed("https://www.thedigitalgifter.com", "www.thedigitalgifter.com")).toBe(true);
    expect(originAllowed("https://evil.example", "www.thedigitalgifter.com")).toBe(false);
    expect(originAllowed("", "localhost:5173")).toBe(true);
  });

  it("rejects oversized JSON bodies", async () => {
    const huge = `"${"x".repeat(5000)}"`;
    await expect(parseJsonBody({ body: huge })).rejects.toBeInstanceOf(FunnelIngestError);
  });

  it("accepts a valid ingest payload and rejects a duplicate-shaped invalid event", () => {
    const valid = ingestFromUnknown(
      {
        event_name: "order_review_viewed",
        funnel_session_id: session,
        event_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      },
      80,
    );
    expect(valid.eventName).toBe("order_review_viewed");
    expect(() => ingestFromUnknown({ event_name: "not_real", funnel_session_id: session }, 40)).toThrow(
      FunnelIngestError,
    );
  });

  it("treats missing Vercel env as development", () => {
    const previous = process.env.VERCEL_ENV;
    delete process.env.VERCEL_ENV;
    expect(resolveWriteEnvironment()).toBe("development");
    if (previous == null) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = previous;
  });
});
