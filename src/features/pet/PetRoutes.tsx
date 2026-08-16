import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PetCheckoutPage } from "./PetCheckoutPage";
import { PetCreatePage } from "./PetCreatePage";
import { PetLandingPage } from "./PetLandingPage";
import { PetOrderPage } from "./PetOrderPage";
import { petFunnelApi } from "./supabaseApi";
import type { PetFunnelNavigation } from "./types";

function usePetNavigation(): PetFunnelNavigation {
  const navigate = useNavigate();
  return useMemo(
    () => ({
      goToLanding: () => navigate("/pet"),
      goToCreate: () => navigate("/pet/create"),
      goToCheckout: () => navigate("/pet/checkout"),
      goToOrder: (publicToken) => {
        const token = publicToken || new URLSearchParams(window.location.search).get("token") || "";
        navigate(token ? `/pet/order?token=${encodeURIComponent(token)}` : "/pet/order");
      },
    }),
    [navigate],
  );
}

export function PetLandingRoute() {
  const navigation = usePetNavigation();
  return <PetLandingPage navigation={navigation} />;
}

export function PetCreateRoute() {
  const navigation = usePetNavigation();
  return <PetCreatePage navigation={navigation} />;
}

export function PetCheckoutRoute() {
  const navigation = usePetNavigation();
  return <PetCheckoutPage navigation={navigation} api={petFunnelApi} />;
}

export function PetOrderRoute() {
  const navigation = usePetNavigation();
  const [params] = useSearchParams();
  return (
    <PetOrderPage
      navigation={navigation}
      api={petFunnelApi}
      publicToken={params.get("token") || undefined}
    />
  );
}
