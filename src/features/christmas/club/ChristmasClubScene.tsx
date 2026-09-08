import { useEffect, useRef, useState } from "react";
import { ChristmasClubSnow } from "./ChristmasClubSnow";
import { CHRISTMAS_CLUB_ASSETS } from "./config";

/**
 * Full-bleed cabin scene: sharp WebP poster paints instantly, then a muted
 * 5s living loop (snow / fire / candles / twinkle) fades in. Canvas snow
 * reinforces outdoor flakes. Seedance can replace the MP4 when Replicate is available.
 */
export function ChristmasClubScene() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [loopSrc, setLoopSrc] = useState(CHRISTMAS_CLUB_ASSETS.heroLoop720);

  useEffect(() => {
    const pick = () => {
      const wide = window.matchMedia("(min-width: 901px)").matches;
      setLoopSrc(wide ? CHRISTMAS_CLUB_ASSETS.heroLoop : CHRISTMAS_CLUB_ASSETS.heroLoop720);
    };
    pick();
    const mq = window.matchMedia("(min-width: 901px)");
    const onChange = () => pick();
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    setVideoReady(false);
    const markReady = () => setVideoReady(true);
    if (video.readyState >= 2) markReady();
    video.addEventListener("loadeddata", markReady);
    video.addEventListener("canplay", markReady);
    video.load();
    void video.play().catch(() => {
      /* autoplay can be blocked; poster still shows */
    });
    return () => {
      video.removeEventListener("loadeddata", markReady);
      video.removeEventListener("canplay", markReady);
    };
  }, [loopSrc]);

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
        preload="auto"
        src={loopSrc}
      />

      <div className="cc-scene__veil" />
      <ChristmasClubSnow />
      <div className="cc-scene__glow" />
      <div className="cc-scene__ember" />
    </div>
  );
}
