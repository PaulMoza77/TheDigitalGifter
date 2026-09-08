import { useEffect, useRef, useState } from "react";
import { CHRISTMAS_CLUB_ASSETS } from "./config";

/**
 * Full-bleed cabin scene: sharp WebP poster paints instantly, then a muted
 * cinematic loop fades in. No Replicate token in this environment yet —
 * Seedance can replace the loop file later without changing the layout.
 */
export function ChristmasClubScene() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoReady, setVideoReady] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const markReady = () => setVideoReady(true);
    if (video.readyState >= 2) markReady();
    video.addEventListener("loadeddata", markReady);
    video.addEventListener("canplay", markReady);
    const play = () => {
      void video.play().catch(() => {
        /* autoplay can be blocked; poster still shows */
      });
    };
    play();
    return () => {
      video.removeEventListener("loadeddata", markReady);
      video.removeEventListener("canplay", markReady);
    };
  }, []);

  return (
    <div className="cc-scene" aria-hidden="true">
      <picture className="cc-scene__poster">
        <source
          type="image/webp"
          srcSet={`${CHRISTMAS_CLUB_ASSETS.hero1280} 1280w, ${CHRISTMAS_CLUB_ASSETS.hero1920} 1920w, ${CHRISTMAS_CLUB_ASSETS.hero2560} 2560w`}
          sizes="100vw"
        />
        <img
          src={CHRISTMAS_CLUB_ASSETS.hero1920Jpg}
          srcSet={`${CHRISTMAS_CLUB_ASSETS.hero1280Jpg} 1280w, ${CHRISTMAS_CLUB_ASSETS.hero1920Jpg} 1920w, ${CHRISTMAS_CLUB_ASSETS.hero2560Jpg} 2560w`}
          sizes="100vw"
          alt=""
          width={1920}
          height={1080}
          decoding="async"
          fetchPriority="high"
        />
      </picture>

      <video
        ref={videoRef}
        className={`cc-scene__video${videoReady ? " is-ready" : ""}`}
        poster={CHRISTMAS_CLUB_ASSETS.hero1920Jpg}
        muted
        playsInline
        loop
        autoPlay
        preload="metadata"
      >
        <source
          src={CHRISTMAS_CLUB_ASSETS.heroLoop720}
          type="video/mp4"
          media="(max-width: 900px)"
        />
        <source src={CHRISTMAS_CLUB_ASSETS.heroLoop} type="video/mp4" />
      </video>

      <div className="cc-scene__veil" />
      <div className="cc-scene__glow" />
      <div className="cc-scene__ember" />
    </div>
  );
}
