/**
 * Account Christmas hub links — suite navigation only.
 * Does not include /send-a-gift (primary e6f4 loop ownership).
 */

import { hubProducts, type ChristmasProductDef } from "./catalog";

export type AccountChristmasLink = {
  productKey: string;
  title: string;
  description: string;
  to: string;
  status: "open" | "coming_soon";
};

const ACCOUNT_PREFERRED_KEYS = [
  "christmas_photo",
  "christmas_family",
  "christmas_couple",
  "christmas_pet",
  "christmas_santa_video",
  "christmas_tree",
  "christmas_advent",
  "christmas_wishlist",
  "christmas_gift_finder",
  "christmas_card",
  "christmas_messages",
] as const;

/** Kids stays privacy-blocked until a dedicated product task. */
export const ACCOUNT_CHRISTMAS_KIDS_NOTE =
  "Kids Christmas generation is not available yet — privacy controls are required before launch.";

export function accountChristmasLinks(
  catalog: ChristmasProductDef[],
): AccountChristmasLink[] {
  const discoverable = hubProducts(catalog);
  return ACCOUNT_PREFERRED_KEYS.map((key) => {
    const product = discoverable.find((p) => p.productKey === key);
    if (!product) return null;
    return {
      productKey: product.productKey,
      title: product.name,
      description: product.description,
      to: product.routePath,
      status: "open" as const,
    };
  }).filter((row): row is AccountChristmasLink => Boolean(row));
}
