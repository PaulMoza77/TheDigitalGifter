import { useEffect, useMemo } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { parsePetSpecies, petCreatePath, petLandingPath } from "./catalog";
import { parsePetLocalePath, usePetBrowserLocaleRedirect, withPetLocale, usePetLocale } from "./i18n";
import { PetCheckoutPage } from "./PetCheckoutPage";
import { PetCreatePage } from "./PetCreatePage";
import { PetLandingPage } from "./PetLandingPage";
import { PetOrderPage } from "./PetOrderPage";
import { petFunnelApi } from "./supabaseApi";
import type { PetFunnelNavigation, PetSpecies } from "./types";

function usePetNavigation(species: PetSpecies = "dog"): PetFunnelNavigation {
  const navigate = useNavigate();
  const locale = usePetLocale();
  return useMemo(
    () => ({
      goToLanding: (nextSpecies) => {
        void navigate(withPetLocale(petLandingPath(nextSpecies ?? species), locale));
      },
      goToCreate: (nextSpecies) => {
        const selected = nextSpecies ?? species;
        void navigate(withPetLocale(petCreatePath(selected), locale));
      },
      goToCheckout: () => {
        void navigate(withPetLocale("/pet/checkout", locale));
      },
      goToOrder: (publicToken) => {
        const token = publicToken || new URLSearchParams(window.location.search).get("token") || "";
        if (token) {
          void navigate(`${withPetLocale("/pet/order", locale)}?token=${encodeURIComponent(token)}`);
        } else {
          void navigate(withPetLocale("/pet/order", locale));
        }
      },
    }),
    [navigate, species, locale],
  );
}

export function PetLandingRoute() {
  usePetBrowserLocaleRedirect();
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const locale = usePetLocale();
  const { basePath } = parsePetLocalePath(pathname);
  const species = parsePetSpecies(basePath.split("/")[2]);
  const navigation = usePetNavigation(species);

  useEffect(() => {
    if (species !== "cat") return;
    const params = new URLSearchParams(search);
    if (params.get("fv")?.toLowerCase() !== "v3") return;
    params.delete("fv");
    const qs = params.toString();
    void navigate(`${withPetLocale("/pet/cat-v3", locale)}${qs ? `?${qs}` : ""}`, { replace: true });
  }, [species, search, navigate, locale]);

  if (species === "cat") {
    const params = new URLSearchParams(search);
    if (params.get("fv")?.toLowerCase() === "v3") {
      return null;
    }
  }

  return <PetLandingPage navigation={navigation} species={species} />;
}

export function PetCreateRoute() {
  usePetBrowserLocaleRedirect();
  const [params] = useSearchParams();
  const species = parsePetSpecies(params.get("species"));
  const navigation = usePetNavigation(species);
  return <PetCreatePage navigation={navigation} species={species} />;
}

export function PetCheckoutRoute() {
  usePetBrowserLocaleRedirect();
  const navigation = usePetNavigation();
  return <PetCheckoutPage navigation={navigation} api={petFunnelApi} />;
}

export function PetOrderRoute() {
  usePetBrowserLocaleRedirect();
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
