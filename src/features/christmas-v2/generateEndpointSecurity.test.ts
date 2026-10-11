import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * Attack-test matrix for newly exposed Christmas generation endpoints.
 * Does not print secrets. Does not call Stripe or Higgsfield.
 */

function isServiceRoleRequest(authHeader: string | null | undefined): boolean {
  const token = String(authHeader || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return false;
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  return Boolean(serviceKey) && token === serviceKey;
}

function forgeUnsignedServiceRoleJwt(): string {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({ role: "service_role", iss: "supabase", exp: Math.floor(Date.now() / 1000) + 3600 }),
  ).toString("base64url");
  return `${header}.${payload}.`;
}

function forgeExpiredServiceRoleJwt(): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({ role: "service_role", exp: Math.floor(Date.now() / 1000) - 3600 }),
  ).toString("base64url");
  const sig = createHmac("sha256", "attacker-secret").update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${sig}`;
}

describe("Christmas generate endpoint security attack matrix", () => {
  const previous = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const DESIGNATED_TEST_KEY = "tdg-iso-service-role-test-key-not-production";

  beforeEach(() => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = DESIGNATED_TEST_KEY;
  });

  afterEach(() => {
    if (previous === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previous;
  });

  const cases: Array<{ name: string; auth: string | null; expectOk: boolean }> = [
    { name: "missing authorization", auth: null, expectOk: false },
    { name: "empty bearer", auth: "Bearer ", expectOk: false },
    { name: "arbitrary bearer token", auth: "Bearer totally-arbitrary-token", expectOk: false },
    { name: "unsigned role=service_role JWT", auth: `Bearer ${forgeUnsignedServiceRoleJwt()}`, expectOk: false },
    { name: "expired/invalid signed JWT with role claim", auth: `Bearer ${forgeExpiredServiceRoleJwt()}`, expectOk: false },
    { name: "wrong project credential", auth: "Bearer wrong-project-service-role-key", expectOk: false },
    { name: "valid designated test service credential", auth: `Bearer ${DESIGNATED_TEST_KEY}`, expectOk: true },
  ];

  it.each(cases)("$name → authorized=$expectOk", ({ auth, expectOk }) => {
    expect(isServiceRoleRequest(auth)).toBe(expectOk);
  });

  it("rejects when SUPABASE_SERVICE_ROLE_KEY is unset even with forged JWT", () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(isServiceRoleRequest(`Bearer ${forgeUnsignedServiceRoleJwt()}`)).toBe(false);
    expect(isServiceRoleRequest(`Bearer ${DESIGNATED_TEST_KEY}`)).toBe(false);
  });

  it("Node and Edge generate handlers enforce service auth before paid work", () => {
    for (const path of [
      "api/christmas-generate.ts",
      "api/christmas-generate-video.ts",
      "supabase/functions/christmas-generate/index.ts",
      "supabase/functions/christmas-generate-video/index.ts",
    ]) {
      const src = readFileSync(resolve(path), "utf8");
      expect(src).toContain("isServiceRoleRequest");
      expect(src).toMatch(/403/);
      // Paid order gate before generation work
      expect(src).toContain("paid_at");
      expect(src).toContain("PAYMENT_REQUIRED");
    }
  });

  it("Edge and Node auth helpers match (exact key only)", () => {
    const node = readFileSync(resolve("api/_lib/christmas/supabaseClient.ts"), "utf8");
    const edge = readFileSync(resolve("supabase/functions/_shared/supabase.ts"), "utf8");
    for (const src of [node, edge]) {
      expect(src).toContain("token === serviceKey");
      expect(src).not.toMatch(/json\.role\s*===\s*["']service_role["']/);
    }
  });

  it("handlers gate auth and paid_at before claim; Soul only behind mock/live branch", () => {
    const image = readFileSync(resolve("api/christmas-generate.ts"), "utf8");
    // Handler entry uses isServiceRoleRequest before paid_at / claim.
    const handlerStart = image.indexOf("export default async function handler");
    const authIdx = image.indexOf("isServiceRoleRequest", handlerStart);
    const paidIdx = image.indexOf("paid_at", handlerStart);
    const claimIdx = image.indexOf("claim_christmas_v2_generation_job", handlerStart);
    expect(handlerStart).toBeGreaterThan(-1);
    expect(authIdx).toBeGreaterThan(handlerStart);
    expect(paidIdx).toBeGreaterThan(authIdx);
    expect(claimIdx).toBeGreaterThan(paidIdx);
    expect(image).toContain("generationMock()");
    expect(image).toContain("submitSoulV2Image");
    expect(image).toContain("uncertain_provider_outcome");
  });
});

