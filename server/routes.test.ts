import { describe, expect, it } from "vitest";
import { classifyPath } from "./routes.mjs";

describe("TDG origin path classification", () => {
  it("keeps health, Apple Pay, and known APIs off the SPA fallback", () => {
    expect(classifyPath("/healthz")).toEqual({ kind: "health" });
    expect(classifyPath("/.well-known/apple-developer-merchantid-domain-association")).toEqual({
      kind: "apple",
    });
    expect(classifyPath("/api/pet/funnel-event").kind).toBe("api");
    expect(classifyPath("/api/pet-v2/funnel-event").kind).toBe("api");
    expect(classifyPath("/api/pet-v3/funnel-event").kind).toBe("api");
    expect(classifyPath("/api/pet-v3/internal-test-status").kind).toBe("api");
    expect(classifyPath("/api/pet-provider-status").kind).toBe("api");
    expect(classifyPath("/api/christmas-funnel").kind).toBe("api");
    expect(classifyPath("/sitemap.xml").kind).toBe("api");
  });

  it("returns api-miss for unknown /api routes instead of static/SPA", () => {
    expect(classifyPath("/api/does-not-exist")).toEqual({ kind: "api-miss" });
    expect(classifyPath("/api/")).toEqual({ kind: "api-miss" });
    expect(classifyPath("/api")).toEqual({ kind: "api-miss" });
  });

  it("classifies website pages as static so refresh can serve index.html", () => {
    expect(classifyPath("/")).toEqual({ kind: "static" });
    expect(classifyPath("/pet/dog")).toEqual({ kind: "static" });
    expect(classifyPath("/account/dashboard")).toEqual({ kind: "static" });
    expect(classifyPath("/christmas-ai-photos")).toEqual({ kind: "static" });
  });
});
