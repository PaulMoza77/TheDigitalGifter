import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { shouldTrackPetBeginCheckout, shouldTrackPetPurchase } from "./funnelAnalytics";
import { attributionParamsForInternal, captureFunnelAttribution } from "./funnelAttribution";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function readSrc(relative: string) {
  return readFileSync(resolve(root, relative), "utf8");
}

describe("pet funnel admin analytics wiring", () => {
  it("landing, name, upload, and review are browser-tracked with existing once-keys", () => {
    const analytics = readSrc("src/features/pet/funnelAnalytics.ts");
    expect(analytics).toContain('eventName: "landing_view"');
    expect(analytics).toContain("pet_name_submitted");
    expect(analytics).toContain("photo_upload_completed");
    expect(analytics).toContain("order_review_viewed");
    const landing = readSrc("src/features/pet/PetLandingPage.tsx");
    expect(landing).toContain("trackFunnelViewItem");
    expect(landing).toContain("PetNameSubmitted");
    const create = readSrc("src/features/pet/PetCreatePage.tsx");
    expect(create).toContain("PhotoUploadCompleted");
    expect(create).toMatch(/setPhotoFromFile[\s\S]*PhotoUploadCompleted/);
    const checkout = readSrc("src/features/pet/PetCheckoutPage.tsx");
    expect(checkout).toContain("PetOrderReviewViewed");
  });

  it("initiate checkout is recorded only after a real Stripe session on the server", () => {
    expect(
      shouldTrackPetBeginCheckout({
        status: "open",
        sessionId: "cs_test",
        checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test",
      }),
    ).toBe(true);
    expect(
      shouldTrackPetBeginCheckout({
        status: "open",
        sessionId: "cs_test",
        checkoutUrl: "/pet/checkout",
      }),
    ).toBe(false);
    const funnel = readSrc("supabase/functions/pet-funnel/index.ts");
    expect(funnel).toContain("recordPetFunnelInitiateCheckout");
    expect(funnel).toContain("matchedOpenCheckoutResponse");
    expect(readSrc("supabase/functions/_shared/pet/funnelEvents.ts")).toContain(
      "order:${input.orderId}:initiate_checkout",
    );
  });

  it("purchase is recorded only after verified payment and is idempotent", () => {
    expect(shouldTrackPetPurchase({ paidAt: null, amountCents: 2700 })).toBe(false);
    expect(shouldTrackPetPurchase({ paidAt: "2026-08-21T00:00:00.000Z", amountCents: 2700 })).toBe(true);
    const fulfill = readSrc("supabase/functions/_shared/pet/stripeFulfill.ts");
    expect(fulfill).toContain("recordPetFunnelPurchase");
    expect(fulfill).toContain('result?.status === "fulfilled" || result?.status === "already_paid"');
    expect(readSrc("supabase/functions/_shared/pet/funnelEvents.ts")).toContain(
      "order:${input.orderId}:purchase",
    );
    expect(readSrc("supabase/migrations/20260821120000_pet_funnel_analytics.sql")).toContain(
      "on conflict (idempotency_key) do nothing",
    );
  });

  it("keeps first-touch attribution without persisting fbclid", () => {
    const session = new Map<string, string>();
    const local = new Map<string, string>();
    const storage = (map: Map<string, string>) => ({
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => map.set(key, value),
      removeItem: (key: string) => map.delete(key),
    });
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        sessionStorage: storage(session),
        localStorage: storage(local),
        location: { search: "?utm_source=facebook&campaign_id=99&fbclid=abc" },
      },
    });
    captureFunnelAttribution();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        sessionStorage: storage(session),
        localStorage: storage(local),
        location: { search: "" },
      },
    });
    const internal = attributionParamsForInternal();
    expect(internal.utm_source).toBe("facebook");
    expect(internal.campaign_id).toBe("99");
    expect(internal).not.toHaveProperty("fbclid");
    expect(readSrc("supabase/migrations/20260821120000_pet_funnel_analytics.sql")).not.toContain("fbclid");
  });

  it("aggregates unique sessions server-side and requires admin to read", () => {
    const sql = readSrc("supabase/migrations/20260821120000_pet_funnel_analytics.sql");
    expect(sql).toContain("count(distinct funnel_session_id)");
    expect(sql).toContain("if not public.is_admin()");
    expect(sql).toContain("create policy pet_funnel_events_admin_read");
    expect(sql).toContain("revoke all on table public.pet_funnel_events from anon");
    expect(sql).toContain("grant execute on function public.admin_pet_funnel_analytics");
    expect(sql).toContain("to authenticated, service_role");
    expect(sql).not.toMatch(/grant execute on function public.admin_pet_funnel_analytics[\s\S]*to anon/);
    expect(readSrc("src/App.tsx")).toContain("pet-funnel-analytics");
    expect(readSrc("src/App.tsx")).toMatch(/<AdminRoute>[\s\S]*pet-funnel-analytics/);
    expect(readSrc("src/layouts/AdminLayout.tsx")).toContain("/admin/pet-funnel-analytics");
    expect(readSrc("src/pages/admin/PetFunnelAnalyticsPage.tsx")).toContain("Spend / CPA / ROAS");
    expect(readSrc("src/hooks/usePetFunnelAnalytics.ts")).toContain('supabase.rpc("admin_pet_funnel_analytics"');
  });
});
