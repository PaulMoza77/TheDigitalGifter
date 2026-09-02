import { describe, expect, it } from "vitest";
import {
  assertTokenizedPetOrderReturnUrl,
  buildPetOrderReturnUrl,
  isTokenlessPetOrderReturnUrl,
  PET_ORDER_RETURN_SESSION_PLACEHOLDER,
} from "./orderReturnUrl";

describe("orderReturnUrl", () => {
  it("URL-encodes the order token and includes CHECKOUT_SESSION_ID placeholder", () => {
    const url = buildPetOrderReturnUrl("a+b/c=", "https://www.thedigitalgifter.com");
    expect(url).toContain("token=a%2Bb%2Fc%3D");
    expect(url).toContain(`session_id=${PET_ORDER_RETURN_SESSION_PLACEHOLDER}`);
  });

  it("rejects tokenless confirm return URLs", () => {
    expect(() => assertTokenizedPetOrderReturnUrl("https://www.thedigitalgifter.com/pet/order")).toThrow(
      /order token/,
    );
    expect(isTokenlessPetOrderReturnUrl("/pet/order")).toBe(true);
    expect(
      assertTokenizedPetOrderReturnUrl(
        buildPetOrderReturnUrl("tok_live_example", "https://www.thedigitalgifter.com"),
      ),
    ).toContain("token=tok_live_example");
  });
});
