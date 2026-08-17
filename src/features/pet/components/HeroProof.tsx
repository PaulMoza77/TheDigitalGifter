import { petSourceImage, sceneClipSrc, sceneImageSrc } from "../catalog";
import { mixedOtherGalleryLabel } from "../croGuards";
import type { PetSpecies } from "../types";
import { useCanAutoplayHeroVideo } from "../useMotionPreference";
import { SceneImage } from "./SceneCard";

export function HeroProof({ species }: { species: PetSpecies }) {
  const { prefersReducedMotion, canAutoplay } = useCanAutoplayHeroVideo();
  const hasSamePetSource = species === "dog" || species === "cat";

  if (!hasSamePetSource) {
    return (
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#d4a84b]">
          {mixedOtherGalleryLabel()}
        </p>
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
          {(["formula-racer", "spa-bathtub", "royal-portrait"] as const).map((id, index) => (
            <div key={id} className="overflow-hidden rounded-xl sm:rounded-2xl">
              <SceneImage
                sceneId={id}
                species={species}
                alt={`${mixedOtherGalleryLabel()} — ${id.replace("-", " ")} example`}
                eager={index === 0}
                className="aspect-[3/4] h-full w-full object-cover"
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const poster = sceneImageSrc("formula-racer", species);
  const clip = sceneClipSrc("formula-racer", species);
  const petLabel = species === "dog" ? "Golden Retriever" : "cat";

  return (
    <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
      <figure className="relative overflow-hidden rounded-xl sm:rounded-2xl">
        <img
          src={petSourceImage(species)}
          alt={`Original photo of the demo ${petLabel}`}
          width={720}
          height={1080}
          className="aspect-[3/4] h-full w-full object-cover"
          fetchPriority="high"
        />
        <figcaption className="absolute left-2 top-2 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-white">
          Original photo
        </figcaption>
      </figure>
      <figure className="overflow-hidden rounded-xl sm:rounded-2xl">
        <SceneImage
          sceneId="royal-portrait"
          species={species}
          alt={`Royal portrait of the same demo ${petLabel}`}
          eager
          className="aspect-[3/4] h-full w-full object-cover"
        />
      </figure>
      <figure className="overflow-hidden rounded-xl sm:rounded-2xl">
        <SceneImage
          sceneId="astronaut"
          species={species}
          alt={`Astronaut portrait of the same demo ${petLabel}`}
          eager
          className="aspect-[3/4] h-full w-full object-cover"
        />
      </figure>
      <figure className="relative overflow-hidden rounded-xl sm:rounded-2xl">
        {prefersReducedMotion || !canAutoplay ? (
          <img
            src={poster}
            alt={`Cinematic clip still of the same demo ${petLabel}`}
            width={720}
            height={960}
            className="aspect-[3/4] h-full w-full object-cover"
          />
        ) : (
          <video
            src={clip}
            poster={poster}
            muted
            loop
            playsInline
            autoPlay
            preload="metadata"
            className="aspect-[3/4] h-full w-full object-cover"
            aria-label={`Cinematic 5-second clip of the same demo ${petLabel}`}
          />
        )}
        <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-white">
          Cinematic clip
        </span>
      </figure>
    </div>
  );
}
