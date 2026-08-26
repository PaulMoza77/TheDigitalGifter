import { describe, expect, it } from "vitest";
import { PET_V2_SALE_CYCLE_MS, PET_V2_SALE_EPOCH_MS, v2FlashSale, v2SaleRemainingMs } from "./v2FlashSale";

describe("V2 rolling 24h sale", () => {
  it("always charges $8 with $27 compare-at", () => {
    const offer = v2FlashSale(PET_V2_SALE_EPOCH_MS + 1000);
    expect(offer.amountCents).toBe(800);
    expect(offer.priceDisplay).toBe("$8");
    expect(offer.compareAtDisplay).toBe("$27");
    expect(offer.saleActive).toBe(true);
  });

  it("counts down within the current 24h window", () => {
    const start = PET_V2_SALE_EPOCH_MS + 1000;
    const mid = PET_V2_SALE_EPOCH_MS + PET_V2_SALE_CYCLE_MS / 2;
    expect(v2SaleRemainingMs(start)).toBe(PET_V2_SALE_CYCLE_MS - 1000);
    expect(v2SaleRemainingMs(mid)).toBe(PET_V2_SALE_CYCLE_MS / 2);
  });

  it("resets the timer at each 24h boundary while price stays $8", () => {
    const boundary = PET_V2_SALE_EPOCH_MS + PET_V2_SALE_CYCLE_MS;
    const after = boundary + 5000;
    expect(v2SaleRemainingMs(boundary)).toBe(PET_V2_SALE_CYCLE_MS);
    expect(v2SaleRemainingMs(after)).toBe(PET_V2_SALE_CYCLE_MS - 5000);

    const nextCycle = v2FlashSale(after);
    expect(nextCycle.amountCents).toBe(800);
    expect(nextCycle.priceDisplay).toBe("$8");
    expect(Date.parse(nextCycle.expiresAt)).toBeGreaterThan(after);
  });
});
