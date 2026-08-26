import { describe, expect, it } from "vitest";
import {
  classifyAnalyticsIngestFailure,
  isPetV2PersistenceFailureCategory,
  isPetV2RejectedRequestCategory,
  latestProductionEventAt,
  PET_V2_PERSISTENCE_FAILURE_CATEGORIES,
  PET_V2_REJECTED_REQUEST_CATEGORIES,
  resolvePersistedFailureCategory,
  shouldIncrementFailedWriteHealth,
  shouldIncrementRejectedRequestHealth,
} from "./failureCategory";

describe("V2 analytics health gating (behavioral)", () => {
  it("successfully persisted generation-failure telemetry does not increment failed-write health", () => {
    expect(
      shouldIncrementFailedWriteHealth({
        writeSucceeded: true,
        errorCategory: "rate_limit",
      }),
    ).toBe(false);
    expect(classifyAnalyticsIngestFailure("rate_limit")).toBe("ignored");
  });

  it("RPC/write failure does increment failed-write health", () => {
    for (const category of PET_V2_PERSISTENCE_FAILURE_CATEGORIES) {
      expect(isPetV2PersistenceFailureCategory(category)).toBe(true);
      expect(
        shouldIncrementFailedWriteHealth({ writeSucceeded: false, errorCategory: category }),
      ).toBe(true);
    }
  });

  it("malformed/denied requests are rejected separately and do not count as failed writes", () => {
    for (const category of PET_V2_REJECTED_REQUEST_CATEGORIES) {
      expect(isPetV2RejectedRequestCategory(category)).toBe(true);
      expect(
        shouldIncrementFailedWriteHealth({ writeSucceeded: false, errorCategory: category }),
      ).toBe(false);
      expect(
        shouldIncrementRejectedRequestHealth({ writeSucceeded: false, errorCategory: category }),
      ).toBe(true);
      expect(classifyAnalyticsIngestFailure(category)).toBe("rejected");
    }
  });

  it("test events do not refresh production latest-event health", () => {
    expect(
      latestProductionEventAt([
        { created_at: "2026-08-26T10:00:00.000Z", is_test: false },
        { created_at: "2026-08-26T12:00:00.000Z", is_test: true },
        { created_at: "2026-08-26T11:00:00.000Z", is_test: false },
      ]),
    ).toBe("2026-08-26T11:00:00.000Z");
  });

  it("upload failure stores only an allowlisted category", () => {
    expect(
      resolvePersistedFailureCategory({
        eventName: "v2_upload_failed",
        rawCategory: "heic_unsupported",
      }),
    ).toBe("heic_unsupported");
    expect(
      resolvePersistedFailureCategory({
        eventName: "v2_upload_failed",
        rawCategory: "invalid_photo",
      }),
    ).toBe("validation");
    expect(
      resolvePersistedFailureCategory({
        eventName: "v2_upload_failed",
        rawCategory: "SECRET_KEY=abc user@example.com <script>",
      }),
    ).toBe("unknown");
    expect(
      resolvePersistedFailureCategory({
        eventName: "v2_landing_view",
        rawCategory: "validation",
      }),
    ).toBeNull();
    expect(
      resolvePersistedFailureCategory({
        eventName: "v2_preview_generation_failed",
        rawCategory: "rate_limit",
      }),
    ).toBe("rate_limit");
  });
});
