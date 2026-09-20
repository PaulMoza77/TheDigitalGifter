import type { AffiliateProviderStatus } from "./types.ts";

export type AffiliateEnv = {
  get(name: string): string | undefined;
};

export function truthyFlag(value: string | undefined): boolean {
  const v = String(value || "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

export function readEbayCredentials(env: AffiliateEnv): {
  clientId: string;
  clientSecret: string;
  campaignId: string;
} {
  return {
    clientId: String(env.get("EBAY_CLIENT_ID") || "").trim(),
    clientSecret: String(env.get("EBAY_CLIENT_SECRET") || "").trim(),
    campaignId: String(env.get("EBAY_EPN_CAMPAIGN_ID") || "").trim(),
  };
}

export function affiliateSearchEnabled(env: AffiliateEnv): boolean {
  return truthyFlag(env.get("AFFILIATE_PRODUCT_SEARCH_ENABLED"));
}

export function ebayProductionAccessAllowed(env: AffiliateEnv): boolean {
  const raw = env.get("EBAY_PRODUCTION_ACCESS");
  if (raw == null || String(raw).trim() === "") return false;
  return truthyFlag(raw);
}

export function ebayProviderStatus(env: AffiliateEnv): AffiliateProviderStatus {
  if (!affiliateSearchEnabled(env)) {
    return { provider: "ebay", code: "DISABLED_FEATURE_FLAG", enabled: false };
  }
  const creds = readEbayCredentials(env);
  if (!creds.clientId || !creds.clientSecret || !creds.campaignId) {
    return { provider: "ebay", code: "DISABLED_MISSING_CREDENTIALS", enabled: false };
  }
  if (!ebayProductionAccessAllowed(env)) {
    return { provider: "ebay", code: "DISABLED_NO_PRODUCTION_ACCESS", enabled: false };
  }
  return { provider: "ebay", code: "ENABLED", enabled: true };
}

export function missingEbayCredentialNames(env: AffiliateEnv): string[] {
  const creds = readEbayCredentials(env);
  const missing: string[] = [];
  if (!creds.clientId) missing.push("EBAY_CLIENT_ID");
  if (!creds.clientSecret) missing.push("EBAY_CLIENT_SECRET");
  if (!creds.campaignId) missing.push("EBAY_EPN_CAMPAIGN_ID");
  return missing;
}
