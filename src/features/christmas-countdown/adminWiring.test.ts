import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CHRISTMAS_FUNNEL_ALLOWED_EVENTS } from "@/features/christmas/funnelEventContract";
import { CHRISTMAS_COUNTDOWN_JOIN_EVENTS } from "@/features/christmas-countdown/defaults";
import { christmasSignupCsv } from "@/features/christmas-countdown/csv";
import { publicConfigFromUnknown } from "@/features/christmas-countdown/defaults";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

function readSrc(relative: string) {
  return readFileSync(resolve(root, relative), "utf8");
}

describe("christmas countdown admin wiring", () => {
  it("lazy-imports ChristmasPortraitFunnelPage used by portrait routes", () => {
    const app = readSrc("src/App.tsx");
    expect(app).toMatch(/const ChristmasPortraitFunnelPage = lazy\(/);
    expect(app).toContain('import("@/features/christmas/ChristmasPortraitFunnelPage")');
  });

  it("registers /admin/christmas/countdown behind AdminRoute", () => {
    const app = readSrc("src/App.tsx");
    expect(app).toContain("christmas/countdown");
    expect(app).toMatch(/<AdminRoute>[\s\S]*christmas\/countdown/);
    expect(readSrc("src/layouts/AdminLayout.tsx")).toContain("/admin/christmas");
    expect(readSrc("src/pages/admin/christmas/Index.tsx")).toContain("/admin/christmas/countdown");
  });

  it("keeps future Christmas tabs architected without empty stub pages", () => {
    const layout = readSrc("src/pages/admin/christmas/Index.tsx");
    expect(layout).toContain("Countdown");
    expect(layout).toContain("Orders");
    expect(layout).not.toContain("/admin/christmas/gifts");
    expect(layout).not.toContain("/admin/christmas/campaigns");
  });

  it("allows the preferred countdown events on the existing Christmas ingest path", () => {
    for (const eventName of CHRISTMAS_COUNTDOWN_JOIN_EVENTS) {
      expect(CHRISTMAS_FUNNEL_ALLOWED_EVENTS).toContain(eventName);
    }
    expect(readSrc("src/features/christmas/analytics.ts")).toContain("trackEvent(eventName");
    expect(readSrc("src/pages/website/ChristmasPage.tsx")).toContain("christmas_page_view");
    expect(readSrc("src/pages/website/ChristmasPage.tsx")).toContain("christmas_return_visit");
  });

  it("does not expose GA4 or service-role secrets to the browser", () => {
    const page = readSrc("src/pages/admin/christmas/CountdownPage.tsx");
    const hook = readSrc("src/hooks/useChristmasCountdownAdmin.ts");
    expect(page).not.toContain("GA4_SERVICE_ACCOUNT_PRIVATE_KEY");
    expect(page).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(hook).toContain('supabase.functions.invoke("christmas-admin"');
    expect(readSrc("supabase/functions/christmas-admin/index.ts")).toContain("assertAdmin");
    expect(readSrc("api/christmas-admin.ts")).toContain("Forbidden: not an admin");
    expect(readSrc("api/christmas-admin.ts")).not.toContain("private_key");
  });

  it("serves first-party Christmas hub events on the VPS origin", () => {
    const routes = readSrc("server/routes.mjs");
    expect(routes).toContain('"/api/christmas/funnel-event": "christmas-funnel-event.ts"');
    expect(routes).toContain('"/api/christmas-admin": "christmas-admin.ts"');
    expect(readSrc("Dockerfile")).toContain("COPY src ./src");
  });

  it("falls back to hardcoded public copy when config is missing", () => {
    const config = publicConfigFromUnknown(undefined);
    expect(config.headline).toContain("Christmas Cards");
    expect(config.ctaText).toBe("Start Creating");
    expect(config.pageActive).toBe(true);
    expect(readSrc("src/pages/website/ChristmasPage.tsx")).toContain("CHRISTMAS_COUNTDOWN_DEFAULTS");
    expect(readSrc("api/christmas-countdown-config.ts")).toContain("source: \"defaults\"");
  });

  it("exports CSV server-side through the admin function", () => {
    expect(readSrc("supabase/functions/christmas-admin/index.ts")).toContain('action === "exportCsv"');
    expect(readSrc("src/pages/admin/christmas/CountdownPage.tsx")).toContain("Export CSV");
    const csv = christmasSignupCsv([]);
    expect(csv).toBe("email,signup_method,joined_at,source,medium,campaign,referrer,user_status,returning");
  });

  it("persists first-touch UTM on signup and does not auto-subscribe marketing", () => {
    const sql = readSrc("supabase/migrations/20260908120000_christmas_countdown.sql");
    expect(sql).toContain("register_christmas_countdown_signup");
    expect(sql).toContain("source");
    expect(sql).toContain("marketing_opt_in");
    expect(sql).toContain("Never auto-subscribe");
    expect(sql).toContain("if not public.is_admin()");
    expect(sql).toContain("revoke all on table public.christmas_countdown_signups");
    expect(sql).not.toMatch(/grant select on table public.christmas_countdown_signups to anon/);
  });

  it("copies src into the origin image so countdown APIs can import shared modules", () => {
    const docker = readSrc("Dockerfile");
    expect(docker).toContain("COPY src ./src");
    expect(docker).toContain("COPY api ./api");
    expect(readSrc("api/christmas-countdown-config.ts")).toContain("../src/features/christmas-countdown/defaults");
  });

  it("queries GA4 server-side for the /christmas path only", () => {
    const ga4 = readSrc("supabase/functions/_shared/christmas/ga4.ts");
    expect(ga4).toContain('"/christmas"');
    expect(ga4).toContain("runReport");
    expect(ga4).toContain("runRealtimeReport");
    expect(ga4).not.toContain("VITE_GA4");
  });
});
