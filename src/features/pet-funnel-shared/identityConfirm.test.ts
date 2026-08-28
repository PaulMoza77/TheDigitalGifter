import { describe, expect, it } from "vitest";
import {
  canUnlockWithIdentityConfirm,
  identityConfirmLabel,
  identityConfirmRequiredError,
} from "./identityConfirm";

describe("identityConfirm", () => {
  it("blocks unlock until the customer affirms likeness", () => {
    expect(canUnlockWithIdentityConfirm({ confirmed: false, kind: "dog" })).toEqual({
      ok: false,
      message: identityConfirmRequiredError("dog"),
    });
    expect(canUnlockWithIdentityConfirm({ confirmed: true, kind: "dog" })).toEqual({ ok: true });
  });

  it("uses species-aware wording", () => {
    expect(identityConfirmLabel("dog")).toMatch(/my dog/i);
    expect(identityConfirmLabel("cat")).toMatch(/my cat/i);
    expect(identityConfirmLabel("pet")).toMatch(/my pet/i);
  });
});
