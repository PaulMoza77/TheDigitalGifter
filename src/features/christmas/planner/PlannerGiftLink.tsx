import { trackPlannerEvent } from "./analytics";
import { formatPlannerMoney } from "./intelligence";
import type { GiftItem } from "./types";
import { plannerGiftOutboundUrl, snapshotPriceLabel } from "../affiliateProducts/helpers";
import { getOrCreateAffiliateReferenceId } from "../affiliateProducts/client";

export function PlannerGiftOutboundLink({
  gift,
  source = "planner",
}: {
  gift: Pick<GiftItem, "url" | "source_type" | "source_meta">;
  source?: string;
}) {
  const href = plannerGiftOutboundUrl(gift);
  if (!href) return null;
  const provider =
    gift.source_type === "affiliate_product"
      ? String((gift.source_meta as { provider?: string } | null)?.provider || "ebay")
      : undefined;
  return (
    <a
      className="tdg-planner-linkish"
      href={href}
      target="_blank"
      rel="sponsored noopener noreferrer"
      onClick={() => {
        trackPlannerEvent("affiliate_product_clicked", {
          module: "gifts",
          metadata: {
            provider,
            source,
            affiliate_reference_id: getOrCreateAffiliateReferenceId(),
          },
        });
      }}
    >
      View product ↗
    </a>
  );
}

export function PlannerGiftPriceLabel({
  gift,
  currency,
}: {
  gift: Pick<GiftItem, "planned_price_minor" | "source_type" | "price_checked_at" | "source_meta">;
  currency: string;
}) {
  const added =
    gift.source_type === "affiliate_product" &&
    gift.source_meta &&
    typeof (gift.source_meta as { addedPriceMinor?: number }).addedPriceMinor === "number"
      ? (gift.source_meta as { addedPriceMinor: number }).addedPriceMinor
      : gift.planned_price_minor;
  if (!added) return null;
  const formatted = formatPlannerMoney(added, currency);
  const label = snapshotPriceLabel({ ...gift, planned_price_minor: added }, formatted);
  return <span>{label || formatted}</span>;
}
