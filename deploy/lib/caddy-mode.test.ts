import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertCaddyContentMatchesMode,
  caddySourceFileForMode,
  detectTdgCaddyMode,
} from "./caddy-mode.mjs";

const httpFile = readFileSync(resolve("deploy/caddy/Caddyfile.http"), "utf8");
const httpsFile = readFileSync(resolve("deploy/caddy/Caddyfile.https.ready"), "utf8");

describe("TDG Caddy mode selection (deploy must not downgrade HTTPS)", () => {
  it("detects HTTP host-matcher config as http", () => {
    expect(detectTdgCaddyMode(httpFile, "")).toBe("http");
    expect(caddySourceFileForMode("http")).toBe("Caddyfile.http");
    expect(() => assertCaddyContentMatchesMode(httpFile, "http")).not.toThrow();
  });

  it("detects named TDG HTTPS site as https even without marker", () => {
    expect(detectTdgCaddyMode(httpsFile, "")).toBe("https");
    expect(caddySourceFileForMode("https")).toBe("Caddyfile.https.ready");
    expect(() => assertCaddyContentMatchesMode(httpsFile, "https")).not.toThrow();
  });

  it("honors the mode marker over heuristics", () => {
    expect(detectTdgCaddyMode(httpFile, "https")).toBe("https");
    expect(detectTdgCaddyMode(httpsFile, "http")).toBe("http");
  });

  it("refuses to treat the HTTP file as a valid HTTPS candidate", () => {
    expect(() => assertCaddyContentMatchesMode(httpFile, "https")).toThrow(/named site/i);
  });

  it("refuses to treat the HTTPS file as a valid HTTP candidate", () => {
    expect(() => assertCaddyContentMatchesMode(httpsFile, "http")).toThrow(/must not enable named HTTPS/i);
  });

  it("regression: after HTTPS is active, deploy must re-select the HTTPS source", () => {
    const active = httpsFile;
    const mode = detectTdgCaddyMode(active, "https");
    expect(mode).toBe("https");
    expect(caddySourceFileForMode(mode)).toBe("Caddyfile.https.ready");
    expect(() => assertCaddyContentMatchesMode(httpFile, mode)).toThrow();
  });

  it("HTTPS canonical template keeps CasaHub + MCP + Mozas + TDG", () => {
    expect(httpsFile).toMatch(/^\s*casahub\.eu,\s*www\.casahub\.eu\s*\{/m);
    expect(httpsFile).toContain("casahub-web:3000");
    expect(httpsFile).toContain("mcp.themozas.com");
    expect(httpsFile).toContain("mozas-mcp-bridge:8787");
    expect(httpsFile).toContain("themozas.com");
    expect(httpsFile).toContain("thedigitalgifter.com");
  });

  it("refuses HTTPS candidate that drops CasaHub", () => {
    const stripped = httpsFile
      .replace(/casahub\.eu,\s*www\.casahub\.eu\s*\{[\s\S]*?\n\}\n?/m, "")
      .replace(/@casahub host casahub\.eu www\.casahub\.eu\n\thandle @casahub \{[\s\S]*?\n\t\}\n/m, "")
      .replace(/casahub-web:3000/g, "missing-casahub-upstream");
    expect(() => assertCaddyContentMatchesMode(stripped, "https")).toThrow(/CasaHub/i);
  });
});
