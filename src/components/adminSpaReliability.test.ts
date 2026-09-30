import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function readSrc(relative: string) {
  return readFileSync(resolve(root, relative), "utf8");
}

function stripComments(source: string) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

describe("Admin SPA reliability", () => {
  it("keeps a route-level AdminErrorBoundary that retries without location.reload", () => {
    const boundary = readSrc("src/components/AdminErrorBoundary.tsx");
    const layout = readSrc("src/layouts/AdminLayout.tsx");
    expect(boundary).toContain("getDerivedStateFromError");
    expect(boundary).toContain("this.setState({ error: null })");
    expect(stripComments(boundary)).not.toMatch(/window\.location\.reload\s*\(/);
    expect(layout).toContain("AdminErrorBoundary");
    expect(layout).toContain("key={location.pathname}");
    expect(layout).toContain("<Outlet />");
  });

  it("skips the AdminRoute verifying flash when the same email is already verified", () => {
    const adminRoute = readSrc("src/components/AdminRoute.tsx");
    expect(adminRoute).toContain("already verified");
    expect(adminRoute).toContain("prev.ready && prev.email === nextEmail && nextEmail");
    expect(adminRoute).toContain("return prev;");
    expect(adminRoute).toContain("ready: true");
    expect(adminRoute).toContain("AdminSignInGate");
    expect(adminRoute).toContain("<Navigate to=\"/\" replace");
  });

  it("does not blanket-reload the Admin shell on retry", () => {
    const layout = stripComments(readSrc("src/layouts/AdminLayout.tsx"));
    const route = stripComments(readSrc("src/components/AdminRoute.tsx"));
    expect(layout).not.toMatch(/window\.location\.reload\s*\(/);
    expect(route).not.toMatch(/window\.location\.reload\s*\(/);
  });
});
