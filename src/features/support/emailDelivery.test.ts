import { describe, expect, it } from "vitest";
import {
  adminNotificationLabel,
  adminReplyToast,
  assertSafeSupportEmail,
  buildAdminReplyEmail,
  buildTicketReceivedEmail,
  confirmationCopy,
  customerNotified,
  decideSupportEmailAttempt,
  isResendConfigured,
  redactSupportEmailSecrets,
  statusAfterProviderResult,
  supportEmailContainsSecrets,
  supportFromAddress,
} from "./emailDelivery";

describe("support email delivery", () => {
  it("sends when Resend and from-address are configured and nothing was sent yet", () => {
    const env = {
      RESEND_API_KEY: "re_test",
      TRANSACTIONAL_EMAIL_FROM: "The Digital Gifter <support@thedigitalgifter.com>",
    };
    expect(isResendConfigured(env)).toBe(true);
    expect(supportFromAddress(env)).toContain("support@thedigitalgifter.com");
    expect(decideSupportEmailAttempt({ existingStatus: null, configured: true })).toEqual({
      action: "send",
      status: "queued",
      send: true,
    });
    expect(statusAfterProviderResult(true)).toBe("sent");
    expect(customerNotified("sent")).toBe(true);
    expect(adminNotificationLabel("sent")).toBe("Customer notified");
    expect(adminReplyToast("sent")).toBe("Reply saved and the customer was emailed.");
    expect(confirmationCopy("sent")).toContain("emailed a confirmation");
  });

  it("marks a provider failure as pending and never claims the customer was notified", () => {
    expect(decideSupportEmailAttempt({ existingStatus: "queued", configured: true }).send).toBe(true);
    expect(statusAfterProviderResult(false)).toBe("pending");
    expect(customerNotified("pending")).toBe(false);
    expect(adminNotificationLabel("pending")).toBe("Customer not notified");
    expect(adminReplyToast("failed")).toBe("Reply saved. Customer not notified.");
    expect(confirmationCopy("pending")).toBeNull();
  });

  it("skips a duplicate admin submit after a successful send", () => {
    expect(decideSupportEmailAttempt({ existingStatus: "sent", configured: true })).toEqual({
      action: "skip_already_sent",
      status: "sent",
      send: false,
    });
    expect(customerNotified("sent")).toBe(true);
  });

  it("does not send when Resend secrets are missing", () => {
    expect(isResendConfigured({})).toBe(false);
    expect(isResendConfigured({ RESEND_API_KEY: "re_test" })).toBe(false);
    expect(isResendConfigured({ PET_EMAIL_FROM: "Support <a@b.co>" })).toBe(false);
    expect(decideSupportEmailAttempt({ existingStatus: null, configured: false })).toEqual({
      action: "mark_pending_unconfigured",
      status: "pending",
      send: false,
      errorCode: "unconfigured",
    });
    expect(adminNotificationLabel("skipped")).toBe("Customer not notified");
  });

  it("puts the public reference in confirmation and reply emails without secrets or mailto", () => {
    const confirmation = buildTicketReceivedEmail({ reference: "tdg-7b2a6e" });
    expect(confirmation.subject).toContain("TDG-7B2A6E");
    expect(confirmation.text).toContain("TDG-7B2A6E");
    expect(confirmation.text).toContain("https://www.thedigitalgifter.com/support");
    expect(confirmation.html + confirmation.text).not.toMatch(/mailto:/i);

    const reply = buildAdminReplyEmail({
      reference: "TDG-7B2A6E",
      replyText:
        "We can help. Do not use token=secret-order-token or 11111111-2222-4333-8333-444444444444.",
    });
    expect(reply.text).toContain("TDG-7B2A6E");
    expect(reply.text).toContain("[redacted]");
    expect(reply.text).not.toContain("secret-order-token");
    expect(reply.text).not.toContain("11111111-2222-4333-8333-444444444444");
    expect(supportEmailContainsSecrets(reply.text)).toBe(false);
    expect(() => assertSafeSupportEmail(reply)).not.toThrow();
    expect(
      redactSupportEmailSecrets("guestToken=abc publicToken=zzz token=hidden"),
    ).toContain("[redacted]");
  });
});
