import { PET_SPECIES_OPTIONS } from "../catalog";
import type { PetFunnelNavigation, PetSpecies } from "../types";
import { cn } from "@/lib/utils";

export function SpeciesSwitch({
  value,
  navigation,
}: {
  value: PetSpecies;
  navigation?: PetFunnelNavigation;
}) {
  return (
    <div
      role="tablist"
      aria-label="Pet type"
      className="grid grid-cols-3 rounded-full border border-[#f6efe4]/12 bg-[#1a1410] p-1"
    >
      {PET_SPECIES_OPTIONS.map((option) => {
        const selected = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => navigation?.goToLanding(option.id)}
            className={cn(
                "h-11 min-h-[44px] rounded-full text-sm font-semibold tracking-tight transition-colors",
              selected
                ? "bg-[#d4a84b] text-[#1a140e]"
                : "text-[#f6efe4]/70 hover:text-[#f6efe4]"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
