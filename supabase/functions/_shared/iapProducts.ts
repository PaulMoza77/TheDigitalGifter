/**
 * Resolve Apple product ID → Admin pricing_items credit pack.
 * Credits come from the database · never from the client.
 */

export const APPLE_BUNDLE_ID = "com.thedigitalgifter.app";

/** Audited ASC IDs used only when metadata.apple_product_id is not yet seeded. */
const FALLBACK_APPLE_ID_BY_PACK_KEY: Record<string, string> = {
  starter: "com.thedigitalgifter.app.credits.starter",
  creator: "com.thedigitalgifter.app.credits.creator",
  pro: "com.thedigitalgifter.app.credits.pro",
  enterprise: "com.thedigitalgifter.app.credits.enterprise",
};

export type PricingCreditPack = {
  productId: string;
  packKey: string;
  credits: number;
  name: string;
};

type ServiceClient = {
  from: (table: string) => {
    select: (cols: string) => {
      in: (col: string, vals: string[]) => {
        [key: string]: any;
      };
      [key: string]: any;
    };
  };
};

function appleIdFromMetadata(metadata: Record<string, unknown> | null | undefined): string {
  if (!metadata || typeof metadata !== "object") return "";
  return String(
    metadata.apple_product_id ?? metadata.appleProductId ?? metadata.apple_sku ?? ""
  )
    .trim()
    .toLowerCase();
}

export async function lookupCreditPackByAppleProductId(
  service: ServiceClient,
  productId: string
): Promise<PricingCreditPack | null> {
  const wanted = String(productId || "")
    .trim()
    .toLowerCase();
  if (!wanted) return null;

  const { data, error } = await service
    .from("pricing_items")
    .select("key,name,credits,active,is_active,category,metadata,sort_order")
    .in("category", ["credit_pack", "credits"]);

  if (error) throw error;

  const rows = (data ?? []) as Array<{
    key: string;
    name: string | null;
    credits: number | null;
    active: boolean | null;
    is_active: boolean | null;
    metadata: Record<string, unknown> | null;
    sort_order: number | null;
  }>;

  const matches = rows
    .filter((row) => {
      if (row.active === false || row.is_active === false) return false;
      const fromMeta = appleIdFromMetadata(row.metadata);
      const fromFallback = String(
        FALLBACK_APPLE_ID_BY_PACK_KEY[String(row.key || "").trim()] || ""
      ).toLowerCase();
      const mapped = fromMeta || fromFallback;
      return mapped === wanted;
    })
    .sort((a, b) => Number(a.sort_order ?? 999) - Number(b.sort_order ?? 999));

  const row = matches[0];
  if (!row) return null;

  const credits = Math.round(Number(row.credits ?? 0));
  if (!Number.isFinite(credits) || credits < 1) return null;

  return {
    productId: String(productId).trim(),
    packKey: String(row.key || "").trim(),
    credits,
    name: String(row.name || row.key || "Credits").trim(),
  };
}
