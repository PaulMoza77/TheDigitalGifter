import { petSourceImage, sceneImageSrc } from "../pet/catalog";
import type { PetSceneId } from "../pet/types";
import type { PetV2Species } from "./types";

const EXAMPLES: PetSceneId[] = [
  "royal-portrait",
  "astronaut",
  "formula-racer",
  "spa-bathtub",
  "luxury-ceo",
  "head-chef",
];

export function V2ExampleStrip({ species }: { species: PetV2Species }) {
  const demoSpecies = species === "other" ? "dog" : species;
  return (
    <section aria-labelledby="v2-examples" className="space-y-3">
      <h2 id="v2-examples" className="text-lg font-semibold tracking-tight text-[#f6efe4]">
        Same pet. Another life.
      </h2>
      <div className="grid grid-cols-2 gap-2">
        <figure className="relative overflow-hidden rounded-2xl">
          <img
            src={petSourceImage(demoSpecies)}
            alt="Original demo pet photo"
            width={360}
            height={480}
            className="aspect-[3/4] h-full w-full object-cover"
            fetchPriority="high"
          />
          <figcaption className="absolute left-2 top-2 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-white">
            Before
          </figcaption>
        </figure>
        <figure className="relative overflow-hidden rounded-2xl">
          <img
            src={sceneImageSrc("royal-portrait", demoSpecies)}
            alt="Royal portrait of the same demo pet"
            width={360}
            height={480}
            className="aspect-[3/4] h-full w-full object-cover"
            fetchPriority="high"
          />
          <figcaption className="absolute left-2 top-2 rounded-full bg-[#d4a84b] px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-[#1a140e]">
            After
          </figcaption>
        </figure>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {EXAMPLES.slice(1, 5).map((id) => (
          <img
            key={id}
            src={sceneImageSrc(id, demoSpecies)}
            alt=""
            width={160}
            height={200}
            loading="lazy"
            className="aspect-[4/5] w-full rounded-xl object-cover"
          />
        ))}
      </div>
    </section>
  );
}
