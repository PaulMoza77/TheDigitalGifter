import {
  PET_DEMO_CLIP_IDS,
  PET_OTHER_SUBJECTS,
  petSourceImage,
  sceneHasMotionClip,
} from "../pet/catalog";
import { mixedOtherGalleryLabel } from "../pet/croGuards";
import { AutoSceneClip, SceneImage } from "../pet/components/SceneCard";
import type { PetSceneId } from "../pet/types";
import type { PetV2Species } from "./types";

const DOG_CAT_CLIPS: PetSceneId[] = [...PET_DEMO_CLIP_IDS];
const DOG_CAT_MORE: PetSceneId[] = ["astronaut", "luxury-ceo"];

const OTHER_EXAMPLES: PetSceneId[] = [
  "formula-racer",
  "spa-bathtub",
  "newspaper",
  "royal-portrait",
  "astronaut",
  "luxury-ceo",
];

function ClipBadge() {
  return (
    <span className="pointer-events-none absolute left-2 top-2 z-10 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-white">
      5s clip
    </span>
  );
}

export function V2ExampleStrip({ species }: { species: PetV2Species }) {
  if (species === "other") {
    return (
      <section aria-labelledby="v2-examples" className="space-y-3">
        <div>
          <h2 id="v2-examples" className="text-lg font-semibold tracking-tight text-[#f6efe4]">
            Same pet. Another life.
          </h2>
          <p className="mt-1 text-xs font-medium uppercase tracking-[0.16em] text-[#d4a84b]">
            {mixedOtherGalleryLabel()}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {OTHER_EXAMPLES.map((id, index) => (
            <figure key={id} className="relative overflow-hidden rounded-2xl">
              {sceneHasMotionClip(id) ? (
                <AutoSceneClip
                  sceneId={id}
                  species="other"
                  alt={`${PET_OTHER_SUBJECTS[id]} — ${id.replace(/-/g, " ")} example`}
                  eager={index < 2}
                  className="aspect-[3/4] h-full w-full object-cover"
                />
              ) : (
                <SceneImage
                  sceneId={id}
                  species="other"
                  alt={`${PET_OTHER_SUBJECTS[id]} — ${id.replace(/-/g, " ")} example`}
                  eager={index < 2}
                  className="aspect-[3/4] h-full w-full object-cover"
                />
              )}
              {sceneHasMotionClip(id) ? <ClipBadge /> : null}
              <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2.5 pb-2.5 pt-8 text-sm font-semibold text-white">
                {PET_OTHER_SUBJECTS[id]}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
    );
  }

  const petLabel = species === "cat" ? "cat" : "Golden Retriever";

  return (
    <section aria-labelledby="v2-examples" className="space-y-3">
      <h2 id="v2-examples" className="text-lg font-semibold tracking-tight text-[#f6efe4]">
        Same pet. Another life.
      </h2>
      <div className="grid grid-cols-2 gap-2">
        <figure className="relative overflow-hidden rounded-2xl">
          <img
            src={petSourceImage(species)}
            alt={`Original photo of the demo ${petLabel}`}
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
          <SceneImage
            sceneId="royal-portrait"
            species={species}
            alt={`Royal portrait of the same demo ${petLabel}`}
            eager
            className="aspect-[3/4] h-full w-full object-cover"
          />
          <figcaption className="absolute left-2 top-2 z-10 rounded-full bg-[#d4a84b] px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-[#1a140e]">
            After
          </figcaption>
        </figure>
        {DOG_CAT_CLIPS.map((id) => (
          <figure key={id} className="relative overflow-hidden rounded-2xl">
            <AutoSceneClip
              sceneId={id}
              species={species}
              alt={`${id.replace(/-/g, " ")} clip of the same demo ${petLabel}`}
              eager
              className="aspect-[3/4] h-full w-full object-cover"
            />
            <ClipBadge />
          </figure>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-2">
        {DOG_CAT_MORE.map((id) => (
          <figure key={id} className="relative overflow-hidden rounded-xl">
            <SceneImage
              sceneId={id}
              species={species}
              alt={`${id.replace(/-/g, " ")} of the same demo ${petLabel}`}
              className="aspect-[4/5] h-full w-full object-cover"
            />
          </figure>
        ))}
      </div>
    </section>
  );
}
