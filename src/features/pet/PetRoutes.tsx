import { useEffect, useMemo } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { parsePetSpecies, petCreatePath, petLandingPath } from "./catalog";
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
      goToLanding: (nextSpecies) => {
        void navigate(petLandingPath(nextSpecies ?? species));
      },
      goToCreate: (nextSpecies) => {
        const selected = nextSpecies ?? species;
        void navigate(petCreatePath(selected));
      },
      goToCheckout: () => {
        void navigate("/pet/checkout");
      },
      goToOrder: (publicToken) => {
        const token = publicToken || new URLSearchParams(window.location.search).get("token") || "";
        void navigate(token ? `/pet/order?token=${encodeURIComponent(token)}` : "/pet/order");
      },
    }),
    [navigate, species],
  );
}

export function PetLandingRoute() {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const species = parsePetSpecies(pathname.split("/")[2]);
  const navigation = usePetNavigation(species);

  useEffect(() => {
    if (species !== "cat") return;
    const params = new URLSearchParams(search);
    if (params.get("fv")?.toLowerCase() !== "v3") return;
    params.delete("fv");
    const qs = params.toString();
    void navigate(`/pet/cat-v3${qs ? `?${qs}` : ""}`, { replace: true });
  }, [species, search, navigate]);

  if (species === "cat") {
    const params = new URLSearchParams(search);
    if (params.get("fv")?.toLowerCase() === "v3") {
      return null;
    }
  }

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
      checkoutSessionId={params.get("session_id") || undefined}
    />
  );
}
