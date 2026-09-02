import { describe, expect, it } from "vitest";
import {
  classifyV3Traffic,
  hasReliablePaidMetaSignal,
  isValidMetaFbc,
} from "./v3TrafficClassification";

describe("V3 paid_meta classification", () => {
  it("direct visitor with only fbp is NOT paid_meta", () => {
    expect(
      classifyV3Traffic({
        fbp: "fb.1.1700000000000.1234567890",
      }),
    ).toBe("unattributed");
    expect(hasReliablePaidMetaSignal({ fbp: "fb.1.1700000000000.1234567890" })).toBe(false);
  });

  it("visitor with valid fbc (Meta click cookie) is paid_meta", () => {
    expect(
      classifyV3Traffic({
        fbc: "fb.1.1700000000000.AbCdEf",
      }),
    ).toBe("paid_meta");
    expect(isValidMetaFbc("fb.1.1700000000000.AbCdEf")).toBe(true);
  });

  it("visitor with fbclid flag is paid_meta", () => {
    expect(classifyV3Traffic({ hasMetaClick: true })).toBe("paid_meta");
  });

  it("Meta paid UTMs with campaign identifiers are paid_meta", () => {
    expect(
      classifyV3Traffic({
        utmSource: "facebook",
        utmMedium: "paid_social",
        utmCampaign: "cat-v3-launch",
        campaignId: "120253518796930170",
      }),
    ).toBe("paid_meta");
  });

  it("ordinary Facebook referral without paid evidence is external_other", () => {
    expect(
      classifyV3Traffic({
        utmSource: "facebook",
        referrerHost: "l.facebook.com",
      }),
    ).toBe("external_other");
    expect(
      classifyV3Traffic({
        referrerHost: "www.facebook.com",
      }),
    ).toBe("external_other");
  });

  it("fbp plus paid campaign_id is paid_meta via campaign signal (not fbp)", () => {
    expect(
      classifyV3Traffic({
        fbp: "fb.1.123.456",
        campaignId: "120253518796930170",
      }),
    ).toBe("paid_meta");
  });
});
