import { PET_SCENES } from "../catalog";
import { SceneCard } from "./SceneCard";

export function SceneGrid({
  heading = "Twelve secret lives",
  description = "Original scenes. Same pet in every frame. No borrowed characters, teams, or magazine covers.",
}: {
  heading?: string;
  description?: string;
}) {
  return (
    <section aria-labelledby="pet-scenes-heading" className="space-y-6">
      <div className="max-w-2xl">
        <p className="text-xs uppercase tracking-[0.22em] text-[#d4a84b]">The gallery</p>
        <h2 id="pet-scenes-heading" className="mt-2 text-3xl font-semibold tracking-tight text-[#f6efe4] sm:text-4xl">
          {heading}
        </h2>
        <p className="mt-3 text-base leading-7 text-[#f6efe4]/72">{description}</p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {PET_SCENES.map((scene, index) => (
          <SceneCard key={scene.id} scene={scene} featured={index === 0} />
        ))}
      </div>
    </section>
  );
}
