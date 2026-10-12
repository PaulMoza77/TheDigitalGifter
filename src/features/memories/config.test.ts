import { describe, expect, it } from "vitest";
import {
  MEMORIES_EVENTS,
  MEMORIES_PLANS,
  MEMORIES_ROUTE,
  MEMORIES_CREATE_ROUTE,
  MEMORIES_PLANS_ROUTE,
  MEMORIES_SUCCESS_ROUTE,
} from "./config";
import { emptyMemoriesDraft } from "./types";
import { validateMemoriesPhotoFile } from "./photo";
import { isMemoriesEventName } from "./analytics";

describe("Memories V1 config", () => {
  it("keeps centralized monthly prices", () => {
    expect(MEMORIES_PLANS.starter.amountCents).toBe(900);
    expect(MEMORIES_PLANS.plus.amountCents).toBe(1900);
    expect(MEMORIES_PLANS.legacy.amountCents).toBe(4900);
    expect(MEMORIES_PLANS.plus.badge).toBe("Most Popular");
  });

  it("exposes funnel routes", () => {
    expect(MEMORIES_ROUTE).toBe("/memories");
    expect(MEMORIES_CREATE_ROUTE).toBe("/memories/create");
    expect(MEMORIES_PLANS_ROUTE).toBe("/memories/plans");
    expect(MEMORIES_SUCCESS_ROUTE).toBe("/memories/success");
  });

  it("lists required analytics events", () => {
    for (const name of [
      "memories_page_view",
      "memories_hero_cta",
      "memories_upload_started",
      "memories_upload_completed",
      "memories_email_submitted",
      "memories_plan_viewed",
      "memories_plan_selected",
      "memories_checkout_started",
      "memories_checkout_completed",
      "memories_payment_verified",
      "memories_subscription_cancelled",
    ] as const) {
      expect(MEMORIES_EVENTS).toContain(name);
      expect(isMemoriesEventName(name)).toBe(true);
    }
  });

  it("starts with an empty draft for session persistence", () => {
    const draft = emptyMemoriesDraft();
    expect(draft.step).toBe("landing");
    expect(draft.uploads).toEqual([]);
    expect(draft.marketingOptIn).toBe(false);
  });

  it("validates upload types and sizes", () => {
    const ok = validateMemoriesPhotoFile(
      new File([new Uint8Array([1, 2, 3])], "a.jpg", { type: "image/jpeg" }),
    );
    expect(ok.ok).toBe(true);
    const bad = validateMemoriesPhotoFile(
      new File([new Uint8Array([1])], "a.gif", { type: "image/gif" }),
    );
    expect(bad.ok).toBe(false);
  });
});
