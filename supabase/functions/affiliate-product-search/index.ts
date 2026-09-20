import { optionsResponse, jsonResponse } from "../_shared/cors.ts";
import { assertRateLimit } from "../_shared/rateLimit.ts";
import { assertAdmin, getAuthUser, getServiceClient, readJson } from "../_shared/supabase.ts";
import { AffiliateProductSearchService } from "../_shared/christmas/affiliateProducts/service.ts";
import {
  allProviderHealth,
  ebayProviderStatus,
  missingEbayCredentialNames,
  publicCredentialsFlags,
} from "../_shared/christmas/affiliateProducts/config.ts";
import { createAffiliateReferenceId, isSafeAffiliateReferenceId, validateAffiliateSearchInput } from "../_shared/christmas/affiliateProducts/query.ts";
import { applyAffiliateLookupToGift } from "../_shared/christmas/affiliateProducts/refreshApply.ts";
import type { AffiliateProviderId } from "../_shared/christmas/affiliateProducts/types.ts";

type Body = Record<string, unknown>;

const denoEnv = {
  get(name: string) {
    return Deno.env.get(name);
  },
};

const productService = new AffiliateProductSearchService(denoEnv, fetch);

function publicStatusPayload() {
  const providers = allProviderHealth(denoEnv);
  const ebay = ebayProviderStatus(denoEnv);
  return {
    ok: true,
    enabled: ebay.enabled,
    ebay,
    providers,
    activeProvider: productService.provider().id,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const body = await readJson<Body>(req);
    const action = String(body.action || "search");
    const { user } = await getAuthUser(req);
    if (!user?.id) return jsonResponse({ error: "auth_required" }, 401);

    if (action === "status") {
      return jsonResponse(publicStatusPayload());
    }

    if (action === "admin_status") {
      await assertAdmin(user.email);
      const ebayMissing = missingEbayCredentialNames(denoEnv);
      return jsonResponse({
        ...publicStatusPayload(),
        credentialsPresent: publicCredentialsFlags(denoEnv),
        missingCredentialNames: {
          ebay: ebayMissing,
          awin: publicCredentialsFlags(denoEnv).awin ? [] : ["AWIN_FEED_URL", "AWIN_PUBLISHER_ID"],
        },
        revenue: { status: "awaiting_provider_reporting" },
      });
    }

    if (action === "lookup") {
      return await handleLookup(body, user.id);
    }

    if (action !== "search") return jsonResponse({ error: "unknown_action" }, 400);

    const db = getServiceClient();
    const allowed = await assertRateLimit(db, `affiliate-product-search:${user.id}`, 30, 3600);
    if (!allowed) return jsonResponse({ error: "rate_limited" }, 429);

    const validated = validateAffiliateSearchInput({
      query: String(body.query || ""),
      source: body.source === "idea" ? "idea" : "recipient_search",
      provider: body.provider as AffiliateProviderId | undefined,
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
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.startsWith("Forbidden") || msg.includes("Admin")) return jsonResponse({ error: "forbidden" }, 403);
    console.error("affiliate-product-search", msg);
    return jsonResponse({ error: "provider_unavailable" }, 503);
  }
});

async function handleLookup(body: Body, userId: string) {
  const giftId = String(body.gift_id || "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(giftId)) return jsonResponse({ error: "invalid_gift" }, 400);

  const db = getServiceClient();
  const allowed = await assertRateLimit(db, `affiliate-product-lookup:${userId}`, 40, 3600);
  if (!allowed) return jsonResponse({ error: "rate_limited" }, 429);

  const { data: gift, error } = await db
    .from("christmas_gift_items")
    .select("id,profile_id,url,store,planned_price_minor,actual_price_minor,image_url,price_checked_at,delivery_on,hiding_place,status,idea,selected_gift,source_type,source_meta")
    .eq("id", giftId)
    .maybeSingle();
  if (error || !gift) return jsonResponse({ error: "not_found" }, 404);

  const { data: profile } = await db
    .from("christmas_planner_profiles")
    .select("id,user_id")
    .eq("id", gift.profile_id)
    .maybeSingle();
  if (!profile || profile.user_id !== userId) return jsonResponse({ error: "forbidden" }, 403);
  if (gift.source_type !== "affiliate_product") return jsonResponse({ error: "not_affiliate_gift" }, 400);

  const meta = (gift.source_meta && typeof gift.source_meta === "object" ? gift.source_meta : {}) as Record<string, unknown>;
  const provider = (String(meta.provider || "ebay") as AffiliateProviderId) || "ebay";
  const externalProductId = String(meta.externalProductId || "").trim();
  if (!externalProductId) return jsonResponse({ error: "missing_external_id" }, 400);

  let affiliateReferenceId = String(body.affiliate_reference_id || "");
  if (!isSafeAffiliateReferenceId(affiliateReferenceId)) affiliateReferenceId = createAffiliateReferenceId();

  const lookup = await productService.lookup({
    provider: provider === "awin" || provider === "amazon" ? provider : "ebay",
    externalProductId,
    marketplace: meta.marketplace ? String(meta.marketplace) : null,
    affiliateReferenceId,
  });

  if (!lookup.enabled) {
    return jsonResponse({
      ok: true,
      enabled: false,
      unavailable: false,
      reason: lookup.reason || lookup.status.reason,
      status: lookup.status,
      gift,
    });
  }

  const outcome = applyAffiliateLookupToGift(gift, lookup, new Date().toISOString());
  if (!outcome.ok) {
    return jsonResponse({
      ok: false,
      enabled: lookup.enabled,
      reason: outcome.reason,
      status: lookup.status,
      gift,
    });
  }

  const { error: updateError } = await db.from("christmas_gift_items").update(outcome.patch).eq("id", giftId);
  if (updateError) return jsonResponse({ error: "update_failed" }, 500);

  return jsonResponse({
    ok: true,
    enabled: true,
    unavailable: outcome.kind === "unavailable",
    reason: outcome.kind === "unavailable" ? "item_unavailable" : null,
    status: lookup.status,
    gift: outcome.gift,
    affiliate_reference_id: affiliateReferenceId,
  });
}
