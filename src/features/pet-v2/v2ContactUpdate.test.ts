import { describe, expect, it, vi } from "vitest";
import { PetApiError, type PetFunnelApi } from "../pet/api";
import { validateAndUpdateV2OrderContact } from "./v2ContactUpdate";

function mockApi(updateImpl: PetFunnelApi["updateOrderContact"]): PetFunnelApi {
  return {
    updateOrderContact: updateImpl,
  } as unknown as PetFunnelApi;
}

describe("validateAndUpdateV2OrderContact", () => {
  it("skips network when both optional fields are empty", async () => {
    const updateOrderContact = vi.fn();
    const result = await validateAndUpdateV2OrderContact({
      api: mockApi(updateOrderContact),
      orderId: "ord_1",
      publicToken: "tok_1",
      species: "dog",
      funnelSessionId: "sess123456789",
    });
    expect(result.ok).toBe(true);
    expect(updateOrderContact).not.toHaveBeenCalled();
  });

  it("saves pet name alone using bootstrap placeholder email (Apple Pay path)", async () => {
    const updateOrderContact = vi.fn().mockResolvedValue({
      orderId: "ord_1",
      email: "pending+sess12345678@checkout.thedigitalgifter.com",
      petName: "akira",
      updated: true,
      stripeSessionSynced: false,
    });
    const result = await validateAndUpdateV2OrderContact({
      api: mockApi(updateOrderContact),
      orderId: "ord_1",
      publicToken: "tok_1",
      petName: "akira",
      species: "dog",
      funnelSessionId: "sess123456789",
    });
    expect(result).toEqual({
      ok: true,
      petName: "akira",
      email: "pending+sess12345678@checkout.thedigitalgifter.com",
      stripeSessionSynced: false,
    });
    expect(updateOrderContact).toHaveBeenCalledWith({
      orderId: "ord_1",
      publicToken: "tok_1",
      petName: "akira",
      email: expect.stringMatching(/^pending\+[a-z0-9]+@checkout\.thedigitalgifter\.com$/i),
    });
  });

  it("surfaces a clear email error when the API rejects the address", async () => {
    const updateOrderContact = vi.fn().mockRejectedValue(
      new PetApiError("INVALID_REQUEST", "A valid email is required.", 400),
    );
    const result = await validateAndUpdateV2OrderContact({
      api: mockApi(updateOrderContact),
      orderId: "ord_1",
      publicToken: "tok_1",
      petName: "akira",
      email: "not-an-email",
      species: "dog",
      funnelSessionId: "sess123456789",
    });
    // Client-side regex catches invalid email before the API call.
    expect(result).toEqual({
      ok: false,
      error: "Enter a valid email address.",
      focusId: "v2-email",
    });
    expect(updateOrderContact).not.toHaveBeenCalled();
  });

  it("maps API email rejection to a field-focused message", async () => {
    const updateOrderContact = vi.fn().mockRejectedValue(
      new PetApiError("INVALID_REQUEST", "A valid email is required.", 400),
    );
    const result = await validateAndUpdateV2OrderContact({
      api: mockApi(updateOrderContact),
      orderId: "ord_1",
      publicToken: "tok_1",
      petName: "akira",
      email: "real@example.com",
      species: "dog",
      funnelSessionId: "sess123456789",
    });
    expect(result).toEqual({
      ok: false,
      error: "Enter a valid email address.",
      focusId: "v2-email",
    });
  });
});
