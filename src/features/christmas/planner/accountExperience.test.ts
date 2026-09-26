import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  isPlannerBonusQaBlocked,
  plannerBonusGrantNote,
  plannerBonusRevokeNote,
  PLANNER_BONUS_EVENT_TYPE,
  PLANNER_PURCHASE_BONUS_CREDITS,
  refundBonusDebitAmount,
  resolvePostAuthPath,
} from "./bonusCredits";
import { isSafeAuthReturnPath } from "@/lib/auth/returnTo";
import { PLANNER_FAQS } from "./copy";
import { plannerCheckoutReturnPath } from "./commerce";

function readSrc(rel: string) {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

describe("Christmas Planner account, auth, and bonus credits", () => {
  it("sends logged-out CTA through auth then checkout", () => {
    const page = readSrc("src/features/christmas/planner/ChristmasPlannerPage.tsx");
    const checkout = readSrc("supabase/functions/christmas-checkout/index.ts");
    expect(page).toContain("if (!user)");
    expect(page).toContain("`/login?next=${encodeURIComponent(PLANNER_PUBLIC_ROUTE)}`");
    expect(page).toContain("rememberPurchaseIntent()");
    expect(page).toContain("startPlannerCheckout");
    expect(checkout).toContain("plannerFlow && !authUser?.id");
    expect(checkout).toContain('code: "auth_required"');
    expect(checkout).toContain("metadata[user_id]");
  });

  it("rejects unsafe return routes after login", () => {
    expect(isSafeAuthReturnPath("/christmas/planner")).toBe(true);
    expect(isSafeAuthReturnPath("/account/christmas/food")).toBe(true);
    expect(isSafeAuthReturnPath("/account/christmas/welcome")).toBe(true);
    expect(isSafeAuthReturnPath("https://evil.example/phish")).toBe(false);
    expect(isSafeAuthReturnPath("//evil.com")).toBe(false);
    expect(resolvePostAuthPath({ entitled: true, returnTo: "/christmas/planner", checkoutIntent: false })).toBe(
      "/account/christmas",
    );
    expect(resolvePostAuthPath({ entitled: false, returnTo: "/christmas/planner", checkoutIntent: true })).toBe(
      "/christmas/planner",
    );
    expect(plannerCheckoutReturnPath("https://evil.test/account")).toBe("/account/christmas/welcome");
  });

  it("grants entitlement and 300 credits only from verified webhook fulfillment", () => {
    const fulfill = readSrc("supabase/functions/_shared/christmas/stripeFulfill.ts");
    const sql = readSrc("supabase/migrations/20260922120000_christmas_planner_purchase_bonus.sql");
    const welcome = readSrc("src/pages/account/AccountChristmasWelcomePage.tsx");
    expect(fulfill).toContain("fulfill_christmas_order_payment");
    expect(fulfill).toContain("grant_christmas_planner_entitlements");
    expect(fulfill).toContain("grant_christmas_planner_purchase_bonus");
    expect(sql).toContain("'credits', 300");
    expect(sql).toContain(PLANNER_BONUS_EVENT_TYPE);
    expect(plannerBonusGrantNote("order-1")).toBe("christmas_planner_purchase_bonus:order-1");
    expect(PLANNER_PURCHASE_BONUS_CREDITS).toBe(300);
    expect(welcome).toContain("We’re confirming your payment");
    expect(welcome).not.toContain("query.get(\"credits\")");
  });

  it("keeps duplicate webhook grants idempotent", () => {
    const sql = readSrc("supabase/migrations/20260922120000_christmas_planner_purchase_bonus.sql");
    expect(sql).toContain("already_granted");
    expect(sql).toContain("if exists (select 1 from public.credits_ledger cl where cl.note = note_text)");
    expect(sql).toContain("credits_ledger_planner_bonus_note_uidx");
    expect(plannerBonusRevokeNote("abc")).toBe("christmas_planner_purchase_bonus_revoke:abc");
  });

  it("shows processing on the success page before webhook confirmation", () => {
    const welcome = readSrc("src/pages/account/AccountChristmasWelcomePage.tsx");
    const app = readSrc("src/App.tsx");
    expect(app).toContain('path="/account/christmas/welcome"');
    expect(welcome).toContain('data-testid="planner-welcome"');
    expect(welcome).toContain("fetchPlannerAccess");
    expect(welcome).toContain("Your Christmas Planner is ready.");
    expect(welcome).toContain("if (entitled && granted)");
  });

  it("routes entitled users to My Planner and free users to upgrade", () => {
    const page = readSrc("src/features/christmas/planner/ChristmasPlannerPage.tsx");
    expect(page).toContain("My Planner");
    expect(page).toContain("Get my Planner");
    expect(page).toContain("My Account");
    expect(resolvePostAuthPath({ entitled: true, returnTo: "/account", checkoutIntent: false })).toBe(
      "/account/christmas",
    );
    expect(resolvePostAuthPath({ entitled: false, returnTo: "/account", checkoutIntent: false })).toBe("/account");
  });

  it("revokes bonus credits on refund without going negative", () => {
    const sql = readSrc("supabase/migrations/20260922120000_christmas_planner_purchase_bonus.sql");
    const fulfill = readSrc("supabase/functions/_shared/christmas/stripeFulfill.ts");
    expect(sql).toContain("revoke_christmas_planner_purchase_bonus");
    expect(sql).toContain("debit := least(granted, greatest(0, bal))");
    expect(fulfill).toContain("charge.dispute.created");
    expect(refundBonusDebitAmount(50, 300)).toBe(50);
    expect(refundBonusDebitAmount(400, 300)).toBe(300);
    expect(refundBonusDebitAmount(-12, 300)).toBe(0);
    expect(isPlannerBonusQaBlocked({ accessSource: "qa_grant" })).toBe(true);
    expect(isPlannerBonusQaBlocked({ metadata: { qa: true } })).toBe(true);
    expect(sql).toContain("qa_access");
    expect(readSrc("supabase/migrations/20260921193000_christmas_planner_qa_access.sql")).not.toContain(
      "grant_christmas_planner_purchase_bonus",
    );
  });

  it("keeps owner-only RLS on orders, entitlements, ledger, and creations", () => {
    const least = readSrc("supabase/migrations/20260816133000_security_least_privilege.sql");
    const commerce = readSrc("supabase/migrations/20260902120000_christmas_commerce_foundation.sql");
    const entitlements = readSrc("supabase/migrations/20260917140000_christmas_planner_funnel.sql");
    expect(least).toContain("credits_own_read");
    expect(least).toContain("is_own_credit_row");
    expect(least).toContain("orders_own_read");
    expect(commerce).toContain("christmas_orders_own_read");
    expect(commerce).toContain("auth.uid() = user_id");
    expect(entitlements).toContain("user_entitlements");
    expect(entitlements).toContain("grant select on table public.user_entitlements to authenticated");
  });

  it("updates landing and FAQ copy for the 300 bonus credits", () => {
    const page = readSrc("src/features/christmas/planner/ChristmasPlannerPage.tsx");
    expect(page).toContain("Christmas Planner 2026 + 300 bonus AI credits");
    expect(page).toContain("300 bonus credits for AI images and videos");
    expect(page).toContain("Use your bonus credits in The Digital Gifter Generator");
    expect(PLANNER_FAQS.some((item) => item.q === "Are AI images and videos included?")).toBe(true);
    expect(PLANNER_FAQS.find((item) => item.q.startsWith("What happens after I pay"))?.a).toContain(
      "300 bonus AI credits",
    );
  });

  it("exposes login and account actions on mobile", () => {
    const page = readSrc("src/features/christmas/planner/ChristmasPlannerPage.tsx");
    const more = readSrc("src/features/christmas/planner/ChristmasPlannerPages.tsx");
    expect(page).toContain('data-testid="planner-mobile-menu"');
    expect(page).toContain("Get my Planner");
    expect(page).toContain("Log in");
    expect(more).toContain('["/account", "My account"');
    expect(readSrc("src/features/christmas/planner/planner.css")).toContain(".tdg-pl__topbar-link");
    expect(readSrc("src/features/christmas/planner/planner.css")).toContain(
      ".tdg-planner.tdg-pl .tdg-pl__topbar a",
    );
    expect(readSrc("src/features/christmas/planner/planner.css")).toContain(
      ".tdg-planner.tdg-pl .tdg-pl__topbar button.tdg-pl__topbar-cta",
    );
    expect(readSrc("src/features/christmas/planner/planner.css")).toContain(".tdg-pl__faq details[open] summary::after");
    expect(readSrc("src/features/christmas/planner/planner.css")).toContain(".tdg-planner.tdg-pl .tdg-pl__faq details p");
  });

  it("uses the same credits ledger balance for image and video generation", () => {
    const generator = readSrc("src/domains/generator/components/Generator.tsx");
    const credits = readSrc("src/data/queries/credits.ts");
    const bar = readSrc("src/domains/generator/components/GenerationBar.tsx");
    expect(generator).toContain("useUserCreditsQuery");
    expect(credits).toContain('.from("credits_ledger")');
    expect(credits).toContain('.eq("user_convex_id", normalizedEmail)');
    expect(bar).toContain("Create my image");
    expect(bar).not.toContain("With Audio");
    expect(generator).toContain("generate-nano-banana");
    expect(generator).not.toContain("Video generation is temporarily disabled");
  });

  it("keeps existing generator debit and failed-generation refund rules", () => {
    const spend = readSrc("supabase/migrations/20260913120000_christmas_commercial_offers.sql");
    const banana = readSrc("supabase/functions/generate-nano-banana/publicGenerator.ts");
    const jobs = readSrc("supabase/functions/app-christmas-job/index.ts");
    expect(spend).toContain("spend_credits_idempotent");
    expect(spend).toContain("configured_credits");
    expect(spend).toContain("insufficient_credits");
    expect(banana).toContain("Not enough credits");
    expect(jobs).toContain("refund_christmas_job_credits");
    expect(jobs).toContain("credits_restored");
  });

  it("renders a customer account home instead of an admin dashboard", () => {
    const home = readSrc("src/pages/account/CustomerAccountHome.tsx");
    const app = readSrc("src/App.tsx");
    const auth = readSrc("src/features/christmas/planner/ChristmasAuthScreen.tsx");
    expect(app).toContain("CustomerAccountHome");
    expect(home).toContain("My products");
    expect(home).toContain("AI credits");
    expect(home).toContain("Recent creations");
    expect(home).toContain("Orders");
    expect(home).toContain("Delete my account");
    expect(auth).toContain("Welcome back to Christmas.");
    expect(auth).toContain("Sign in to open your planner, view your purchases, and use your AI credits.");
  });
});
