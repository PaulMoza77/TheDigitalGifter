import { useEffect, useRef, useState } from "react";
import { CustomStripeCheckout } from "@/features/pet/components/CustomStripeCheckout";
import { trackChristmasEvent } from "../analytics";
import {
  formatServerPrice,
  listPortraitAovOffers,
  type PortraitAovOfferView,
  type PortraitAovPackageKey,
} from "../upsells";
import { startChristmasUpsellCheckout, type ChristmasUpsellOfferDto } from "../photoApi";

type Props = {
  productKey: string;
  publicToken: string | null;
  orderId: string | null;
  serverOffers?: ChristmasUpsellOfferDto[] | null;
};

function mergeOffers(
  productKey: string,
  serverOffers?: ChristmasUpsellOfferDto[] | null,
): PortraitAovOfferView[] {
  const seed = listPortraitAovOffers({ productKey });
  if (!serverOffers?.length) return seed;
  const byKey = new Map(serverOffers.map((row) => [row.packageKey, row]));
  return seed.map((offer) => {
    const row = byKey.get(offer.packageKey);
    if (!row) return offer;
    return {
      ...offer,
      packageName: row.packageName || offer.packageName,
      description: row.description || offer.description,
      features: Array.isArray(row.features) ? row.features : offer.features,
      currency: (row.currency as PortraitAovOfferView["currency"]) || offer.currency,
      amountCents: row.amountCents,
      purchasable: Boolean(row.purchasable && row.amountCents && row.amountCents > 0),
      extraCount: row.extraCount || offer.extraCount,
      purchased: Boolean(row.purchased),
    };
  });
}

export function PortraitAovUpsellPanel({ productKey, publicToken, orderId, serverOffers }: Props) {
  const offers = mergeOffers(productKey, serverOffers);
  const viewed = useRef(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkout, setCheckout] = useState<{
    packageKey: PortraitAovPackageKey;
    clientSecret: string;
    publishableKey: string;
    amountCents: number;
    currency: string;
  } | null>(null);

  useEffect(() => {
    if (viewed.current || !offers.length) return;
    viewed.current = true;
    void trackChristmasEvent("upsell_viewed", {
      productKey,
      orderId,
      metadata: {
        kind: "portrait_aov",
        package_keys: offers.map((o) => o.packageKey),
      },
    });
  }, [offers, orderId, productKey]);

  async function startUpsell(offer: PortraitAovOfferView) {
    if (!offer.purchasable || offer.amountCents == null || !publicToken) return;
    setBusyKey(offer.packageKey);
    setError(null);
    try {
      void trackChristmasEvent("checkout_started", {
        productKey,
        packageKey: offer.packageKey,
        orderId,
        amountCents: offer.amountCents,
        metadata: { kind: "portrait_aov" },
      });
      const session = await startChristmasUpsellCheckout({
        product_key: productKey,
        package_key: offer.packageKey,
        parent_public_token: publicToken,
      });
      setCheckout({
        packageKey: offer.packageKey,
        clientSecret: session.clientSecret,
        publishableKey: session.publishableKey,
        amountCents: session.amountCents,
        currency: session.currency,
      });
    } catch (err) {
      const code = (err as Error & { code?: string }).code;
      setError(
        code === "checkout_disabled" || code === "not_purchasable" || code === "invalid_price"
          ? "This add-on is not available for purchase yet."
          : err instanceof Error
            ? err.message
            : "Could not start checkout",
      );
    } finally {
      setBusyKey(null);
    }
  }

  if (!offers.length) return null;

  return (
    <section className="mt-6 space-y-3 rounded-lg border border-slate-200 p-4">
      <h3 className="text-sm font-medium text-slate-900">Add more to this portrait</h3>
      <p className="text-xs text-slate-500">
        Extra images, extra styles, or a short video — prices come from the server catalog, never from
        this page.
      </p>
      <ul className="space-y-3">
        {offers.map((offer) => (
          <li key={offer.packageKey} className="rounded-md border border-slate-100 p-3">
            <div className="text-sm font-medium">{offer.packageName}</div>
            <p className="mt-1 text-xs text-slate-600">{offer.description}</p>
            {offer.purchased ? (
              <p className="mt-2 text-xs text-emerald-700">Added to this order</p>
            ) : offer.purchasable && offer.amountCents != null && publicToken ? (
              <button
                type="button"
                className="mt-2 rounded-md bg-slate-900 px-3 py-2 text-xs font-medium text-white"
                disabled={busyKey === offer.packageKey}
                onClick={() => void startUpsell(offer)}
              >
                {busyKey === offer.packageKey
                  ? "Preparing…"
                  : `Add ${formatServerPrice(offer.amountCents, offer.currency)}`}
              </button>
            ) : (
              <p className="mt-2 text-xs text-amber-800">Price unpublished — not purchasable yet.</p>
            )}
          </li>
        ))}
      </ul>
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
      {checkout ? (
        <div className="pt-2">
          <CustomStripeCheckout
            clientSecret={checkout.clientSecret}
            publishableKey={checkout.publishableKey}
            dueDisplay={formatServerPrice(checkout.amountCents, checkout.currency)}
            returnUrl={`${window.location.origin}${window.location.pathname}?upsell=success&token=${encodeURIComponent(publicToken || "")}`}
            onReady={() => {
              void trackChristmasEvent("payment_sheet_opened", {
                productKey,
                packageKey: checkout.packageKey,
                orderId,
                amountCents: checkout.amountCents,
                metadata: { kind: "portrait_aov" },
              });
            }}
          />
        </div>
      ) : null}
    </section>
  );
}
