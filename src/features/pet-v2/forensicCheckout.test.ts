import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildV2SequentialCohort,
  mapV2CountsToPrimarySteps,
  maxSessionCount,
} from "../pet/funnelDatasetConfig";
import { classifyCheckoutBrowser } from "./paymentDiagnostics";
import { PET_V2_EVENTS } from "./types";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function readSrc(relative: string) {
  return readFileSync(resolve(root, relative), "utf8");
}

describe("V2 forensic analytics integrity", () => {
  it("maps teaser as max(teaser, preview) not JS ||", () => {
    expect(maxSessionCount(0, 9)).toBe(9);
    expect(maxSessionCount(24, 9)).toBe(24);
    const mapped = mapV2CountsToPrimarySteps({
      v2_landing_view: 151,
      v2_upload_completed: 51,
      v2_teaser_viewed: 0,
      v2_preview_viewed: 9,
      v2_offer_viewed: 24,
      v2_begin_checkout: 10,
      v2_checkout_session_created: 0,
      v2_purchase: 1,
    });
    expect(mapped.photo_upload_completed).toBe(9);
    expect(mapped.order_review_viewed).toBe(24);
    expect(mapped.initiate_checkout).toBe(10);
    expect(mapped.purchase).toBe(1);
  });

  it("prefers session_created over begin when both present (max)", () => {
    const mapped = mapV2CountsToPrimarySteps({
      v2_checkout_session_created: 34,
      v2_begin_checkout: 10,
    });
    expect(mapped.initiate_checkout).toBe(34);
  });

  it("builds true sequential human cohort requiring Payment UI visible", () => {
    const s1 = "11111111-1111-4111-8111-111111111111";
    const s2 = "22222222-2222-4222-8222-222222222222";
    const s3 = "33333333-3333-4333-8333-333333333333";
    const cohort = buildV2SequentialCohort({
      v2_landing_view: new Set([s1, s2, s3]),
      v2_upload_completed: new Set([s1, s2]),
      v2_teaser_viewed: new Set([s1]),
      v2_offer_viewed: new Set([s1, s2]), // s2 offer without teaser must not count sequentially
      v2_payment_ui_visible: new Set([s1]),
      v2_begin_checkout: new Set([s1]),
      v2_purchase: new Set([s1]),
    });
    expect(cohort.landing).toBe(3);
    expect(cohort.upload).toBe(2);
    expect(cohort.teaser).toBe(1);
    expect(cohort.offer).toBe(1);
    expect(cohort.payment_ui_visible).toBe(1);
    expect(cohort.payment_attempt).toBe(1);
    expect(cohort.purchase).toBe(1);
  });

  it("includes payment diagnostic event names in allow-lists", () => {
    expect(PET_V2_EVENTS).toContain("v2_payment_attempt_started");
    expect(PET_V2_EVENTS).toContain("v2_payment_ui_visible");
    expect(readSrc("api/_lib/petV2Events.ts")).toContain("v2_payment_failed");
    expect(readSrc("api/pet-v2/funnel-event.ts")).toContain("v2_payment_requires_action");
    expect(readSrc("supabase/migrations/20260903140000_pet_v2_forensic_observability.sql")).toContain(
      "pet_v2_funnel_events_name_chk",
    );
    expect(readSrc("supabase/migrations/20260903140000_pet_v2_forensic_observability.sql")).toContain(
      "v2_teaser_viewed",
    );
    expect(readSrc("supabase/migrations/20260903140000_pet_v2_forensic_observability.sql")).toContain(
      "admin_pet_v2_checkout_diagnostics",
    );
  });

  it("classifies Facebook/Instagram in-app browsers", () => {
    expect(
      classifyCheckoutBrowser(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS]",
      ).inAppBrowser,
    ).toBe("facebook_iab");
    expect(
      classifyCheckoutBrowser(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram",
      ).inAppBrowser,
    ).toBe("instagram_iab");
    expect(
      classifyCheckoutBrowser(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      ),
    ).toMatchObject({ browserFamily: "safari", inAppBrowser: null });
  });

  it("records V2 checkout session server-side and wires payment diagnostics UI", () => {
    expect(readSrc("supabase/functions/_shared/pet/v2FunnelEvents.ts")).toContain(
      "v2_checkout_session_created",
    );
    expect(readSrc("supabase/functions/pet-funnel/index.ts")).toContain("maybeRecordV2CheckoutSessionCreated");
    expect(readSrc("src/features/pet-v2/PetV2FunnelPage.tsx")).toContain("trackV2PaymentAttemptStarted");
    expect(readSrc("src/features/pet-v2/components/V2ElementsCheckout.tsx")).toContain("onPaymentAttempt");
    expect(readSrc("src/pages/admin/PetFunnelAnalyticsPage.tsx")).toContain("Human checkout funnel");
    expect(readSrc("src/pages/admin/PetFunnelAnalyticsPage.tsx")).toContain("Stripe infrastructure");
  });

  it("keeps purchase authority server/Stripe verified", () => {
    expect(readSrc("supabase/functions/_shared/pet/stripeFulfill.ts")).toContain("record_pet_v2_funnel_event");
    expect(readSrc("supabase/functions/_shared/pet/stripeFulfill.ts")).toContain("v2_purchase");
    expect(readSrc("src/features/pet/funnelHybrid.ts")).toContain('"stripe_verified"');
  });

  it("admin V2 labels separate Stripe sessions from Payment UI viewed", () => {
    expect(readSrc("src/features/pet/funnelDatasetConfig.ts")).toContain("Stripe checkout sessions created");
    expect(readSrc("src/features/pet/funnelDatasetConfig.ts")).toContain("Payment UI viewed");
    expect(readSrc("api/_lib/petV2.ts")).toContain("p_browser_family");
    expect(readSrc("supabase/migrations/20260903140000_pet_v2_forensic_observability.sql")).toContain(
      "p_browser_family",
    );
  });
});
