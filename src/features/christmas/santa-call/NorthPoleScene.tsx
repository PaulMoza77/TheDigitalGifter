/**
 * Premium North Pole call scene — cinematic still + authorized muted video loop.
 * Immersive variant fills the viewport for mobile-first call UI (no card crop).
 */

import { useEffect, useRef, useState } from "react";

export const NORTH_POLE_STILL = "/assets/christmas/library-stills/santa_workshop_north_pole.jpg";
/** HQ poster extracted from the 1080×1920 reel (not the soft 540p preview). */
export const NORTH_POLE_POSTER = "/assets/christmas/north-pole-santa/posters/north_pole_santa_reel_hq.jpg";
/**
 * Mobile immersive loop: 1080×1920 H.264 ~4.1 Mbps from the authorized reel.
 * Native generation max is 1080×1920 (no 4K master). Do not use the 540p preview here —
 * iPhone upscales it and it looks soft.
 */
export const NORTH_POLE_VIDEO_MOBILE =
  "/assets/christmas/north-pole-santa/final/north_pole_santa_reel_mobile.mp4";
/** Lite 540p fallback only (reduced-data / failed mobile load). */
export const NORTH_POLE_VIDEO_PREVIEW =
  "/assets/christmas/north-pole-santa/final/north_pole_santa_reel_preview.mp4";
const PORTRAIT_STILL = "/assets/christmas/santa-idle.webp";

export type NorthPoleSceneProps = {
  /** Optional authorized MP4/WebM loop (8–12s), muted. Defaults to preview reel in immersive. */
  videoSrc?: string | null;
  posterSrc?: string | null;
  speaking?: boolean;
  listening?: boolean;
  /** card = inset framed scene; immersive = full-bleed viewport background */
  variant?: "card" | "immersive";
  className?: string;
};

export function NorthPoleScene({
  videoSrc,
  posterSrc,
  speaking = false,
  listening = false,
  variant = "card",
  className = "",
}: NorthPoleSceneProps) {
  const immersive = variant === "immersive";
  const resolvedVideo =
    videoSrc === undefined ? (immersive ? NORTH_POLE_VIDEO_MOBILE : null) : videoSrc;
  const resolvedPoster = posterSrc || (immersive ? NORTH_POLE_POSTER : NORTH_POLE_STILL);
  const liteFallback = immersive ? NORTH_POLE_VIDEO_PREVIEW : null;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [useLite, setUseLite] = useState(false);
  const [stillFailed, setStillFailed] = useState(false);
  const activeVideo = useLite && liteFallback ? liteFallback : resolvedVideo;

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(mq.matches);
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, []);

  useEffect(() => {
    setVideoFailed(false);
    setUseLite(false);
  }, [resolvedVideo]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !activeVideo || reducedMotion || videoFailed) return;
    el.muted = true;
    el.defaultMuted = true;
    el.playsInline = true;
    void el.play().catch(() => {
      if (!useLite && liteFallback) setUseLite(true);
      else setVideoFailed(true);
    });
  }, [activeVideo, reducedMotion, videoFailed, useLite, liteFallback]);

  const showVideo = Boolean(activeVideo) && !reducedMotion && !videoFailed;
  const still = stillFailed ? PORTRAIT_STILL : resolvedPoster;

  return (
    <div
      className={`np-scene np-scene-${variant} ${className}`}
      data-speaking={speaking ? "1" : "0"}
      data-listening={listening ? "1" : "0"}
      data-variant={variant}
    >
      <div className="np-scene-frame" aria-hidden>
        {showVideo ? (
          <video
            ref={videoRef}
            className="np-scene-media"
            src={activeVideo || undefined}
            poster={still}
            muted
            playsInline
            loop
            autoPlay
            preload="metadata"
            onError={() => {
              if (!useLite && liteFallback) setUseLite(true);
              else setVideoFailed(true);
            }}
          />
        ) : (
          <img
            className="np-scene-media"
            src={still}
            alt=""
            onError={() => setStillFailed(true)}
          />
        )}
        <div className="np-scene-vignette" />
        {!reducedMotion ? <div className="np-scene-snow" /> : null}
        <div
          className={`np-scene-glow ${speaking ? "np-scene-glow-speak" : listening ? "np-scene-glow-listen" : ""}`}
        />
      </div>
      <style>{`
        .np-scene-card {
          position: relative;
          width: 100%;
          aspect-ratio: 9 / 16;
          max-height: min(62vh, 640px);
          margin: 0 auto;
          border-radius: 1.25rem;
          overflow: hidden;
          box-shadow: 0 24px 60px rgba(0,0,0,0.45);
          background: #1a0c10;
        }
        @media (min-width: 768px) {
          .np-scene-card {
            aspect-ratio: 16 / 10;
            max-height: min(52vh, 520px);
            max-width: 42rem;
          }
        }
        .np-scene-immersive {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          margin: 0;
          border-radius: 0;
          overflow: hidden;
          box-shadow: none;
          background: #12080a;
        }
        .np-scene-frame { position: absolute; inset: 0; }
        .np-scene-media {
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center 22%;
          display: block;
          /* Avoid soft upscale from CSS zoom — native 1080 cover is enough. */
          transform: none;
        }
        .np-scene-immersive .np-scene-media {
          object-position: center 18%;
          transform: none;
        }
        .np-scene-vignette {
          position: absolute; inset: 0; pointer-events: none;
          background:
            radial-gradient(ellipse at 50% 32%, transparent 28%, rgba(10,4,6,0.45) 100%),
            linear-gradient(180deg, rgba(12,6,8,0.35) 0%, transparent 28%, transparent 48%, rgba(8,4,6,0.78) 100%);
        }
        .np-scene-immersive .np-scene-vignette {
          background:
            linear-gradient(180deg, rgba(8,3,5,0.55) 0%, transparent 22%, transparent 42%, rgba(6,2,4,0.72) 72%, rgba(6,2,4,0.92) 100%),
            radial-gradient(ellipse at 50% 30%, transparent 30%, rgba(8,3,5,0.35) 100%);
        }
        .np-scene-snow {
          position: absolute; inset: 0; pointer-events: none; opacity: 0.32;
          background-image:
            radial-gradient(1.5px 1.5px at 12% 18%, rgba(255,255,255,0.7), transparent),
            radial-gradient(1px 1px at 72% 28%, rgba(255,255,255,0.55), transparent),
            radial-gradient(1.5px 1.5px at 42% 62%, rgba(255,255,255,0.45), transparent),
            radial-gradient(1px 1px at 88% 74%, rgba(255,255,255,0.5), transparent);
          animation: np-snow 14s linear infinite;
        }
        @keyframes np-snow {
          from { transform: translateY(-4%); }
          to { transform: translateY(8%); }
        }
        .np-scene-glow {
          position: absolute; inset: auto 0 0 0; height: 40%; pointer-events: none;
          background: radial-gradient(ellipse at 50% 100%, rgba(232,160,60,0.22), transparent 70%);
          transition: opacity 0.4s ease;
          opacity: 0.7;
        }
        .np-scene-glow-speak { opacity: 1; background: radial-gradient(ellipse at 50% 100%, rgba(232,197,71,0.38), transparent 70%); }
        .np-scene-glow-listen { opacity: 0.85; background: radial-gradient(ellipse at 50% 100%, rgba(60,140,110,0.28), transparent 70%); }
        @media (prefers-reduced-motion: reduce) {
          .np-scene-snow { animation: none; }
        }
      `}</style>
    </div>
  );
}
