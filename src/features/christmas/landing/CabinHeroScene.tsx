import { useEffect, useRef, useState } from "react";
import { LANDING_ASSETS } from "./assets";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

function pickHeroLoop(): string {
  if (typeof window === "undefined") return LANDING_ASSETS.cabinLoop720;
  return window.matchMedia("(min-width: 901px)").matches
    ? LANDING_ASSETS.cabinLoop
    : LANDING_ASSETS.cabinLoop720;
}

/**
 * Full-bleed luxury cabin hero: sharp WebP poster for LCP, then the muted
 * photoreal loop fades in. Reduced-motion visitors keep the still poster.
 */
export function CabinHeroScene({ alt }: { alt: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const reduced = usePrefersReducedMotion();
  const [videoReady, setVideoReady] = useState(false);
  const [loopSrc] = useState(pickHeroLoop);

  useEffect(() => {
    if (reduced) return;
    const video = videoRef.current;
    if (!video) return;
    setVideoReady(false);
    const markReady = () => setVideoReady(true);
    if (video.readyState >= 2) markReady();
    video.addEventListener("loadeddata", markReady);
    video.addEventListener("canplay", markReady);
    void video.play().catch(() => {
      /* autoplay blocked — poster remains */
    });
    return () => {
      video.removeEventListener("loadeddata", markReady);
      video.removeEventListener("canplay", markReady);
    };
  }, [loopSrc, reduced]);

  return (
    <div className="xmas-cabin">
      <picture className="xmas-cabin__poster">
        <source
          type="image/webp"
          srcSet={`${LANDING_ASSETS.cabin1280} 1280w, ${LANDING_ASSETS.cabin1920} 1920w, ${LANDING_ASSETS.cabin2560} 2560w`}
          sizes="100vw"
        />
        <img
          src={LANDING_ASSETS.cabin1920Jpg}
          srcSet={`${LANDING_ASSETS.cabin1280Jpg} 1280w, ${LANDING_ASSETS.cabin1920Jpg} 1920w, ${LANDING_ASSETS.cabin2560Jpg} 2560w`}
          sizes="100vw"
          alt={alt}
          width={1920}
          height={1080}
          decoding="async"
          fetchPriority="high"
        />
      </picture>

      {!reduced ? (
        <video
          ref={videoRef}
          className={`xmas-cabin__video${videoReady ? " is-ready" : ""}`}
          muted
          playsInline
          loop
          autoPlay
          preload="auto"
          src={loopSrc}
        />
      ) : null}

      <div className="xmas-cabin__veil" />
      <div className="xmas-cabin__glow" aria-hidden="true" />
      <div className="xmas-cabin__ember" aria-hidden="true" />
    </div>
  );
}
