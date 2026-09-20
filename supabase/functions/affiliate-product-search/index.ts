import { optionsResponse, jsonResponse } from "../_shared/cors.ts";
import { assertRateLimit } from "../_shared/rateLimit.ts";
import { getAuthUser, getServiceClient, readJson } from "../_shared/supabase.ts";
import { AffiliateProductService } from "../_shared/christmas/affiliateProducts/service.ts";
import { ebayProviderStatus, missingEbayCredentialNames } from "../_shared/christmas/affiliateProducts/config.ts";
import { validateAffiliateSearchInput } from "../_shared/christmas/affiliateProducts/query.ts";

type Body = Record<string, unknown>;

const denoEnv = {
  get(name: string) {
    return Deno.env.get(name);
  },
};

const productService = new AffiliateProductService(denoEnv, fetch);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const body = await readJson<Body>(req);
    const action = String(body.action || "search");
    const { user } = await getAuthUser(req);
    if (!user?.id) return jsonResponse({ error: "auth_required" }, 401);

    if (action === "status") {
      const status = ebayProviderStatus(denoEnv);
      return jsonResponse({
        ok: true,
        enabled: status.enabled,
        ebay: status,
        missing: status.code === "DISABLED_MISSING_CREDENTIALS" ? missingEbayCredentialNames(denoEnv) : [],
      });
    }

    if (action !== "search") return jsonResponse({ error: "unknown_action" }, 400);

    const db = getServiceClient();
    const allowed = await assertRateLimit(db, `affiliate-product-search:${user.id}`, 30, 3600);
    if (!allowed) return jsonResponse({ error: "rate_limited" }, 429);

    const validated = validateAffiliateSearchInput({
      query: String(body.query || ""),
      source: body.source === "idea" ? "idea" : "recipient_search",
      countryCode: body.country_code ? String(body.country_code) : null,
      locale: body.locale ? String(body.locale) : "en",
      currency: body.currency ? String(body.currency) : null,
      priceMinMinor: body.price_min_minor as number | null,
      priceMaxMinor: body.price_max_minor as number | null,
      condition: body.condition === "new" ? "new" : "any",
      limit: body.limit as number | null,
      deliveryCountry: body.delivery_country ? String(body.delivery_country) : null,
      affiliateReferenceId: body.affiliate_reference_id ? String(body.affiliate_reference_id) : null,
      ideaTitle: body.idea_title ? String(body.idea_title) : null,
      searchQuery: body.search_query ? String(body.search_query) : null,
      interests: body.interests ? String(body.interests).slice(0, 120) : null,
      vibeKeys: Array.isArray(body.vibe_keys) ? body.vibe_keys.map(String).slice(0, 6) : null,
      relationshipCategory: body.relationship_category ? String(body.relationship_category).slice(0, 40) : null,
    });
    if (!validated.ok) return jsonResponse({ error: validated.error }, 400);

    const result = await productService.search(validated.value);
    return jsonResponse({
      ok: result.ok,
      enabled: result.enabled,
      provider: result.provider,
      marketplace: result.marketplace,
      products: result.products,
      cached: Boolean(result.cached),
      reason: result.reason || null,
      status: result.status,
      affiliate_reference_id: validated.value.affiliateReferenceId,
    });
  } catch (error) {
    console.error("affiliate-product-search", error instanceof Error ? error.message : error);
    return jsonResponse({ error: "provider_unavailable" }, 503);
  }
});
