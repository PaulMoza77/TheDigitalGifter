import { describe, expect, it, vi } from "vitest";
import { resolveExpressCheckoutClick } from "./expressCheckoutConfirm";

describe("resolveExpressCheckoutClick", () => {
  it("marks interaction then resolve() so Apple Pay can open", () => {
    const resolve = vi.fn();
    const onInteraction = vi.fn();
    resolveExpressCheckoutClick({ resolve } as never, onInteraction);
    expect(onInteraction).toHaveBeenCalledTimes(1);
    expect(resolve).toHaveBeenCalledTimes(1);
    expect(onInteraction.mock.invocationCallOrder[0]).toBeLessThan(resolve.mock.invocationCallOrder[0]);
  });
});
