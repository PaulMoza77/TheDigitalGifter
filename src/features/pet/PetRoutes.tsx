import { useMemo } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { parsePetSpecies, petLandingPath } from "./catalog";
import { PetCheckoutPage } from "./PetCheckoutPage";
import { PetCreatePage } from "./PetCreatePage";
import { PetLandingPage } from "./PetLandingPage";
import { PetOrderPage } from "./PetOrderPage";
import { petFunnelApi } from "./supabaseApi";
import type { PetFunnelNavigation, PetSpecies } from "./types";

function usePetNavigation(species: PetSpecies = "dog"): PetFunnelNavigation {
  const navigate = useNavigate();
  return useMemo(
    () => ({
      goToLanding: (nextSpecies) => navigate(petLandingPath(nextSpecies ?? species)),
      goToCreate: (nextSpecies) => {
        const selected = nextSpecies ?? species;
        navigate(`/pet/create?species=${encodeURIComponent(selected)}`);
      },
      goToCheckout: () => navigate("/pet/checkout"),
      goToOrder: (publicToken) => {
        const token = publicToken || new URLSearchParams(window.location.search).get("token") || "";
        navigate(token ? `/pet/order?token=${encodeURIComponent(token)}` : "/pet/order");
      },
    }),
    [navigate, species],
  );
}

export function PetLandingRoute() {
  const { pathname } = useLocation();
  const species = parsePetSpecies(pathname.split("/")[2]);
  const navigation = usePetNavigation(species);
  return <PetLandingPage navigation={navigation} species={species} />;
}

export function PetCreateRoute() {
  const [params] = useSearchParams();
  const species = parsePetSpecies(params.get("species"));
  const navigation = usePetNavigation(species);
  return <PetCreatePage navigation={navigation} species={species} />;
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
