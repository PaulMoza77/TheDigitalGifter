import { PET_SCENES } from "../catalog";
import { SceneCard } from "./SceneCard";

export function SceneGrid({
  heading = "Twelve secret lives",
  description = "Same pet. A different world in every frame.",
}: {
  heading?: string;
  description?: string;
}) {
  return (
    <section aria-labelledby="pet-scenes-heading" className="space-y-5">
      <div className="max-w-xl">
        <h2
          id="pet-scenes-heading"
          className="text-2xl font-semibold tracking-tight text-[#f6efe4] sm:text-3xl"
        >
          {heading}
        </h2>
        <p className="mt-2 text-sm leading-6 text-[#f6efe4]/65">{description}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 sm:gap-3">
        {PET_SCENES.map((scene, index) => (
          <SceneCard key={scene.id} scene={scene} eager={index < 4} />
        ))}
      </div>
    </section>
  );
}
