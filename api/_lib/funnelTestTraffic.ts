import { promisify } from "node:util";
import dns from "node:dns";

const reverseLookup = promisify(dns.reverse);

export type WriteEnvironment = "production" | "preview" | "development";

export function clientIpFromHeaders(
  headers: Record<string, string | string[] | undefined>,
): string {
  const pick = (value: string | string[] | undefined): string => {
    const raw = Array.isArray(value) ? value[0] : value;
    return String(raw || "").trim();
  };
  const forwarded = pick(headers["x-forwarded-for"]);
  if (forwarded) return forwarded.split(",")[0]?.trim() || "";
  return pick(headers["cf-connecting-ip"]) || pick(headers["x-real-ip"]) || "";
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

export function hostnameMatchesTestMarkers(hostname: string, markers: string[]): boolean {
  const normalized = hostname.trim().toLowerCase();
  if (!normalized || markers.length === 0) return false;
  return markers.some((marker) => normalized.includes(marker));
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
}): boolean {
  if (input.environment !== "production") return true;
  if (input.clientTestFlag) return true;
  const ip = String(input.clientIp || "").trim();
  if (ip && parseIpList(process.env.PET_FUNNEL_TEST_IPS).includes(ip)) return true;
  const markers = parseMarkerList(process.env.PET_FUNNEL_TEST_IP_HOSTMARKERS, "rentalcarsoradea");
  if (hostnameMatchesTestMarkers(String(input.clientIpHostname || ""), markers)) return true;
  return false;
}

export async function resolveFunnelIsTest(input: {
  environment: WriteEnvironment;
  clientTestFlag?: boolean;
  clientIp?: string;
}): Promise<{ isTest: boolean; clientIp: string | null; clientIpHostname: string | null }> {
  const clientIp = String(input.clientIp || "").trim() || null;
  let clientIpHostname: string | null = null;
  if (clientIp && input.environment === "production") {
    clientIpHostname = await resolveClientIpHostname(clientIp);
  }
  const isTest = resolveFunnelIsTestSync({
    environment: input.environment,
    clientTestFlag: input.clientTestFlag,
    clientIp: clientIp || undefined,
    clientIpHostname,
  });
  return { isTest, clientIp, clientIpHostname };
}
