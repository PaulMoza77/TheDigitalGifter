import { describe, expect, it } from "vitest";
import {
  clientIpFromHeaders,
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

  it("marks rentalcarsoradea reverse-dns traffic as test in production", () => {
    expect(
      resolveFunnelIsTestSync({
        environment: "production",
        clientIp: "203.0.113.10",
        clientIpHostname: "79-114-12-34.rentalcarsoradea.ro",
      }),
    ).toBe(true);
  });

  it("does not mark real production traffic as test", () => {
    expect(
      resolveFunnelIsTestSync({
        environment: "production",
        clientIp: "203.0.113.10",
        clientIpHostname: "pool-203-0-113-10.telecom.example",
      }),
    ).toBe(false);
  });

  it("matches hostname suffix markers case-insensitively", () => {
    expect(hostnameMatchesTestMarkers("79-114-12-34.RentalCarsOradea.ro", ["rentalcarsoradea"])).toBe(true);
  });
});
