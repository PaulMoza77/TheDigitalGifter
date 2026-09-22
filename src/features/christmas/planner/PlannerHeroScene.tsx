import { useEffect, useRef, useState } from "react";
import { LANDING_ASSETS } from "../landing/assets";
import { usePrefersReducedMotion } from "../landing/usePrefersReducedMotion";

function pickHeroLoop(): string {
  if (typeof window === "undefined") return LANDING_ASSETS.cabinLoop720;
  return window.matchMedia("(min-width: 744px)").matches
    ? LANDING_ASSETS.cabinLoop
    : LANDING_ASSETS.cabinLoop720;
}

/**
 * Planner landing hero: sharp cabin poster for LCP, then the existing
 * muted Seedance cabin loop. Mobile uses the 720p loop. Reduced-motion
 * visitors keep the still.
 */
export function PlannerHeroScene({ alt }: { alt: string }) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
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
      /* autoplay blocked - poster remains */
    });
    return () => {
      video.removeEventListener("loadeddata", markReady);
      video.removeEventListener("canplay", markReady);
    };
  }, [loopSrc, reduced]);

  useEffect(() => {
    if (reduced) return;
    const wrap = wrapRef.current;
    const video = videoRef.current;
    if (!wrap || !video) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (entry.isIntersecting) void video.play().catch(() => undefined);
        else video.pause();
      },
      { threshold: 0.12 },
    );
    io.observe(wrap);
    return () => io.disconnect();
  }, [loopSrc, reduced]);

  return (
    <div ref={wrapRef} className="tdg-planner__cabin">
      <picture className="tdg-planner__cabin-poster">
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
          className={`tdg-planner__cabin-video${videoReady ? " is-ready" : ""}`}
          muted
          playsInline
          loop
          autoPlay
          preload="metadata"
          src={loopSrc}
        />
      ) : null}
      <div className="tdg-planner__cabin-veil" />
      <div className="tdg-planner__cabin-glow" aria-hidden="true" />
      <div className="tdg-planner__cabin-ember" aria-hidden="true" />
    </div>
  );
}
