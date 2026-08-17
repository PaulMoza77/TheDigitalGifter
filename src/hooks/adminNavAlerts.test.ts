import { describe, expect, it } from "vitest";
import {
  formatAlertCount,
  isOpenSupportTicket,
  isOrdersPath,
  isPetOrdersPath,
  unseenSince,
} from "./adminNavAlerts";

describe("admin nav alerts", () => {
  it("treats open and needs_agent tickets as actionable", () => {
    expect(isOpenSupportTicket("open")).toBe(true);
    expect(isOpenSupportTicket("needs_agent")).toBe(true);
    expect(isOpenSupportTicket("ai_replied")).toBe(true);
    expect(isOpenSupportTicket("closed")).toBe(false);
    expect(isOpenSupportTicket("CLOSED")).toBe(false);
  });

  it("formats the red badge count", () => {
    expect(formatAlertCount(0)).toBeNull();
    expect(formatAlertCount(1)).toBe("1");
    expect(formatAlertCount(12)).toBe("12");
    expect(formatAlertCount(100)).toBe("99+");
  });

  it("falls back to the last 7 days when nothing was seen yet", () => {
    const now = Date.parse("2026-08-17T19:00:00.000Z");
    expect(unseenSince(null, now)).toBe("2026-08-10T19:00:00.000Z");
    expect(unseenSince("2026-08-17T12:00:00.000Z", now)).toBe(
      "2026-08-17T12:00:00.000Z"
    );
  });

  it("does not treat pet-orders as the credits orders page", () => {
    expect(isOrdersPath("/admin/orders")).toBe(true);
    expect(isOrdersPath("/admin/pet-orders")).toBe(false);
    expect(isPetOrdersPath("/admin/pet-orders")).toBe(true);
  });
});
