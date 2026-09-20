import type {
  AffiliateProviderHealth,
  AffiliateProviderId,
  AffiliateProviderStatusCode,
} from "./types.ts";

export function providerHealth(input: {
  provider: AffiliateProviderId;
  featureEnabled: boolean;
  configured: boolean;
  productionAccess: boolean;
  implemented?: boolean;
  degraded?: boolean;
}): AffiliateProviderHealth {
  const implemented = input.implemented !== false;
  let reason: AffiliateProviderStatusCode;
  if (!implemented) reason = "DISABLED_NOT_IMPLEMENTED";
  else if (!input.featureEnabled) reason = "DISABLED_FEATURE_FLAG";
  else if (!input.configured) reason = "DISABLED_MISSING_CREDENTIALS";
  else if (!input.productionAccess) reason = "DISABLED_NO_PRODUCTION_ACCESS";
  else if (input.degraded) reason = "DEGRADED";
  else reason = "READY";

  const enabled = reason === "READY" || reason === "DEGRADED";
  return {
    provider: input.provider,
    enabled,
    configured: input.configured,
    productionAccess: input.productionAccess,
    reason,
    code: reason,
  };
}

export function disabledSearchResult(
  status: AffiliateProviderHealth,
  marketplace: string | null,
): {
  ok: true;
  enabled: false;
  provider: AffiliateProviderHealth["provider"];
  marketplace: string | null;
  products: [];
  status: AffiliateProviderHealth;
  reason: AffiliateProviderStatusCode;
} {
  return {
    ok: true,
    enabled: false,
    provider: status.provider,
    marketplace,
    products: [],
    status,
    reason: status.reason,
  };
}

export function disabledLookupResult(
  status: AffiliateProviderHealth,
  marketplace: string | null,
): {
  ok: true;
  enabled: false;
  provider: AffiliateProviderHealth["provider"];
  marketplace: string | null;
  product: null;
  unavailable: false;
  status: AffiliateProviderHealth;
  reason: AffiliateProviderStatusCode;
} {
  return {
    ok: true,
    enabled: false,
    provider: status.provider,
    marketplace,
    product: null,
    unavailable: false,
    status,
    reason: status.reason,
  };
}
