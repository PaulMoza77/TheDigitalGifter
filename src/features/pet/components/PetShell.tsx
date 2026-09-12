import type { ReactNode } from "react";
import { ArrowLeft, PawPrint } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PET_PRODUCT_NAME } from "../types";
import type { PetFunnelNavigation, PetSpecies } from "../types";
import { PetLanguageSwitcher, usePetLocale, usePetT } from "../i18n";
import { usePublicPetOffer } from "../usePublicPetOffer";
import { SalePriceLabel } from "./SaleOffer";
import { SpeciesSwitch } from "./SpeciesSwitch";

export function PetShell({
  children,
  navigation,
  species = "dog",
  showSpeciesSwitch = false,
  showBack = false,
  backLabel,
  onBack,
  footerNote,
}: {
  children: ReactNode;
  navigation?: PetFunnelNavigation;
  species?: PetSpecies;
  showSpeciesSwitch?: boolean;
  showBack?: boolean;
  backLabel?: string;
  onBack?: () => void;
  footerNote?: string;
}) {
  const locale = usePetLocale();
  const t = usePetT(locale);
  const { priceDisplay, compareAtDisplay } = usePublicPetOffer();
  return (
    <div className="pet-funnel min-h-screen bg-[#140e0a] text-[#f6efe4]" lang={locale}>
      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between gap-3 py-2">
          <button
            type="button"
            onClick={() => navigation?.goToLanding(species)}
            className="flex items-center gap-2 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4a84b]"
          >
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#d4a84b] text-[#1a140e]">
              <PawPrint className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="text-sm font-semibold tracking-tight">
              {t("v1.product.name") || PET_PRODUCT_NAME}
            </span>
          </button>
          <div className="flex items-center gap-3">
            <PetLanguageSwitcher compact />
            <div className="text-right">
              <p className="text-xs text-[#f6efe4]/55">
                <SalePriceLabel
                  priceDisplay={priceDisplay}
                  compareAtDisplay={compareAtDisplay}
                  suffix="once"
                />
              </p>
            </div>
          </div>
        </header>

        {showSpeciesSwitch ? (
          <div className="mx-auto mt-3 w-full max-w-sm">
            <SpeciesSwitch value={species} navigation={navigation} />
          </div>
        ) : null}

        {showBack ? (
          <div className="mt-1">
            <Button
              type="button"
              variant="ghost"
              className="h-9 px-0 text-[#f6efe4]/70 hover:bg-transparent hover:text-[#f6efe4]"
              onClick={onBack}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              {backLabel ?? t("chrome.back")}
            </Button>
          </div>
        ) : null}

        <main className="flex-1 py-6">{children}</main>

        <footer className="mt-8 border-t border-[#f6efe4]/10 pt-5 text-xs text-[#f6efe4]/45">
          <p>
            {footerNote ?? (
              <>
                <SalePriceLabel
                  priceDisplay={priceDisplay}
                  compareAtDisplay={compareAtDisplay}
                  suffix="one-time"
                />
                {" · "}
                {t("v1.offer.noSub")}
                {" · "}
                {t("v1.offer.include.portraits")}
              </>
            )}
          </p>
        </footer>
      </div>
    </div>
  );
}
