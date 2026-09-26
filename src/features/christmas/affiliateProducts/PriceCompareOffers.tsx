import type { AffiliateProduct } from "../../../../supabase/functions/_shared/christmas/affiliateProducts/types.ts";
import { groupShoppingOffers } from "./shoppingOffers";
import { AffiliateProductImage } from "./AffiliateProductImage";

function money(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currency.toUpperCase() }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

function freshness(checkedAt: string | null): string {
  if (!checkedAt) return "Checked time unknown";
  const t = Date.parse(checkedAt);
  if (!Number.isFinite(t)) return "Checked time unknown";
  const mins = Math.round((Date.now() - t) / 60000);
  if (mins < 5) return "Just checked";
  if (mins < 60) return `Checked ${mins}m ago`;
  return `Checked ${checkedAt.slice(0, 16).replace("T", " ")} UTC`;
}

export function PriceCompareOffers({
  products,
  onAdd,
  onView,
  addingKey,
}: {
  products: AffiliateProduct[];
  onAdd: (p: AffiliateProduct) => void;
  onView: (p: AffiliateProduct) => void;
  addingKey: string | null;
}) {
  const grouped = groupShoppingOffers(products);
  if (grouped.mode !== "compare") {
    return (
      <div className="tdg-price-compare is-single">
        {products.map((product) => {
          const key = `${product.provider}:${product.externalProductId}`;
          return (
            <article key={key} className="tdg-concierge-row tdg-aff-row">
              <AffiliateProductImage product={product} />
              <div className="tdg-aff-copy">
                <h3>{product.title}</h3>
                <p className="tdg-concierge-meta">
                  <span>{money(product.price, product.currency)}</span>
                  <span>{product.merchant}</span>
                  {product.condition ? <span>{product.condition}</span> : null}
                </p>
                <div className="tdg-concierge-row-actions">
                  <button type="button" className="tdg-planner-btn primary" disabled={Boolean(addingKey)} onClick={() => onAdd(product)}>
                    {addingKey === key ? "Adding…" : "Add to Gift Plan"}
                  </button>
                  <button type="button" className="tdg-planner-linkish" onClick={() => onView(product)}>
                    View product ↗
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    );
  }

  const { comparison } = grouped;
  return (
    <div className="tdg-price-compare">
      <p className="tdg-planner-muted">Exact match using product identifiers · not similar titles.</p>
      {comparison.offers.map((offer) => {
        const key = `${offer.provider}:${offer.externalProductId}`;
        const lowest = comparison.lowest && comparison.lowest.provider === offer.provider && comparison.lowest.externalProductId === offer.externalProductId;
        return (
          <article key={key} className="tdg-concierge-row tdg-aff-row">
            <AffiliateProductImage product={offer} />
            <div className="tdg-aff-copy">
              <h3>{offer.title}</h3>
              <p className="tdg-concierge-meta">
                <span>{money(offer.price, offer.currency)}</span>
                <span>{offer.merchant}</span>
                {offer.condition ? <span>{offer.condition}</span> : null}
                {lowest ? <span className="tdg-price-lowest">Lowest current offer</span> : null}
              </p>
              {offer.deliveryStart || offer.deliveryEnd ? (
                <p className="tdg-concierge-meta">
                  Delivery {offer.deliveryStart || ""}
                  {offer.deliveryEnd ? `–${offer.deliveryEnd}` : ""}
                </p>
              ) : null}
              <p className="tdg-planner-muted">{freshness(offer.checkedAt)}</p>
              <div className="tdg-concierge-row-actions">
                <button type="button" className="tdg-planner-btn primary" disabled={Boolean(addingKey)} onClick={() => onAdd({ ...offer, checkedAt: offer.checkedAt || undefined })}>
                  {addingKey === key ? "Adding…" : "Add to Gift Plan"}
                </button>
                <a className="tdg-planner-linkish" href={offer.affiliateUrl} target="_blank" rel="noreferrer sponsored" onClick={() => onView({ ...offer, checkedAt: offer.checkedAt || undefined })}>
                  Buy via {offer.merchant} ↗
                </a>
              </div>
            </div>
          </article>
        );
      })}
      {comparison.currencies.length > 1 ? (
        <p className="tdg-planner-muted">Prices are in different currencies, so we do not rank a cheapest offer.</p>
      ) : null}
    </div>
  );
}
