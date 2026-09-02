import { promisify } from "node:util";
import dns from "node:dns";

const reverseLookup = promisify(dns.reverse);

export type WriteEnvironment = "production" | "preview" | "development";

/** ISO country codes excluded from production KPIs (founder / internal geos). */
export const DEFAULT_INTERNAL_COUNTRY_CODES = ["RO", "IT"] as const;

/** GA4 country dimension names matching DEFAULT_INTERNAL_COUNTRY_CODES. */
export const DEFAULT_INTERNAL_GA4_COUNTRIES = ["Romania", "Italy"] as const;

const DEFAULT_TEST_UTM_CAMPAIGNS = ["cat-v3-live-smoke", "checkout-proof"] as const;
const DEFAULT_TEST_UTM_SOURCES = ["internal", "audit_smoke", "ctrl_test"] as const;
const DEFAULT_TEST_IP_HOSTMARKERS = ["rentalcarsoradea", "rdsnet"] as const;
const DEFAULT_TEST_HOSTNAME_TLDS = ["ro", "it"] as const;

function pickHeader(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return String(raw || "").trim();
}

export function clientIpFromHeaders(
  headers: Record<string, string | string[] | undefined>,
): string {
  const forwarded = pickHeader(headers["x-forwarded-for"]);
  if (forwarded) return forwarded.split(",")[0]?.trim() || "";
  return pickHeader(headers["cf-connecting-ip"]) || pickHeader(headers["x-real-ip"]) || "";
}

/** Vercel / Cloudflare edge country (ISO 3166-1 alpha-2). */
export function countryCodeFromHeaders(
  headers: Record<string, string | string[] | undefined>,
): string | null {
  const raw =
    pickHeader(headers["x-vercel-ip-country"]) ||
    pickHeader(headers["cf-ipcountry"]) ||
    pickHeader(headers["x-country-code"]);
  if (!raw || raw === "XX" || raw === "T1") return null;
  const code = raw.toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

function parseMarkerList(raw: string | undefined, fallback: string): string[] {
  const source = String(raw ?? fallback).trim();
  if (!source) return [];
  return source
    .split(/[,\s]+/)
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

function parseIpList(raw: string | undefined): string[] {
  return String(raw || "")
    .split(/[,\s]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseLowerList(raw: string | undefined, fallback: string): string[] {
  const source = String(raw ?? fallback).trim();
  if (!source) return [];
  return source
    .split(/[,\s]+/)
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

function parseUpperList(raw: string | undefined, fallback: string): string[] {
  const source = String(raw ?? fallback).trim();
  if (!source) return [];
  return source
    .split(/[,\s]+/)
    .map((part) => part.trim().toUpperCase())
    .filter(Boolean);
}

export function utmCampaignIsTestMarker(utmCampaign: string | null | undefined): boolean {
  const normalized = String(utmCampaign || "").trim().toLowerCase();
  if (!normalized) return false;
  const markers = parseLowerList(process.env.PET_FUNNEL_TEST_UTM_CAMPAIGNS, DEFAULT_TEST_UTM_CAMPAIGNS.join(","));
  return markers.includes(normalized);
}

export function utmSourceIsTestMarker(utmSource: string | null | undefined): boolean {
  const normalized = String(utmSource || "").trim().toLowerCase();
  if (!normalized) return false;
  const markers = parseLowerList(process.env.PET_FUNNEL_TEST_UTM_SOURCES, DEFAULT_TEST_UTM_SOURCES.join(","));
  return markers.includes(normalized);
}

export function hostnameMatchesTestMarkers(hostname: string, markers: string[]): boolean {
  const normalized = hostname.trim().toLowerCase();
  if (!normalized || markers.length === 0) return false;
  return markers.some((marker) => normalized.includes(marker));
}

/** True when reverse-DNS hostname ends with an excluded country TLD (e.g. .ro / .it). */
export function hostnameMatchesExcludedCountryTld(
  hostname: string,
  tlds: string[] = [...DEFAULT_TEST_HOSTNAME_TLDS],
): boolean {
  const normalized = hostname.trim().toLowerCase().replace(/\.$/, "");
  if (!normalized || tlds.length === 0) return false;
  return tlds.some((tld) => {
    const suffix = String(tld || "")
      .trim()
      .toLowerCase()
      .replace(/^\./, "");
    if (!suffix) return false;
    return normalized === suffix || normalized.endsWith(`.${suffix}`);
  });
}

export function countryCodeIsInternal(countryCode: string | null | undefined): boolean {
  const code = String(countryCode || "")
    .trim()
    .toUpperCase();
  if (!code) return false;
  const excluded = parseUpperList(
    process.env.PET_FUNNEL_INTERNAL_COUNTRY_CODES,
    DEFAULT_INTERNAL_COUNTRY_CODES.join(","),
  );
  return excluded.includes(code);
}

export async function resolveClientIpHostname(clientIp: string): Promise<string | null> {
  if (!clientIp || clientIp === "unknown") return null;
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(clientIp)) return null;
  try {
    const names = await reverseLookup(clientIp);
    const first = names.find((name) => typeof name === "string" && name.trim().length > 0);
    return first ? first.trim().slice(0, 200) : null;
  } catch {
    return null;
  }
}

export function resolveFunnelIsTestSync(input: {
  environment: WriteEnvironment;
  clientTestFlag?: boolean;
  clientIp?: string;
  clientIpHostname?: string | null;
  countryCode?: string | null;
  utmSource?: string | null;
  utmCampaign?: string | null;
}): boolean {
  if (input.environment !== "production") return true;
  if (input.clientTestFlag) return true;
  if (utmSourceIsTestMarker(input.utmSource)) return true;
  if (utmCampaignIsTestMarker(input.utmCampaign)) return true;
  if (countryCodeIsInternal(input.countryCode)) return true;
  const ip = String(input.clientIp || "").trim();
  if (ip && parseIpList(process.env.PET_FUNNEL_TEST_IPS).includes(ip)) return true;
  const hostname = String(input.clientIpHostname || "");
  const markers = parseMarkerList(
    process.env.PET_FUNNEL_TEST_IP_HOSTMARKERS,
    DEFAULT_TEST_IP_HOSTMARKERS.join(","),
  );
  if (hostnameMatchesTestMarkers(hostname, markers)) return true;
  const tlds = parseLowerList(
    process.env.PET_FUNNEL_TEST_HOSTNAME_TLDS,
    DEFAULT_TEST_HOSTNAME_TLDS.join(","),
  );
  if (hostnameMatchesExcludedCountryTld(hostname, tlds)) return true;
  return false;
}

export async function resolveFunnelIsTest(input: {
  environment: WriteEnvironment;
  clientTestFlag?: boolean;
  clientIp?: string;
  countryCode?: string | null;
  utmSource?: string | null;
  utmCampaign?: string | null;
}): Promise<{
  isTest: boolean;
  clientIp: string | null;
  clientIpHostname: string | null;
  countryCode: string | null;
}> {
  const clientIp = String(input.clientIp || "").trim() || null;
  const countryCode = input.countryCode ? String(input.countryCode).trim().toUpperCase() || null : null;
  let clientIpHostname: string | null = null;
  if (clientIp && input.environment === "production") {
    clientIpHostname = await resolveClientIpHostname(clientIp);
  }
  const isTest = resolveFunnelIsTestSync({
    environment: input.environment,
    clientTestFlag: input.clientTestFlag,
    clientIp: clientIp || undefined,
    clientIpHostname,
    countryCode,
    utmSource: input.utmSource,
    utmCampaign: input.utmCampaign,
  });
  return { isTest, clientIp, clientIpHostname, countryCode };
}
