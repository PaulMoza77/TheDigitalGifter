import { PET_SECRET_LIFE_AD } from "../catalog";
import { useCanAutoplayHeroVideo } from "../useMotionPreference";

export function SecretLifeAdReel() {
  const { prefersReducedMotion, canAutoplay } = useCanAutoplayHeroVideo();
  const allowAutoplay = !prefersReducedMotion && canAutoplay;

  return (
    <figure className="relative mx-auto aspect-[9/16] w-full max-w-[380px] overflow-hidden rounded-[28px] border border-[#d4a84b]/25 bg-[#1a1410] shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
      <img
        src={PET_SECRET_LIFE_AD.poster}
        alt="Golden Retriever as a Formula racing driver — one photo, twelve secret lives"
        width={1080}
        height={1920}
        className="absolute inset-0 h-full w-full object-cover"
      />
      {allowAutoplay ? (
        <video
          src={PET_SECRET_LIFE_AD.src}
          poster={PET_SECRET_LIFE_AD.poster}
          muted
          loop
          playsInline
          autoPlay
          preload="auto"
          className="absolute inset-0 h-full w-full object-cover"
          aria-label="Golden Retriever living four secret lives: racer, astronaut, mafia boss, and king"
        />
      ) : null}
      <figcaption className="sr-only">
        9:16 preview of the same Golden Retriever as a racer, astronaut, mafia boss, and king.
      </figcaption>
    </figure>
  );
}
