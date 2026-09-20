import { providerHealth } from "./health.ts";
import type { AffiliateProviderHealth, AffiliateProviderId } from "./types.ts";

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

export function ebayCredentialsPresent(env: AffiliateEnv): boolean {
  const creds = readEbayCredentials(env);
  return Boolean(creds.clientId && creds.clientSecret && creds.campaignId);
}

export function affiliateSearchEnabled(env: AffiliateEnv): boolean {
  return truthyFlag(env.get("AFFILIATE_PRODUCT_SEARCH_ENABLED"));
}

export function ebayProductionAccessAllowed(env: AffiliateEnv): boolean {
  const raw = env.get("EBAY_PRODUCTION_ACCESS");
  if (raw == null || String(raw).trim() === "") return false;
  return truthyFlag(raw);
}

export function ebayProviderStatus(env: AffiliateEnv): AffiliateProviderHealth {
  return providerHealth({
    provider: "ebay",
    featureEnabled: affiliateSearchEnabled(env),
    configured: ebayCredentialsPresent(env),
    productionAccess: ebayProductionAccessAllowed(env),
  });
}

export function missingEbayCredentialNames(env: AffiliateEnv): string[] {
  const creds = readEbayCredentials(env);
  const missing: string[] = [];
  if (!creds.clientId) missing.push("EBAY_CLIENT_ID");
  if (!creds.clientSecret) missing.push("EBAY_CLIENT_SECRET");
  if (!creds.campaignId) missing.push("EBAY_EPN_CAMPAIGN_ID");
  return missing;
}

export function readAwinConfig(env: AffiliateEnv): {
  feedUrl: string;
  publisherId: string;
} {
  return {
    feedUrl: String(env.get("AWIN_FEED_URL") || "").trim(),
    publisherId: String(env.get("AWIN_PUBLISHER_ID") || "").trim(),
  };
}

export function awinCredentialsPresent(env: AffiliateEnv): boolean {
  const cfg = readAwinConfig(env);
  return Boolean(cfg.feedUrl && cfg.publisherId);
}

export function awinSearchEnabled(env: AffiliateEnv): boolean {
  return truthyFlag(env.get("AWIN_PRODUCT_SEARCH_ENABLED"));
}

export function awinProductionAccessAllowed(env: AffiliateEnv): boolean {
  const raw = env.get("AWIN_PRODUCTION_ACCESS");
  if (raw == null || String(raw).trim() === "") return false;
  return truthyFlag(raw);
}

export function awinProviderStatus(env: AffiliateEnv): AffiliateProviderHealth {
  return providerHealth({
    provider: "awin",
    featureEnabled: awinSearchEnabled(env),
    configured: awinCredentialsPresent(env),
    productionAccess: awinProductionAccessAllowed(env),
    implemented: false,
  });
}

export function amazonProviderStatus(): AffiliateProviderHealth {
  return providerHealth({
    provider: "amazon",
    featureEnabled: false,
    configured: false,
    productionAccess: false,
    implemented: false,
  });
}

export function activeAffiliateProvider(env: AffiliateEnv): AffiliateProviderId {
  const raw = String(env.get("AFFILIATE_SEARCH_PROVIDER") || "ebay").trim().toLowerCase();
  if (raw === "awin" || raw === "amazon" || raw === "ebay") return raw;
  return "ebay";
}

export function allProviderHealth(env: AffiliateEnv): AffiliateProviderHealth[] {
  return [ebayProviderStatus(env), awinProviderStatus(env), amazonProviderStatus()];
}

export function publicCredentialsFlags(env: AffiliateEnv): {
  ebay: boolean;
  awin: boolean;
  amazon: boolean;
} {
  return {
    ebay: ebayCredentialsPresent(env),
    awin: awinCredentialsPresent(env),
    amazon: false,
  };
}
