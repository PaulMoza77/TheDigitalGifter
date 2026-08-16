import { useEffect, useState } from "react";
import { PET_OFFER } from "./catalog";
import { petFunnelApi } from "./supabaseApi";
import { formatOfferPrice } from "./videoGuards";

export function usePublicPetOffer() {
  const [priceDisplay, setPriceDisplay] = useState<string>(PET_OFFER.priceDisplay);
  const [amountCents, setAmountCents] = useState<number>(PET_OFFER.priceCents);

  useEffect(() => {
    let cancelled = false;
    void petFunnelApi
      .getPublicOffer?.()
      .then((offer) => {
        if (cancelled || !offer || offer.amountCents <= 0) return;
        setAmountCents(offer.amountCents);
        setPriceDisplay(offer.priceDisplay || formatOfferPrice(offer.amountCents));
      })
      .catch(() => {
        /* Checkout still uses the server-owned snapshot. */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { priceDisplay, amountCents };
}
