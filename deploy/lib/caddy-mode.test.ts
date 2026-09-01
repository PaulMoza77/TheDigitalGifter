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
    // Simulates what would happen if deploy blindly copied Caddyfile.http:
    expect(() => assertCaddyContentMatchesMode(httpFile, mode)).toThrow();
  });
});
