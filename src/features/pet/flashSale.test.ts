import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PET_SALE_EXPIRES_AT_ISO,
  PET_SALE_EXPIRES_AT_MS,
  PET_SALE_PRICE_CENTS,
  PET_V2_SALE_EXPIRES_AT_ISO,
  applyPetFlashSaleAmount,
  checkoutAmountNeedsRefresh,
  formatSaleCountdown,
  petFlashSale,
} from "./flashSale";
import { PET_PRICE_CENTS } from "./types";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function readSrc(relative: string) {
  return readFileSync(resolve(root, relative), "utf8");
}

describe("pet $17 flash sale", () => {
  it("charges $17 until the real 24-hour expiry, then returns to $27", () => {
    const during = petFlashSale(PET_SALE_EXPIRES_AT_MS - 23 * 60 * 60 * 1000);
    expect(during.active).toBe(true);
    expect(during.amountCents).toBe(PET_SALE_PRICE_CENTS);
    expect(during.priceDisplay).toBe("$17");
    expect(during.compareAtDisplay).toBe("$27");
    expect(during.expiresAt).toBe(PET_SALE_EXPIRES_AT_ISO);
    expect(applyPetFlashSaleAmount(PET_PRICE_CENTS, PET_SALE_EXPIRES_AT_MS - 1)).toBe(1700);

    const after = petFlashSale(PET_SALE_EXPIRES_AT_MS);
    expect(after.active).toBe(false);
    expect(after.amountCents).toBe(PET_PRICE_CENTS);
    expect(after.priceDisplay).toBe("$27");
    expect(after.expiresAt).toBeNull();
    expect(applyPetFlashSaleAmount(PET_PRICE_CENTS, PET_SALE_EXPIRES_AT_MS + 1000)).toBe(2700);
  });

  it("formats a live HH:MM:SS countdown that ticks down to the shared expiry", () => {
    expect(formatSaleCountdown(23 * 60 * 60 * 1000 + 14 * 60 * 1000 + 7 * 1000)).toBe("23:14:07");
    expect(formatSaleCountdown(90 * 60 * 1000)).toBe("01:30:00");
    expect(formatSaleCountdown(45 * 1000)).toBe("00:00:45");
    expect(formatSaleCountdown(0)).toBe("");
  });

  it("refreshes unpaid checkout after the sale expires so Stripe cannot keep $17", () => {
    expect(checkoutAmountNeedsRefresh(1700, 2700)).toBe(true);
    expect(checkoutAmountNeedsRefresh(1700, 1700)).toBe(false);
  });

  it("keeps $27 as the list price and overlays $17 on the live dog funnel", () => {
    expect(PET_PRICE_CENTS).toBe(2700);
    expect(PET_SALE_PRICE_CENTS).toBe(1700);
    expect(PET_SALE_EXPIRES_AT_ISO).toBe("2026-08-25T17:30:00.000Z");
    expect(PET_V2_SALE_EXPIRES_AT_ISO).toBe("2026-08-26T18:35:00.000Z");
    expect(readSrc("src/features/pet/types.ts")).toContain("PET_PRICE_CENTS = 2700");
    expect(readSrc("supabase/functions/_shared/pet/constants.ts")).toContain("PET_PRICE_CENTS = 2700");
    expect(readSrc("src/features/pet/PetLandingPage.tsx")).toContain("SaleBanner");
    expect(readSrc("supabase/functions/pet-funnel/index.ts")).toContain("applyPetFlashSaleAmount");
    expect(readSrc("supabase/functions/pet-funnel/index.ts")).toContain("checkoutAmountNeedsRefresh");
    expect(readSrc("supabase/functions/_shared/pet/flashSale.ts")).toContain("PET_SALE_PRICE_CENTS = 1700");
    expect(readSrc("supabase/functions/_shared/pet/flashSale.ts")).toContain(PET_SALE_EXPIRES_AT_ISO);
    expect(readSrc("supabase/functions/_shared/pet/flashSale.ts")).toContain(PET_V2_SALE_EXPIRES_AT_ISO);
    expect(readSrc("supabase/functions/_shared/pet/flashSale.ts")).toContain("applyV2SaleAmount");
    expect(readSrc("supabase/functions/_shared/pet/flashSale.ts")).toContain("PET_V2_SALE_EXPIRES_AT_MS");
    expect(readSrc("src/features/pet-v2/V2PackOffer.tsx")).not.toContain("petFlashSale");
    expect(readSrc("src/features/pet-v2/V2PackOffer.tsx")).toContain("PET_V2_SALE_EXPIRES_AT");
  });
});
