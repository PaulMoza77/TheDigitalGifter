import { describe, expect, it } from "vitest";
import { isSendAGiftEmailRecipientAllowed } from "./emailSafety";

describe("Send-a-Gift email QA safety", () => {
  it("fails closed with empty allowlist", () => {
    expect(isSendAGiftEmailRecipientAllowed("user@gmail.com", "")).toBe(false);
    expect(isSendAGiftEmailRecipientAllowed("user@gmail.com", null)).toBe(false);
  });

  it("allows exact and domain entries only", () => {
    expect(isSendAGiftEmailRecipientAllowed("qa@thedigitalgifter.com", "thedigitalgifter.com")).toBe(
      true,
    );
    expect(
      isSendAGiftEmailRecipientAllowed("paul+qa@example.com", "paul+qa@example.com"),
    ).toBe(true);
    expect(isSendAGiftEmailRecipientAllowed("customer@gmail.com", "thedigitalgifter.com")).toBe(
      false,
    );
  });
});
