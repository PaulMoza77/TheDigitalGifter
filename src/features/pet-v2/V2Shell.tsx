import type { ReactNode } from "react";
import { ArrowLeft, PawPrint } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PET_PRODUCT_NAME } from "../pet/types";
import { PET_SPECIES_OPTIONS } from "../pet/catalog";
import { cn } from "@/lib/utils";
import { v2PackOfferCopy } from "./V2PackOffer";
import { petV2LandingPath } from "./analytics";
import type { PetV2Species } from "./types";

export function V2Shell({
  children,
  species,
  showBack,
  onBack,
  onSpecies,
  footer,
  padForSticky,
}: {
  children: ReactNode;
  species: PetV2Species;
  showBack?: boolean;
  onBack?: () => void;
  onSpecies?: (species: PetV2Species) => void;
  footer?: string;
  padForSticky?: boolean;
}) {
  return (
    <div className="pet-funnel min-h-screen bg-[#140e0a] text-[#f6efe4]">
      <div
        className={cn(
          "relative mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 pt-4 sm:px-6",
          padForSticky ? "pb-28" : "pb-10",
        )}
      >
        <header className="flex items-center justify-between gap-3 py-2">
          <a
            href={petV2LandingPath(species)}
            className="flex items-center gap-2 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4a84b]"
          >
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#d4a84b] text-[#1a140e]">
              <PawPrint className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="text-sm font-semibold tracking-tight">{PET_PRODUCT_NAME}</span>
          </a>
          <p className="text-[11px] uppercase tracking-[0.14em] text-[#d4a84b]">Free preview</p>
        </header>

        {onSpecies ? (
          <div
            role="tablist"
            aria-label="Pet type"
            className="mx-auto mt-3 grid w-full max-w-sm grid-cols-3 rounded-full border border-[#f6efe4]/12 bg-[#1a1410] p-1"
          >
            {PET_SPECIES_OPTIONS.map((option) => {
              const selected = option.id === species;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => onSpecies(option.id)}
                  className={cn(
                    "h-11 min-h-[44px] rounded-full text-sm font-semibold tracking-tight transition-colors",
                    selected ? "bg-[#d4a84b] text-[#1a140e]" : "text-[#f6efe4]/70 hover:text-[#f6efe4]",
                  )}
                >
                  {option.label}
                </button>
              );
            })}
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
              Back
            </Button>
          </div>
        ) : null}

        <main className="flex-1 py-5">{children}</main>
        <footer className="mt-8 border-t border-[#f6efe4]/10 pt-5 text-xs text-[#f6efe4]/45">
          <p>
            {footer ?? `${v2PackOfferCopy().headline}. Free preview first — card only if you unlock.`}
          </p>
        </footer>
      </div>
    </div>
  );
}
