import { trackPlannerEvent } from "./analytics";
import { formatPlannerMoney } from "./intelligence";
import type { GiftItem } from "./types";
import { plannerGiftOutboundUrl, snapshotPriceLabel } from "../affiliateProducts/helpers";

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
      rel="noopener noreferrer sponsored"
      onClick={() => {
        trackPlannerEvent("affiliate_product_clicked", {
          module: "gifts",
          metadata: { provider, source },
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
  gift: Pick<GiftItem, "planned_price_minor" | "source_type" | "price_checked_at">;
  currency: string;
}) {
  if (!gift.planned_price_minor) return null;
  const formatted = formatPlannerMoney(gift.planned_price_minor, currency);
  const label = snapshotPriceLabel(gift, formatted);
  return <span>{label || formatted}</span>;
}
