import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function readSrc(rel: string) {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

describe("Meta CAPI purchase attribution", () => {
  it("createStripeCheckout null-checks order before reading funnel_variant", () => {
    const funnel = readSrc("supabase/functions/pet-funnel/index.ts");
    const idxAction = funnel.indexOf('action === "createStripeCheckout"');
    const slice = funnel.slice(idxAction, idxAction + 900);
    const nullCheck = slice.indexOf('if (!order) return apiError("ORDER_NOT_FOUND"');
    const funnelRead = slice.indexOf("order.funnel_variant");
    expect(idxAction).toBeGreaterThan(-1);
    expect(nullCheck).toBeGreaterThan(-1);
    expect(funnelRead).toBeGreaterThan(-1);
    expect(nullCheck).toBeLessThan(funnelRead);
  });

  it("checkout context sends fbc/fbp for every pet funnel variant", () => {
    const internal = readSrc("src/features/pet/funnelInternal.ts");
    expect(internal).toContain("getMetaCapiClickIds");
    expect(internal).toContain("fbc: metaClick.fbc");
    expect(internal).toContain("fbp: metaClick.fbp");
    expect(internal).toContain("hasMetaClick:");
  });

  it("Stripe metadata persists Meta click cookies for webhook CAPI", () => {
    const funnel = readSrc("supabase/functions/pet-funnel/index.ts");
    expect(funnel).toContain("applyCheckoutAttributionMetadata");
    expect(funnel).toContain("metadata[meta_fbc]");
    expect(funnel).toContain("metadata[meta_fbp]");
    expect(funnel).toContain("metadata[has_meta_click]");
    // Attribution is no longer V3-only.
    expect(funnel).toContain("applyCheckoutAttributionMetadata(params, checkoutCtx, order.funnel_variant)");
  });

  it("CAPI Purchase and InitiateCheckout include fbc/fbp in user_data", () => {
    const meta = readSrc("supabase/functions/_shared/pet/meta.ts");
    expect(meta).toContain("buildMetaCapiUserData");
    expect(meta).toContain("fbc: input.fbc");
    expect(meta).toContain("fbp: input.fbp");
    expect(meta).toContain("user_data: userData");
  });

  it("webhook Purchase uses Stripe meta_fbc and backfills V2 attribution", () => {
    const fulfill = readSrc("supabase/functions/_shared/pet/stripeFulfill.ts");
    expect(fulfill).toContain("attributionFromStripeMetadata");
    expect(fulfill).toContain("loadV2SessionAttribution");
    expect(fulfill).toContain("fbc: attr.fbc");
    expect(fulfill).toContain("p_has_meta_click: attr.has_meta_click");
    expect(fulfill).toContain("p_utm_source: attr.utm_source");
  });

  it("service-role metaCapiTestPurchase uses real CAPI Purchase with test_event_code", () => {
    const funnel = readSrc("supabase/functions/pet-funnel/index.ts");
    const meta = readSrc("supabase/functions/_shared/pet/meta.ts");
    expect(funnel).toContain('action === "metaCapiTestPurchase"');
    expect(funnel).toContain("sendMetaCapiPurchase");
    expect(funnel).toContain("testEventCode");
    expect(funnel).toContain("isServiceRoleRequest");
    expect(meta).toContain("testEventCode");
    expect(meta).toContain("test_event_code");
    expect(meta).toContain("metaCapiPixelId");
  });

  it("stripe-webhook boots: single christmas import and pet Purchase path intact", () => {
    const webhook = readSrc("supabase/functions/stripe-webhook/index.ts");
    expect(webhook.match(/from "\.\.\/_shared\/christmas\/stripeFulfill\.ts"/g)?.length).toBe(1);
    expect(webhook.match(/from "\.\.\/_shared\/pet\/stripeFulfill\.ts"/g)?.length).toBe(1);
    expect(webhook).toContain("handlePetStripeEvent");
    expect(webhook).toContain("handleChristmasStripeEvent");
    // Pet CAPI Purchase lives in shared fulfill loaded by this function.
    const fulfill = readSrc("supabase/functions/_shared/pet/stripeFulfill.ts");
    expect(fulfill).toContain("sendMetaCapiPurchase");
  });

  it("landing fbclid is converted to fbc without analytics fbclid storage", () => {
    const cookies = readSrc("src/features/pet/metaCookies.ts");
    const attribution = readSrc("src/features/pet/funnelAttribution.ts");
    expect(cookies).toContain("buildMetaFbcFromFbclid");
    expect(cookies).toContain("captureMetaCapiClickIdsFromSearch");
    expect(attribution).toContain("captureMetaCapiClickIdsFromSearch");
    expect(attribution).toContain('const { fbclid: _fbclid, ...rest } = incoming');
  });
});
