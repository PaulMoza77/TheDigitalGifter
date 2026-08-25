import type { ReactNode } from "react";
import { PET_DEMO_CLIP_IDS, PET_SCENES, petSourceImage, sceneHasMotionClip } from "../pet/catalog";
import { AutoSceneClip, SceneImage } from "../pet/components/SceneCard";
import type { PetSceneId } from "../pet/types";

function ClipBadge() {
  return (
    <span className="pointer-events-none absolute left-2 top-2 z-10 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-white">
      5s clip
    </span>
  );
}

function HeroTile({ children }: { children: ReactNode }) {
  return <figure className="relative overflow-hidden rounded-2xl">{children}</figure>;
}

/** Cat-specific hero: before/after royal preview + demo clips. */
export function V3HeroProof() {
  return (
    <section aria-label="Example cat portraits and clips" className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <HeroTile>
          <img
            src={petSourceImage("cat")}
            alt="Original photo of the demo cat"
            width={360}
            height={480}
            className="aspect-[3/4] h-full w-full object-cover"
            fetchPriority="high"
          />
          <figcaption className="absolute left-2 top-2 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-white">
            Before
          </figcaption>
        </HeroTile>
        <HeroTile>
          <SceneImage
            sceneId="royal-portrait"
            species="cat"
            alt="Royal ruler preview of the same demo cat"
            eager
            className="aspect-[3/4] h-full w-full object-cover"
          />
          <figcaption className="absolute left-2 top-2 z-10 rounded-full bg-[#d4a84b] px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-[#1a140e]">
            After
          </figcaption>
        </HeroTile>
        {PET_DEMO_CLIP_IDS.map((id) => {
          const scene = PET_SCENES.find((item) => item.id === id);
          const title = scene?.title ?? id;
          return (
            <HeroTile key={id}>
              <AutoSceneClip
                sceneId={id}
                species="cat"
                alt={`${title} mini clip featuring a cat`}
                eager
                className="aspect-[3/4] h-full w-full object-cover"
              />
              <ClipBadge />
              <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2.5 pb-2.5 pt-8 text-sm font-semibold text-white">
                {title}
              </figcaption>
            </HeroTile>
          );
        })}
      </div>
    </section>
  );
}

export function V3ExampleStrip() {
  return (
    <section aria-labelledby="v3-lives" className="space-y-3">
      <div>
        <h2 id="v3-lives" className="text-lg font-semibold tracking-tight text-[#f6efe4]">
          All 12 secret lives
        </h2>
        <p className="mt-1 text-sm text-[#f6efe4]/65">
          Twelve portraits of the same cat — every world included. 2 mini clips included.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {PET_SCENES.map((scene, index) => (
          <figure key={scene.id} className="relative overflow-hidden rounded-2xl">
            <SceneImage
              sceneId={scene.id as PetSceneId}
              species="cat"
              alt={`${scene.title} example featuring a cat`}
              eager={index < 2}
              className="aspect-[3/4] h-full w-full object-cover"
            />
            {sceneHasMotionClip(scene.id) ? <ClipBadge /> : null}
            <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2.5 pb-2.5 pt-8 text-sm font-semibold text-white">
              {scene.title}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
