import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { TreeLightLayer } from "./TreeLightLayer";
import { useCoverMediaBox } from "./useCoverMediaBox";

type Props = {
  className?: string;
  reduceMotion?: boolean;
  /** Hotspots / interactive layer aligned to the source media. */
  children?: ReactNode;
  /** Fired when the active breakpoint changes (md = 768). */
  onBreakpointChange?: (isMobile: boolean) => void;
};

const DESKTOP_SRC = "/christmas/gifts/scene-desktop.mp4";
const MOBILE_SRC = "/christmas/gifts/scene-mobile.mp4";
const DESKTOP_POSTER = "/christmas/gifts/scene-desktop-1280.jpg";
const MOBILE_POSTER = "/christmas/gifts/scene-mobile-640.jpg";

export const SCENE_MEDIA_ASPECT = {
  desktop: 1280 / 720,
  mobile: 720 / 1280,
} as const;

/** Keep the tree tip clear of the header without shoving gifts into the CTA. */
const MEDIA_TRANSFORM = "translateY(1.5%) scale(1.04)";
const MEDIA_TRANSFORM_ORIGIN = "50% 0%";
/** Solid top inset so the star tip isn't flush against the nav. */
const SCENE_TOP_INSET_PX = 14;

function preferMobile(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 767px)").matches;
}

function preloadVideo(href: string) {
  const existing = document.querySelector(`link[data-gt-video-preload="${href}"]`);
  if (existing) return;
  const link = document.createElement("link");
  link.rel = "preload";
  link.as = "video";
  link.href = href;
  link.type = "video/mp4";
  link.setAttribute("data-gt-video-preload", href);
  document.head.appendChild(link);

  void fetch(href, {
    method: "GET",
    credentials: "same-origin",
    headers: { Range: "bytes=0-1572864" },
  }).catch(() => {
    /* video element still loads normally */
  });
}

/**
 * Photoreal luxury-chalet scene.
 * Portrait video → mobile, landscape video → desktop.
 * Children render in media-percentage space (aligned to the photo/video).
 */
export function ChristmasTreeScene({
  className,
  reduceMotion,
  children,
  onBreakpointChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMobile, setIsMobile] = useState(preferMobile);
  const mediaAspect = isMobile ? SCENE_MEDIA_ASPECT.mobile : SCENE_MEDIA_ASPECT.desktop;
  const box = useCoverMediaBox(containerRef, mediaAspect, 0.5, 0);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => {
      const mobile = mq.matches;
      setIsMobile(mobile);
      onBreakpointChange?.(mobile);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [onBreakpointChange]);

  useEffect(() => {
    if (reduceMotion) return;
    preloadVideo(isMobile ? MOBILE_SRC : DESKTOP_SRC);
  }, [isMobile, reduceMotion]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || reduceMotion) return;

    let cancelled = false;
    const tryPlay = () => {
      if (cancelled) return;
      const p = video.play();
      if (p && typeof p.catch === "function") p.catch(() => undefined);
    };

    video.addEventListener("loadeddata", tryPlay);
    video.addEventListener("canplay", tryPlay);
    tryPlay();

    return () => {
      cancelled = true;
      video.removeEventListener("loadeddata", tryPlay);
      video.removeEventListener("canplay", tryPlay);
    };
  }, [isMobile, reduceMotion]);

  const src = isMobile ? MOBILE_SRC : DESKTOP_SRC;
  const poster = isMobile ? MOBILE_POSTER : DESKTOP_POSTER;

  const mediaFrameStyle: CSSProperties = {
    position: "absolute",
    left: box.width ? box.left : 0,
    top: box.height ? box.top : 0,
    width: box.width || "100%",
    height: box.height || "100%",
    transform: MEDIA_TRANSFORM,
    transformOrigin: MEDIA_TRANSFORM_ORIGIN,
  };

  return (
    <div
      className={className}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: 280,
        overflow: "hidden",
        zIndex: 0,
        background: "#0a0705",
      }}
    >
      {/* Top inset keeps the star tip clear of the sticky header */}
      <div
        ref={containerRef}
        className="absolute inset-x-0 bottom-0"
        style={{ top: SCENE_TOP_INSET_PX }}
      >
        <div
          className="absolute inset-0"
          role="img"
          aria-label="Luxury Christmas chalet with a realistic Christmas tree and gifts"
          style={{ zIndex: 0 }}
        >
          <div style={mediaFrameStyle}>
            {reduceMotion ? (
              <picture className="absolute inset-0 block h-full w-full">
                <source
                  type="image/webp"
                  srcSet={
                    isMobile
                      ? "/christmas/gifts/scene-mobile.webp"
                      : "/christmas/gifts/scene-desktop.webp"
                  }
                />
                <img
                  src={poster}
                  alt=""
                  className="h-full w-full"
                  style={{ objectFit: "fill" }}
                  decoding="async"
                  fetchPriority="high"
                />
              </picture>
            ) : (
              <video
                key={src}
                ref={videoRef}
                className="absolute inset-0 h-full w-full"
                style={{ objectFit: "fill" }}
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
                poster={poster}
              >
                <source src={src} type="video/mp4" />
              </video>
            )}
          </div>
        </div>

        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            zIndex: 1,
            background: `
            radial-gradient(ellipse at 50% 48%,
              transparent 38%,
              rgba(5,5,5,0.04) 70%,
              rgba(5,5,5,0.2) 100%),
            linear-gradient(180deg,
              rgba(8,6,5,0.06) 0%,
              transparent 12%,
              transparent 78%,
              rgba(8,6,5,0.28) 100%)
          `,
          }}
        />

        {reduceMotion ? <TreeLightLayer reduceMotion /> : null}

        {children ? (
          <div className="pointer-events-none absolute inset-0" style={{ zIndex: 4 }}>
            <div className="pointer-events-auto" style={mediaFrameStyle}>
              <div className="absolute inset-0">{children}</div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
