import { PET_LANDING_COPY, PET_OTHER_SUBJECTS, PET_SCENES } from "../catalog";
import { mixedOtherGalleryLabel } from "../croGuards";
import type { PetSpecies } from "../types";
import { SceneCard } from "./SceneCard";

export function SceneGrid({
  species = "dog",
  heading,
  description,
}: {
  species?: PetSpecies;
  heading?: string;
  description?: string;
}) {
  const copy = PET_LANDING_COPY[species];
  const mixed = species === "other";

  return (
    <section aria-labelledby="pet-scenes-heading" className="space-y-5">
      <div className="max-w-xl">
        <h2
          id="pet-scenes-heading"
          className="text-2xl font-semibold tracking-tight text-[#f6efe4] sm:text-3xl"
        >
          {heading ?? copy.heading}
        </h2>
        <p className="mt-2 text-sm leading-6 text-[#f6efe4]/65">
          {description ?? copy.description}
        </p>
        {mixed ? (
          <p className="mt-1 text-xs uppercase tracking-[0.14em] text-[#d4a84b]">
            {mixedOtherGalleryLabel()}
          </p>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 sm:gap-3">
        {PET_SCENES.map((scene, index) => (
          <SceneCard
            key={scene.id}
            scene={scene}
            species={species}
            overlayTitle={mixed ? PET_OTHER_SUBJECTS[scene.id] : scene.title}
            eager={index < 2}
          />
        ))}
      </div>
    </section>
  );
}
