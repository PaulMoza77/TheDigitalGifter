import { useEffect, useRef, useState } from "react";
import { PHOTO_GEN_ASSETS } from "./assets";

type Props = {
  beforeLabel: string;
  afterLabel: string;
};

/**
 * Hero demo: original family photo beside the animated Christmas portrait.
 * The video is the existing family loop. It autoplays muted when the browser allows it.
 */
export function HeroBeforeAfter({ beforeLabel, afterLabel }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [reducedMotion, setReducedMotion] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [showPlay, setShowPlay] = useState(reducedMotion);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      const reduce = motion.matches;
      setReducedMotion(reduce);
      if (reduce || document.hidden) {
        video.pause();
        if (reduce) setShowPlay(true);
        return;
      }
      void video.play().then(() => setShowPlay(false)).catch(() => setShowPlay(true));
    };
    apply();
    motion.addEventListener("change", apply);
    document.addEventListener("visibilitychange", apply);
    return () => {
      motion.removeEventListener("change", apply);
      document.removeEventListener("visibilitychange", apply);
    };
  }, []);

  const play = () => {
    const video = videoRef.current;
    if (!video) return;
    void video.play().then(() => setShowPlay(false)).catch(() => setShowPlay(true));
  };

  return (
    <div className="pg-hero-demo" aria-label="Original family photo and animated Christmas portrait">
      <figure className="pg-hero-demo__pane">
        <img
          src={PHOTO_GEN_ASSETS.familyBefore}
          alt="Everyday family photo before the Christmas portrait"
          width={864}
          height={1152}
          decoding="async"
          fetchPriority="high"
        />
        <figcaption>{beforeLabel}</figcaption>
      </figure>
      <figure className="pg-hero-demo__pane">
        <video
          ref={videoRef}
          src={PHOTO_GEN_ASSETS.familyAfterVideo}
          poster={PHOTO_GEN_ASSETS.familyAfter}
          muted
          loop
          playsInline
          autoPlay={!reducedMotion}
          preload="metadata"
          aria-label="Animated Christmas portrait of the same family"
          onPlay={() => setShowPlay(false)}
          onPause={() => {
            if (reducedMotion || document.hidden) setShowPlay(true);
          }}
        />
        {showPlay ? (
          <button type="button" className="pg-hero-demo__play" onClick={play}>
            Play
          </button>
        ) : null}
        <figcaption>{afterLabel}</figcaption>
      </figure>
    </div>
  );
}
