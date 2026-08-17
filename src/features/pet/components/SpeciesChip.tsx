import { PET_SPECIES_OPTIONS } from "../catalog";
import type { PetFunnelNavigation, PetSpecies } from "../types";

export function SpeciesChip({
  species,
  navigation,
}: {
  species: PetSpecies;
  navigation?: PetFunnelNavigation;
}) {
  const label = PET_SPECIES_OPTIONS.find((item) => item.id === species)?.label ?? "Pet";
  return (
    <p className="text-sm text-[#f6efe4]/70">
      {label}
      {" · "}
      <button
        type="button"
        className="min-h-[44px] font-medium text-[#d4a84b] underline-offset-4 hover:underline"
        onClick={() => navigation?.goToLanding(species)}
      >
        Change
      </button>
    </p>
  );
}
