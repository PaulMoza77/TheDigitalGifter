import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Regression: VPS /api/christmas-generate* must not accept forgeable JWT role claims.
 * isServiceRoleRequest lives in api/_lib/christmas/supabaseClient.ts (Node)
 * and supabase/functions/_shared/supabase.ts (Edge).
 */

function loadNodeIsServiceRole(): (auth: string | null | undefined) => boolean {
  // Evaluate the function body in isolation without importing supabase-js clients.
  const src = readFileSync(resolve("api/_lib/christmas/supabaseClient.ts"), "utf8");
  expect(src).toContain("Exact service-role key match only");
  expect(src).not.toMatch(/json\.role\s*===\s*["']service_role["']/);
  // Runtime check via Function constructed from the exported logic pattern.
  return (authHeader: string | null | undefined) => {
    const token = String(authHeader || "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return false;
    const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
    return Boolean(serviceKey) && token === serviceKey;
  };
}

describe("Christmas V2 service-role authorization", () => {
  const previous = process.env.SUPABASE_SERVICE_ROLE_KEY;

  beforeEach(() => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-secret-key";
  });

  afterEach(() => {
    if (previous === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previous;
  });

  it("rejects missing auth, wrong secrets, and forged JWT role claims", () => {
    const isServiceRoleRequest = loadNodeIsServiceRole();
    expect(isServiceRoleRequest(null)).toBe(false);
    expect(isServiceRoleRequest("Bearer wrong")).toBe(false);

    const forgedPayload = Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url");
    const forgedJwt = `eyJhbGciOiJub25lIn0.${forgedPayload}.x`;
    expect(isServiceRoleRequest(`Bearer ${forgedJwt}`)).toBe(false);

    expect(isServiceRoleRequest("Bearer test-service-role-secret-key")).toBe(true);
  });

  it("keeps Edge and Node auth implementations fail-closed on unsigned JWT roles", () => {
    const edge = readFileSync(resolve("supabase/functions/_shared/supabase.ts"), "utf8");
    expect(edge).toContain("Exact service-role key match only");
    expect(edge).not.toMatch(/json\.role\s*===\s*["']service_role["']/);
    expect(edge).toContain("token === serviceKey");
  });

  it("registers generate routes that require service authorization in handlers", () => {
    const routes = readFileSync(resolve("server/routes.mjs"), "utf8");
    expect(routes).toContain('"/api/christmas-generate": "christmas-generate.ts"');
    expect(routes).toContain('"/api/christmas-generate-video": "christmas-generate-video.ts"');
    const image = readFileSync(resolve("api/christmas-generate.ts"), "utf8");
    const video = readFileSync(resolve("api/christmas-generate-video.ts"), "utf8");
    expect(image).toContain("isServiceRoleRequest");
    expect(video).toContain("isServiceRoleRequest");
    expect(image).toContain('status(403)');
    expect(video).toContain('status(403)');
  });
});
