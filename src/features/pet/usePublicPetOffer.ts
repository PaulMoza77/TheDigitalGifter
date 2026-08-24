import { useCallback, useEffect, useState } from "react";
import { checkoutAllowedWithOffer, deliveryEstimateLabel } from "./croGuards";
import { petFlashSale } from "./flashSale";
import { petFunnelApi } from "./supabaseApi";
import { formatOfferPrice } from "./videoGuards";

export function usePublicPetOffer() {
  const initial = petFlashSale();
  const [priceDisplay, setPriceDisplay] = useState<string>(initial.priceDisplay);
  const [amountCents, setAmountCents] = useState<number | null>(initial.amountCents);
  const [compareAtDisplay, setCompareAtDisplay] = useState<string | null>(
    initial.active ? initial.compareAtDisplay : null,
  );
  const [saleExpiresAt, setSaleExpiresAt] = useState<string | null>(initial.expiresAt);
  const [saleActive, setSaleActive] = useState(initial.active);
  const [deliveryEstimate, setDeliveryEstimate] = useState(deliveryEstimateLabel());
  const [offerVerified, setOfferVerified] = useState(false);
  const [offerError, setOfferError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setOfferError(null);
    try {
      const offer = await petFunnelApi.getPublicOffer?.();
      if (!offer || offer.amountCents <= 0 || offer.subscription !== false) {
        throw new Error("Pet price is unavailable right now.");
      }
      const sale = petFlashSale();
      const expiresAt = offer.saleExpiresAt || sale.expiresAt;
      const active =
        sale.active &&
        offer.amountCents === sale.amountCents &&
        Boolean(expiresAt && Date.parse(expiresAt) > Date.now());
      setAmountCents(offer.amountCents);
      setPriceDisplay(offer.priceDisplay || formatOfferPrice(offer.amountCents));
      setCompareAtDisplay(active ? offer.compareAtDisplay || sale.compareAtDisplay : null);
      setSaleExpiresAt(active ? expiresAt : null);
      setSaleActive(active);
      setDeliveryEstimate(deliveryEstimateLabel(offer.deliveryEstimate));
      setOfferVerified(true);
    } catch {
      setOfferVerified(false);
      setAmountCents(null);
      setOfferError("Could not verify the current price. You can still continue — checkout stays locked until the price loads.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    priceDisplay,
    amountCents,
    compareAtDisplay,
    saleExpiresAt,
    saleActive,
    deliveryEstimate,
    offerVerified,
    offerError,
    loading,
    checkoutAllowed: checkoutAllowedWithOffer({
      amountCents,
      offerVerified,
    }),
    refresh,
  };
}
