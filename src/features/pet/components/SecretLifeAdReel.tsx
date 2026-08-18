import { PET_SECRET_LIFE_AD } from "../catalog";
import { useCanAutoplayHeroVideo } from "../useMotionPreference";

export function SecretLifeAdReel() {
  const { prefersReducedMotion, canAutoplay } = useCanAutoplayHeroVideo();
  const allowAutoplay = !prefersReducedMotion && canAutoplay;

  return (
    <figure className="mx-auto w-full max-w-[420px] overflow-hidden rounded-[28px] bg-[#120e0b] shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
      {allowAutoplay ? (
        <video
          src={PET_SECRET_LIFE_AD.src}
          poster={PET_SECRET_LIFE_AD.poster}
          muted
          loop
          playsInline
          autoPlay
          preload="metadata"
          className="aspect-[9/16] h-full w-full object-cover"
          aria-label="Golden Retriever living four secret lives: racer, astronaut, mafia boss, and king"
        />
      ) : (
        <img
          src={PET_SECRET_LIFE_AD.poster}
          alt="Golden Retriever as a Formula racing driver — one photo, twelve secret lives"
          width={1080}
          height={1920}
          className="aspect-[9/16] h-full w-full object-cover"
        />
      )}
      <figcaption className="sr-only">
        9:16 preview of the same Golden Retriever as a racer, astronaut, mafia boss, and king.
      </figcaption>
    </figure>
  );
}
