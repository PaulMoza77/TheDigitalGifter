import { afterEach, describe, expect, it } from "vitest";
import {
  lifecycleMarketingEnabled,
  lifecycleSendEnabled,
} from "../../../../api/_lib/christmas/lifecycle";

describe("christmas lifecycle send flags", () => {
  const previousSend = process.env.CHRISTMAS_LIFECYCLE_SEND_ENABLED;
  const previousMarketing = process.env.CHRISTMAS_LIFECYCLE_MARKETING_ENABLED;

  afterEach(() => {
    if (previousSend == null) delete process.env.CHRISTMAS_LIFECYCLE_SEND_ENABLED;
    else process.env.CHRISTMAS_LIFECYCLE_SEND_ENABLED = previousSend;
    if (previousMarketing == null) delete process.env.CHRISTMAS_LIFECYCLE_MARKETING_ENABLED;
    else process.env.CHRISTMAS_LIFECYCLE_MARKETING_ENABLED = previousMarketing;
  });

  it("defaults send and marketing journeys OFF", () => {
    delete process.env.CHRISTMAS_LIFECYCLE_SEND_ENABLED;
    delete process.env.CHRISTMAS_LIFECYCLE_MARKETING_ENABLED;
    expect(lifecycleSendEnabled()).toBe(false);
    expect(lifecycleMarketingEnabled()).toBe(false);
  });

  it("enables only when explicitly true", () => {
    process.env.CHRISTMAS_LIFECYCLE_SEND_ENABLED = "true";
    process.env.CHRISTMAS_LIFECYCLE_MARKETING_ENABLED = "true";
    expect(lifecycleSendEnabled()).toBe(true);
    expect(lifecycleMarketingEnabled()).toBe(true);
  });
});
