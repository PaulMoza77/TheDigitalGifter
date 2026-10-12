import { describe, expect, it } from "vitest";
import { withTimeout } from "./withTimeout";

describe("withTimeout", () => {
  it("resolves when the promise wins", async () => {
    await expect(withTimeout(Promise.resolve("ok"), 50, "fast")).resolves.toBe("ok");
  });

  it("rejects when the timeout wins", async () => {
    await expect(
      withTimeout(new Promise<string>(() => undefined), 20, "slow"),
    ).rejects.toThrow(/slow timed out after 20ms/);
  });
});
