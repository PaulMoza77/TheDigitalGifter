import { describe, expect, it } from "vitest";
import {
  clientIpFromHeaders,
  countryCodeFromHeaders,
  countryCodeIsInternal,
  hostnameMatchesExcludedCountryTld,
  hostnameMatchesTestMarkers,
  resolveFunnelIsTestSync,
} from "./funnelTestTraffic";

describe("funnelTestTraffic", () => {
  it("reads the first forwarded client IP", () => {
    expect(
      clientIpFromHeaders({
        "x-forwarded-for": "203.0.113.10, 10.0.0.1",
      }),
    ).toBe("203.0.113.10");
  });

  it("reads Vercel / Cloudflare country headers", () => {
    expect(countryCodeFromHeaders({ "x-vercel-ip-country": "ro" })).toBe("RO");
    expect(countryCodeFromHeaders({ "cf-ipcountry": "IT" })).toBe("IT");
    expect(countryCodeFromHeaders({ "x-vercel-ip-country": "XX" })).toBeNull();
    expect(countryCodeFromHeaders({})).toBeNull();
  });

  it("marks Romania and Italy country codes as internal", () => {
    expect(countryCodeIsInternal("RO")).toBe(true);
    expect(countryCodeIsInternal("it")).toBe(true);
    expect(countryCodeIsInternal("US")).toBe(false);
  });

  it("marks RO/IT edge-country traffic as test in production", () => {
    expect(
      resolveFunnelIsTestSync({
        environment: "production",
        countryCode: "RO",
      }),
    ).toBe(true);
    expect(
      resolveFunnelIsTestSync({
        environment: "production",
        countryCode: "IT",
      }),
    ).toBe(true);
    expect(
      resolveFunnelIsTestSync({
        environment: "production",
        countryCode: "US",
      }),
    ).toBe(false);
  });

  it("marks rentalcarsoradea and rdsnet reverse-dns traffic as test in production", () => {
    expect(
      resolveFunnelIsTestSync({
        environment: "production",
        clientIp: "203.0.113.10",
        clientIpHostname: "79-114-12-34.rentalcarsoradea.ro",
      }),
    ).toBe(true);
    expect(
      resolveFunnelIsTestSync({
        environment: "production",
        clientIpHostname: "82-78-21-70.rdsnet.ro",
      }),
    ).toBe(true);
  });

  it("marks .ro / .it reverse-dns TLDs as test without substring false positives", () => {
    expect(hostnameMatchesExcludedCountryTld("5-14-158-154.residential.rdsnet.ro")).toBe(true);
    expect(hostnameMatchesExcludedCountryTld("host.example.it")).toBe(true);
    expect(hostnameMatchesExcludedCountryTld("foo.rocket.com")).toBe(false);
    expect(hostnameMatchesExcludedCountryTld("macro.com")).toBe(false);
  });

  it("does not mark real production traffic as test", () => {
    expect(
      resolveFunnelIsTestSync({
        environment: "production",
        clientIp: "203.0.113.10",
        clientIpHostname: "pool-203-0-113-10.telecom.example",
        countryCode: "US",
      }),
    ).toBe(false);
  });

  it("matches hostname suffix markers case-insensitively", () => {
    expect(hostnameMatchesTestMarkers("79-114-12-34.RentalCarsOradea.ro", ["rentalcarsoradea"])).toBe(true);
  });

  it("marks internal smoke-test UTMs as test in production", () => {
    expect(
      resolveFunnelIsTestSync({
        environment: "production",
        utmSource: "internal",
        utmCampaign: "cat-v3-live-smoke",
      }),
    ).toBe(true);
    expect(
      resolveFunnelIsTestSync({
        environment: "production",
        utmSource: "facebook",
        utmCampaign: "cat-v3-live-smoke",
      }),
    ).toBe(true);
    expect(
      resolveFunnelIsTestSync({
        environment: "production",
        utmSource: "audit_smoke",
      }),
    ).toBe(true);
    expect(
      resolveFunnelIsTestSync({
        environment: "production",
        utmSource: "ctrl_test",
      }),
    ).toBe(true);
    expect(
      resolveFunnelIsTestSync({
        environment: "production",
        utmSource: "facebook",
        utmCampaign: "cat-v3-launch",
      }),
    ).toBe(false);
  });
});
