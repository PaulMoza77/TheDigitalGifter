import { supabase } from "@/lib/supabase";
import type { GiftItem } from "../planner/types";
import type { AffiliateProduct } from "./index";
import { affiliateSourceRef, plannerGiftOutboundUrl } from "./helpers";

function alreadyHasAffiliateProduct(existing: GiftItem[], product: AffiliateProduct): GiftItem | undefined {
  const ref = affiliateSourceRef(product);
  return existing.find(
    (g) =>
      (g.source_type === "affiliate_product" && g.source_ref === ref) ||
      (g.url && product.affiliateUrl && g.url === product.affiliateUrl),
  );
}

export async function addAffiliateProductToPlanner(input: {
  profileId: string;
  recipientId: string;
  product: AffiliateProduct;
  existing: GiftItem[];
}): Promise<{ gift: GiftItem; duplicate: boolean }> {
  const hit = alreadyHasAffiliateProduct(input.existing, input.product);
  if (hit) return { gift: hit, duplicate: true };

  const title = input.product.title.trim().slice(0, 200);
  const url = plannerGiftOutboundUrl({ url: input.product.affiliateUrl });
  const planned = Math.round(input.product.price * 100);
  const { data, error } = await supabase
    .from("christmas_gift_items")
    .insert({
      profile_id: input.profileId,
      recipient_id: input.recipientId,
      idea: title,
      selected_gift: title,
      url,
      store: input.product.merchant.slice(0, 80),
      planned_price_minor: Number.isFinite(planned) ? planned : null,
      status: "planned",
      source_type: "affiliate_product",
      source_ref: affiliateSourceRef(input.product),
      image_url: input.product.imageUrl?.slice(0, 2000) || null,
      price_checked_at: new Date().toISOString(),
      source_meta: {
        provider: input.product.provider,
        externalProductId: input.product.externalProductId,
        currency: input.product.currency,
        condition: input.product.condition || null,
      },
    })
    .select("*")
    .maybeSingle();
  if (error || !data) throw new Error("Could not add this product to the planner.");
  return { gift: data as GiftItem, duplicate: false };
}
