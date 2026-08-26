import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "../../..");

function read(path: string): string {
  return readFileSync(resolve(root, path), "utf8");
}

describe("V2 funnel-event ingest health gating", () => {
  it("does not write pet_funnel_event_failures for successful generation-failure telemetry", () => {
    const ingest = read("api/pet-v2-funnel-event.ts");
    expect(ingest).toContain("Successfully ingested generation-failure events are product telemetry");
    expect(ingest).not.toMatch(
      /if \(eventName === "v2_preview_generation_failed" && failureCategory\)[\s\S]*persistV2WriteFailure/,
    );
    expect(ingest).toContain("p_failure_category: validated.failureCategory");
    expect(ingest).toContain("normalizeFailureCategory");
  });

  it("counts only persistence categories in SQL health helper", () => {
    const migration = read("supabase/migrations/20260826120000_pet_v2_failure_category_and_health.sql");
    expect(migration).toContain("pet_funnel_persistence_failure_count");
    expect(migration).toContain("'rpc_error'");
    expect(migration).toContain("'write_failed'");
    expect(migration).toContain("failure_category text");
    expect(migration).toContain("p_failure_category");
    // Historical semantic rows remain; they are excluded by category filter, not deleted.
    expect(migration).toMatch(/Does not delete or rewrite historical/i);
  });
});
