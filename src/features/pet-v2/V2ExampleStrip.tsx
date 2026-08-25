import type { ReactNode } from "react";
import {
  PET_DEMO_CLIP_IDS,
  PET_OTHER_SUBJECTS,
  PET_SCENES,
  petSourceImage,
  sceneHasMotionClip,
} from "../pet/catalog";
import { mixedOtherGalleryLabel } from "../pet/croGuards";
import { AutoSceneClip, SceneImage } from "../pet/components/SceneCard";
import type { PetSceneId } from "../pet/types";
import type { PetV2Species } from "./types";

function ClipBadge() {
  return (
    <span className="pointer-events-none absolute left-2 top-2 z-10 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-white">
      5s clip
    </span>
  );
}

function overlayTitle(species: PetV2Species, id: PetSceneId, sceneTitle: string) {
  return species === "other" ? PET_OTHER_SUBJECTS[id] : sceneTitle;
}

function HeroTile({ children }: { children: ReactNode }) {
  return <figure className="relative overflow-hidden rounded-2xl">{children}</figure>;
}

/** Photos and autoplaying clips first — what you get, before the copy. */
export function V2HeroProof({ species }: { species: PetV2Species }) {
  const petLabel = species === "cat" ? "cat" : species === "other" ? "pet" : "Golden Retriever";
  const sceneSpecies = species === "other" ? "other" : species;

  if (species === "other") {
    return (
      <section aria-label="Example portraits and clips" className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#d4a84b]">
          {mixedOtherGalleryLabel()}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {(["formula-racer", "spa-bathtub", "royal-portrait", "astronaut"] as const).map((id, index) => (
            <HeroTile key={id}>
              {sceneHasMotionClip(id) ? (
                <AutoSceneClip
                  sceneId={id}
                  species={sceneSpecies}
                  alt={`${overlayTitle(species, id, id)} mini clip`}
                  eager={index < 2}
                  className="aspect-[3/4] h-full w-full object-cover"
                />
              ) : (
                <SceneImage
                  sceneId={id}
                  species={sceneSpecies}
                  alt={`${overlayTitle(species, id, id)} example`}
                  eager={index < 2}
                  className="aspect-[3/4] h-full w-full object-cover"
                />
              )}
              {sceneHasMotionClip(id) ? <ClipBadge /> : null}
              <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2.5 pb-2.5 pt-8 text-sm font-semibold text-white">
                {overlayTitle(species, id, PET_SCENES.find((scene) => scene.id === id)?.title ?? id)}
              </figcaption>
            </HeroTile>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Example portraits and clips" className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <HeroTile>
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
        </HeroTile>
        <HeroTile>
          <SceneImage
            sceneId="formula-racer"
            species={species}
            alt={`Formula 1 driver preview of the same demo ${petLabel}`}
            eager
            className="aspect-[3/4] h-full w-full object-cover"
          />
          <figcaption className="absolute left-2 top-2 z-10 rounded-full bg-[#d4a84b] px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-[#1a140e]">
            After
          </figcaption>
        </HeroTile>
        {PET_DEMO_CLIP_IDS.map((id) => {
          const scene = PET_SCENES.find((item) => item.id === id);
          const title = overlayTitle(species, id, scene?.title ?? id);
          return (
            <HeroTile key={id}>
              <AutoSceneClip
                sceneId={id}
                species={sceneSpecies}
                alt={`${title} mini clip`}
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

export function V2ExampleStrip({ species }: { species: PetV2Species }) {
  const petLabel = species === "cat" ? "cat" : species === "other" ? "pet" : "Golden Retriever";
  const sceneSpecies = species === "other" ? "other" : species;

  return (
    <section aria-labelledby="v2-lives" className="space-y-3">
      <div>
        <h2 id="v2-lives" className="text-lg font-semibold tracking-tight text-[#f6efe4]">
          All 12 secret lives
        </h2>
        <p className="mt-1 text-sm text-[#f6efe4]/65">
          {species === "other"
            ? "Twelve portraits. One photo. Many kinds of pets."
            : `Twelve portraits of the same ${petLabel} — every world included. 2 mini clips included.`}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {PET_SCENES.map((scene, index) => (
          <figure key={scene.id} className="relative overflow-hidden rounded-2xl">
            <SceneImage
              sceneId={scene.id}
              species={sceneSpecies}
              alt={`${overlayTitle(species, scene.id, scene.title)} example`}
              eager={index < 2}
              className="aspect-[3/4] h-full w-full object-cover"
            />
            {sceneHasMotionClip(scene.id) ? <ClipBadge /> : null}
            <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2.5 pb-2.5 pt-8 text-sm font-semibold text-white">
              {overlayTitle(species, scene.id, scene.title)}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
