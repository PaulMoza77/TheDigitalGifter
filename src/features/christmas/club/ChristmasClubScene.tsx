import { useEffect, useRef, useState } from "react";
import { CHRISTMAS_CLUB_ASSETS, CHRISTMAS_CLUB_DESKTOP_MEDIA } from "./config";

function pickHeroLoop(): string {
  if (typeof window === "undefined") return CHRISTMAS_CLUB_ASSETS.heroLoop720;
  // Desktop = full Seedance cabin loop. Mobile = dedicated 720p loop (never start HD then swap).
  return window.matchMedia(CHRISTMAS_CLUB_DESKTOP_MEDIA).matches
    ? CHRISTMAS_CLUB_ASSETS.heroLoop
    : CHRISTMAS_CLUB_ASSETS.heroLoop720;
}

/**
 * Full-bleed cabin scene: sharp WebP poster is LCP, then the muted Seedance
 * photoreal loop fades in once buffered. Quality is never downgraded.
 */
export function ChristmasClubScene() {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [loopSrc] = useState(pickHeroLoop);

  useEffect(() => {
    // Remove HTML boot poster once React scene owns the viewport.
    document.getElementById("cc-boot")?.remove();
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    setVideoReady(false);
    const markReady = () => setVideoReady(true);
    if (video.readyState >= 2) markReady();
    video.addEventListener("loadeddata", markReady);
    video.addEventListener("canplay", markReady);
    void video.play().catch(() => {
      /* autoplay can be blocked; poster still shows */
    });
    return () => {
      video.removeEventListener("loadeddata", markReady);
      video.removeEventListener("canplay", markReady);
    };
  }, [loopSrc]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const video = videoRef.current;
    if (!wrap || !video) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (entry.isIntersecting) {
          void video.play().catch(() => undefined);
        } else {
          video.pause();
        }
      },
      { threshold: 0.12 },
    );
    io.observe(wrap);
    return () => io.disconnect();
  }, [loopSrc]);

  return (
    <div ref={wrapRef} className="cc-scene" aria-hidden="true">
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
          decoding="sync"
          fetchPriority="high"
        />
      </picture>

      <video
        ref={videoRef}
        className={`cc-scene__video${videoReady ? " is-ready" : ""}`}
        muted
        playsInline
        loop
        autoPlay
        preload="auto"
        src={loopSrc}
      />

      <div className="cc-scene__veil" />
      <div className="cc-scene__glow" />
      <div className="cc-scene__ember" />
    </div>
  );
}
