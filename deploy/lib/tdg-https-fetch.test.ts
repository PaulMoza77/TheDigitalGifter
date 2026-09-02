import { describe, expect, it } from "vitest";
import {
  acceptTdgHttpOrHttps,
  dnsPointsAtVps,
  httpsLocationForHost,
  isHttpToHttpsRedirect,
  parseDnsRecords,
  parseResponseMeta,
} from "./tdg-https-fetch.mjs";

describe("HTTP→HTTPS redirect acceptance", () => {
  it("accepts Caddy 308 to the same host https URL", () => {
    expect(isHttpToHttpsRedirect(308, "https://thedigitalgifter.com/healthz", "thedigitalgifter.com")).toBe(true);
    expect(
      acceptTdgHttpOrHttps({
        httpStatus: 308,
        location: "https://thedigitalgifter.com/healthz",
        host: "thedigitalgifter.com",
        httpsStatus: 200,
        requireHttps: true,
      }),
    ).toBe(true);
  });

  it("accepts relative Location resolved against the request host", () => {
    expect(httpsLocationForHost("www.thedigitalgifter.com", "/")).toBe("https://www.thedigitalgifter.com/");
    expect(isHttpToHttpsRedirect(301, "/", "www.thedigitalgifter.com")).toBe(true);
  });

  it("rejects a redirect that would land on a different site", () => {
    expect(isHttpToHttpsRedirect(302, "https://themozas.com/", "thedigitalgifter.com")).toBe(false);
    expect(
      acceptTdgHttpOrHttps({
        httpStatus: 302,
        location: "https://themozas.com/",
        host: "thedigitalgifter.com",
        httpsStatus: 200,
        requireHttps: true,
      }),
    ).toBe(false);
  });

  it("does not treat HTTP 200 as success when HTTPS is required", () => {
    expect(
      acceptTdgHttpOrHttps({
        httpStatus: 200,
        location: "",
        host: "thedigitalgifter.com",
        httpsStatus: 0,
        requireHttps: true,
      }),
    ).toBe(false);
  });

  it("accepts plain HTTP 200 before HTTPS is applied", () => {
    expect(
      acceptTdgHttpOrHttps({
        httpStatus: 200,
        host: "thedigitalgifter.com",
        httpsStatus: 0,
        requireHttps: false,
      }),
    ).toBe(true);
  });

  it("rejects HTTP 308 without a successful HTTPS follow-up", () => {
    expect(
      acceptTdgHttpOrHttps({
        httpStatus: 308,
        location: "https://www.thedigitalgifter.com/",
        host: "www.thedigitalgifter.com",
        httpsStatus: 0,
        requireHttps: true,
      }),
    ).toBe(false);
  });
});

describe("DNS A/AAAA vs VPS", () => {
  it("requires A to be exactly the VPS IPv4 and allows empty AAAA", () => {
    const rec = parseDnsRecords({ a: ["203.0.113.9"], aaaa: [], cname: [] });
    expect(dnsPointsAtVps({ ...rec, vpsIp: "203.0.113.9" })).toMatchObject({
      aOk: true,
      aaaaOk: true,
      aaaaAbsent: true,
      ok: true,
    });
  });

  it("fails when A still points at Vercel", () => {
    const rec = parseDnsRecords({ a: ["216.198.79.1"], aaaa: [] });
    expect(dnsPointsAtVps({ ...rec, vpsIp: "203.0.113.9" }).ok).toBe(false);
  });

  it("fails when AAAA points elsewhere", () => {
    const rec = parseDnsRecords({ a: ["203.0.113.9"], aaaa: ["2001:db8::1"] });
    expect(dnsPointsAtVps({ ...rec, vpsIp: "203.0.113.9" }).ok).toBe(false);
  });
});

describe("parseResponseMeta", () => {
  it("reads the last status and Location", () => {
    const meta = parseResponseMeta("HTTP/1.1 308 Permanent Redirect\r\nLocation: https://thedigitalgifter.com/\r\n");
    expect(meta.status).toBe(308);
    expect(meta.location).toBe("https://thedigitalgifter.com/");
  });
});
