import { describe, expect, it } from "vitest";
import { clubEmailValidationMessage, isValidClubEmail, normalizeClubEmail } from "./email";
import {
  ChristmasClubSignupError,
  isMissingRelationStatus,
  isUniqueViolationStatus,
  validateChristmasClubSignupPayload,
} from "./signupContract";

describe("christmas club email validation", () => {
  it("accepts ordinary emails and normalizes case/space", () => {
    expect(normalizeClubEmail("  Ada@TheDigitalGifter.com ")).toBe("ada@thedigitalgifter.com");
    expect(isValidClubEmail("ada@thedigitalgifter.com")).toBe(true);
    expect(clubEmailValidationMessage("ada@thedigitalgifter.com")).toBeNull();
  });

  it("rejects empty and malformed emails", () => {
    expect(isValidClubEmail("")).toBe(false);
    expect(isValidClubEmail("not-an-email")).toBe(false);
    expect(isValidClubEmail("ada@")).toBe(false);
    expect(isValidClubEmail("ada@local")).toBe(false);
    expect(clubEmailValidationMessage("")).toBe("Please enter your email.");
    expect(clubEmailValidationMessage("nope")).toBe("Please enter a valid email.");
  });
});

describe("christmas club signup contract", () => {
  it("validates a guest email join", () => {
    const validated = validateChristmasClubSignupPayload({
      email: "Ada@TheDigitalGifter.com",
      signup_method: "email",
      source: "christmas_club_landing",
      campaign_year: 2026,
    });
    expect(validated.email).toBe("ada@thedigitalgifter.com");
    expect(validated.signupMethod).toBe("email");
    expect(validated.campaignYear).toBe(2026);
  });

  it("prefers the authenticated Google email over the client field", () => {
    const validated = validateChristmasClubSignupPayload(
      { email: "other@example.com", signup_method: "google" },
      { authenticatedEmail: "google.user@gmail.com" },
    );
    expect(validated.email).toBe("google.user@gmail.com");
    expect(validated.signupMethod).toBe("google");
  });

  it("requires a valid email when unauthenticated", () => {
    expect(() =>
      validateChristmasClubSignupPayload({ email: "nope", signup_method: "email" }),
    ).toThrow(ChristmasClubSignupError);
  });

  it("treats unique violations as duplicate joins", () => {
    expect(isUniqueViolationStatus(409, "")).toBe(true);
    expect(isUniqueViolationStatus(400, "duplicate key value violates unique constraint")).toBe(
      true,
    );
    expect(isUniqueViolationStatus(500, "server exploded")).toBe(false);
  });

  it("detects a missing signup table so we can fall back safely", () => {
    expect(
      isMissingRelationStatus(
        404,
        `{"code":"PGRST205","message":"Could not find the table 'public.christmas_club_signups' in the schema cache"}`,
      ),
    ).toBe(true);
    expect(isMissingRelationStatus(200, "[]")).toBe(false);
  });
});
