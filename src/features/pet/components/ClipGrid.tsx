import {
  PET_CLIP_COPY,
  PET_DEMO_CLIP_IDS,
  PET_OTHER_SUBJECTS,
  getSceneById,
  sceneClipSrc,
  sceneImageSrc,
} from "../catalog";
import { mixedOtherGalleryLabel } from "../croGuards";
import type { PetSpecies } from "../types";
import { useCanAutoplayHeroVideo } from "../useMotionPreference";

export function ClipGrid({ species = "dog" }: { species?: PetSpecies }) {
  const copy = PET_CLIP_COPY[species];
  const mixed = species === "other";
  const { prefersReducedMotion, canAutoplay } = useCanAutoplayHeroVideo();
  const allowAutoplay = !prefersReducedMotion && canAutoplay;

  return (
    <section aria-labelledby="pet-clips-heading" className="space-y-5">
      <div className="max-w-xl">
        <h2
          id="pet-clips-heading"
          className="text-2xl font-semibold tracking-tight text-[#f6efe4] sm:text-3xl"
        >
          {copy.heading}
        </h2>
        <p className="mt-2 text-sm leading-6 text-[#f6efe4]/65">{copy.description}</p>
        {mixed ? (
          <p className="mt-1 text-xs uppercase tracking-[0.14em] text-[#d4a84b]">
            {mixedOtherGalleryLabel()}
          </p>
        ) : null}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {PET_DEMO_CLIP_IDS.map((id) => {
          const scene = getSceneById(id);
          const overlayTitle = mixed ? PET_OTHER_SUBJECTS[id] : scene.title;
          const poster = sceneImageSrc(id, species);
          const clip = sceneClipSrc(id, species);
          return (
            <article key={id} className="group relative overflow-hidden rounded-2xl bg-[#1a1410]">
              <div className="relative aspect-[3/4] w-full">
                {allowAutoplay ? (
                  <video
                    src={clip}
                    poster={poster}
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    className="h-full w-full object-cover"
                    aria-label={`${overlayTitle} 5-second clip example`}
                  />
                ) : (
                  <img
                    src={poster}
                    alt={`${overlayTitle} 5-second clip still`}
                    width={720}
                    height={960}
                    className="h-full w-full object-cover"
                  />
                )}
                <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-white/90">
                  5s clip
                </div>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent p-3 pt-12">
                  {overlayTitle !== scene.title ? (
                    <p className="text-[11px] uppercase tracking-[0.14em] text-white/70">{scene.title}</p>
                  ) : null}
                  <h3 className="text-sm font-semibold tracking-tight text-white sm:text-base">
                    {overlayTitle}
                  </h3>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
