import { describe, expect, it } from "vitest";
import { PET_V3_SALE_CYCLE_MS, PET_V3_SALE_EPOCH_MS, v3FlashSale, v3SaleRemainingMs } from "./v3FlashSale";

describe("V3 rolling 24h sale", () => {
  it("always charges $12 with $27 compare-at", () => {
    const offer = v3FlashSale(PET_V3_SALE_EPOCH_MS + 1000);
    expect(offer.amountCents).toBe(1200);
    expect(offer.priceDisplay).toBe("$12");
    expect(offer.compareAtDisplay).toBe("$27");
    expect(offer.saleActive).toBe(true);
  });

  it("counts down within the current 24h window", () => {
    const start = PET_V3_SALE_EPOCH_MS + 1000;
    const mid = PET_V3_SALE_EPOCH_MS + PET_V3_SALE_CYCLE_MS / 2;
    expect(v3SaleRemainingMs(start)).toBe(PET_V3_SALE_CYCLE_MS - 1000);
    expect(v3SaleRemainingMs(mid)).toBe(PET_V3_SALE_CYCLE_MS / 2);
  });

  it("resets the timer at each 24h boundary while price stays $12", () => {
    const boundary = PET_V3_SALE_EPOCH_MS + PET_V3_SALE_CYCLE_MS;
    const after = boundary + 5000;
    expect(v3SaleRemainingMs(boundary)).toBe(PET_V3_SALE_CYCLE_MS);
    expect(v3SaleRemainingMs(after)).toBe(PET_V3_SALE_CYCLE_MS - 5000);

    const nextCycle = v3FlashSale(after);
    expect(nextCycle.amountCents).toBe(1200);
    expect(nextCycle.priceDisplay).toBe("$12");
    expect(Date.parse(nextCycle.expiresAt)).toBeGreaterThan(after);
  });
});
