import { describe, expect, it } from "vitest";
import { activateGiftOnce, crossGiftBlocked, redeemOnce } from "./redemptionLogic";

describe("Send-a-Gift exactly-once activation + redemption", () => {
  const ents = [
    { serviceKey: "christmas_photo", quantityTotal: 1, quantityUsed: 0 },
    { serviceKey: "christmas_santa_video", quantityTotal: 1, quantityUsed: 0 },
  ];

  it("activates exactly once across retries", () => {
    const first = activateGiftOnce(null, ents);
    expect(first.created).toBe(true);
    const second = activateGiftOnce(first.gift, ents);
    expect(second.created).toBe(false);
    expect(second.gift.entitlements).toEqual(first.gift.entitlements);
  });

  it("redeems atomically and is idempotent on redemption_key replay", () => {
    let gift = activateGiftOnce(null, ents).gift;
    const r1 = redeemOnce(gift, "christmas_photo", "rk-1");
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    gift = r1.gift;
    expect(gift.entitlements.find((e) => e.serviceKey === "christmas_photo")?.quantityUsed).toBe(1);

    const replay = redeemOnce(gift, "christmas_photo", "rk-1");
    expect(replay.ok).toBe(true);
    if (!replay.ok) return;
    expect(replay.status).toBe("already_redeemed");
    expect(replay.gift.entitlements.find((e) => e.serviceKey === "christmas_photo")?.quantityUsed).toBe(1);
  });

  it("blocks double-spend after exhaustion", () => {
    let gift = activateGiftOnce(null, ents).gift;
    const r1 = redeemOnce(gift, "christmas_photo", "a");
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    gift = r1.gift;
    const r2 = redeemOnce(gift, "christmas_photo", "b");
    expect(r2).toEqual({ ok: false, reason: "entitlement_exhausted" });
  });

  it("blocks revoked gifts and cross-gift token mismatch", () => {
    const gift = { ...activateGiftOnce(null, ents).gift, status: "disabled" as const };
    expect(redeemOnce(gift, "christmas_photo", "x")).toEqual({
      ok: false,
      reason: "gift_disabled",
    });
    expect(crossGiftBlocked(gift, "hash-b", "hash-a")).toBe(true);
  });
});
