import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readSrc(rel: string) {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

describe("menu loading regression", () => {
  it("does not gate guest/mobile nav on account overview loading", () => {
    const header = readSrc("src/components/Header.tsx");
    expect(header).toContain("const showAuthSkeleton = authLoading");
    expect(header).not.toContain("authLoading || overviewLoading");
    expect(header).toContain('data-testid="header-guest-mobile-nav"');
    expect(header).toContain("overviewLoading ? \"…\" : creditsRemaining");
  });

  it("always renders account sidebar links instead of Loading menu...", () => {
    const sidebar = readSrc("src/components/client/AccountSidebar.tsx");
    expect(sidebar).not.toContain("Loading menu...");
    expect(sidebar).toContain("items.map");
  });

  it("always renders account topbar nav while overview loads", () => {
    const topbar = readSrc("src/components/client/AccountTopbar.tsx");
    expect(topbar).not.toContain("!loading &&");
    expect(topbar).toContain('data-testid="account-topbar-mobile-nav"');
  });

  it("times out auth and account overview so skeletons cannot stick forever", () => {
    const auth = readSrc("src/lib/auth/AuthProvider.tsx");
    const overview = readSrc("src/hooks/useAccountOverview.ts");
    const protectedRoute = readSrc("src/routes/ProtectedClientRoute.tsx");

    expect(auth).toContain("withTimeout");
    expect(auth).toContain("AUTH_SESSION_TIMEOUT_MS");
    expect(overview).toContain("withTimeout");
    expect(overview).toContain("ACCOUNT_OVERVIEW_TIMEOUT_MS");
    expect(protectedRoute).toContain("withTimeout");
    expect(protectedRoute).toContain("PROTECTED_SESSION_TIMEOUT_MS");
  });
});
