import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PET_V2_EVENT_NAMES } from "../../../api/_lib/petV2Events";

describe("pet_v2_funnel_events name_chk migration", () => {
  it("expands CHECK to every ingest event name (prevents checkout write_failed 500s)", () => {
    const sql = readFileSync(
      resolve("supabase/migrations/20260902120000_pet_v2_funnel_events_name_chk.sql"),
      "utf8",
    );
    expect(sql).toContain("drop constraint if exists pet_v2_funnel_events_name_chk");
    expect(sql).toContain("add constraint pet_v2_funnel_events_name_chk");
    for (const name of PET_V2_EVENT_NAMES) {
      expect(sql).toContain(`'${name}'`);
    }
    // Explicit checkout telemetry that was failing live with 23514
    for (const critical of [
      "v2_checkout_session_requested",
      "v2_checkout_session_created",
      "v2_checkout_failed",
      "v2_checkout_canceled",
    ]) {
      expect(sql).toContain(`'${critical}'`);
    }
  });

  it("keeps Express Checkout on auto so dead Apple Pay buttons stay hidden", () => {
    const options = readFileSync(resolve("src/features/pet/expressCheckoutOptions.ts"), "utf8");
    expect(options).toContain('applePay: "auto"');
    expect(options).not.toMatch(/applePay:\s*"always"/);
    const v2 = readFileSync(resolve("src/features/pet-v2/components/V2ElementsCheckout.tsx"), "utf8");
    expect(v2).toContain("PET_EXPRESS_CHECKOUT_OPTIONS");
    expect(v2).toContain("[express-checkout-ready]");
    expect(v2).not.toMatch(/applePay:\s*"always"/);
  });
});
