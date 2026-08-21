import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { isSafeAdminReturnPath, rememberAuthReturnTo, takeAuthReturnTo } from "@/lib/auth/returnTo";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("admin return path", () => {
  it("accepts only admin paths", () => {
    expect(isSafeAdminReturnPath("/admin/pet-funnel-analytics")).toBe(true);
    expect(isSafeAdminReturnPath("/admin")).toBe(true);
    expect(isSafeAdminReturnPath("/")).toBe(false);
    expect(isSafeAdminReturnPath("//evil.com")).toBe(false);
    expect(isSafeAdminReturnPath("https://evil.com")).toBe(false);
  });

  it("round-trips a stored admin path", () => {
    const store = new Map<string, string>();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        sessionStorage: {
          getItem: (key: string) => store.get(key) ?? null,
          setItem: (key: string, value: string) => store.set(key, value),
          removeItem: (key: string) => store.delete(key),
        },
      },
    });
    rememberAuthReturnTo("/admin/pet-funnel-analytics");
    expect(takeAuthReturnTo("/")).toBe("/admin/pet-funnel-analytics");
    expect(takeAuthReturnTo("/")).toBe("/");
  });

  it("keeps unauthenticated admin visitors on a sign-in gate instead of sending them home", () => {
    const adminRoute = readFileSync(resolve(root, "src/components/AdminRoute.tsx"), "utf8");
    expect(adminRoute).toContain("AdminSignInGate");
    expect(adminRoute).toContain("Sign in required");
    expect(adminRoute).toContain("if (!gate.email)");
    expect(adminRoute).toContain("return <AdminSignInGate");
    expect(readFileSync(resolve(root, "src/pages/AuthCallback.tsx"), "utf8")).toContain("takeAuthReturnTo");
  });
});
