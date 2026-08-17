import { useCallback, useEffect, useState } from "react";
import { PET_OFFER } from "./catalog";
import { checkoutAllowedWithOffer, deliveryEstimateLabel } from "./croGuards";
import { petFunnelApi } from "./supabaseApi";
import { formatOfferPrice } from "./videoGuards";

export function usePublicPetOffer() {
  const [priceDisplay, setPriceDisplay] = useState<string>(PET_OFFER.priceDisplay);
  const [amountCents, setAmountCents] = useState<number | null>(null);
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
      setAmountCents(offer.amountCents);
      setPriceDisplay(offer.priceDisplay || formatOfferPrice(offer.amountCents));
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
