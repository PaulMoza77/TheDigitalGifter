import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function read(relative: string) {
  return readFileSync(resolve(relative), "utf8");
}

describe("platform security harden contracts", () => {
  it("ships additive migration locking admin authority to admin_users", () => {
    const migration = read(
      "supabase/migrations/20261012120000_platform_security_admin_and_rls.sql",
    );
    expect(migration).toContain("profiles_prevent_role_escalation");
    expect(migration).toContain("profiles.role is intentionally ignored");
    expect(migration).toContain("from public.admin_users au");
    expect(migration).not.toMatch(/p\.role = 'admin'/);
    expect(migration).toContain("christmas_v2_orders");
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("using (public.is_admin())");
  });

  it("useAdminAuth ignores profiles.role and checks admin_users only", () => {
    const hook = read("src/hooks/useAdminAuth.ts");
    expect(hook).toContain('from("admin_users")');
    expect(hook).not.toContain('from("profiles")');
    expect(hook).toContain("intentionally ignored");
  });

  it("Christmas confirmStripePayment requires session↔order binding", () => {
    const node = read("api/christmas-funnel.ts");
    const edge = read("supabase/functions/christmas-funnel/index.ts");
    for (const src of [node, edge]) {
      expect(src).toContain("!sessionOrderId || sessionOrderId !== asString(order.id)");
      expect(src).not.toMatch(/if \(sessionOrderId && sessionOrderId !==/);
    }
  });

  it("exposes password reset helper and login forgot-password control", () => {
    const auth = read("src/lib/auth/emailPassword.ts");
    expect(auth).toContain("resetPasswordForEmail");
    expect(auth).toContain("requestPasswordReset");
    const screen = read("src/features/christmas/planner/ChristmasAuthScreen.tsx");
    expect(screen).toContain('data-testid="auth-forgot-password"');
    expect(screen).toContain("requestPasswordReset");
  });

  it("customer /pricing route exists and separates Christmas packs from credits", () => {
    const app = read("src/App.tsx");
    expect(app).toContain('path="/pricing"');
    expect(app).toContain("CustomerCreditsPricingPage");
    const page = read("src/pages/PricingPage.tsx");
    expect(page).toContain("Not a Christmas pack checkout");
    expect(page).toContain("/christmas-ai-photos");
    expect(page).toContain("PricingModal");
  });

  it("does not ship service-role keys via Vite public env", () => {
    const env = read("src/lib/env.ts");
    expect(env).toContain("VITE_SUPABASE_URL");
    expect(env).toContain("VITE_SUPABASE_ANON_KEY");
    expect(env).not.toMatch(/SERVICE_ROLE/);
    const example = read(".env.example");
    expect(example).toMatch(/Never prefix with VITE_/i);
  });
});
