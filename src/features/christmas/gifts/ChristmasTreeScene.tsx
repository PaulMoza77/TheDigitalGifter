import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useCoverMediaBox } from "./useCoverMediaBox";

type Props = {
  className?: string;
  reduceMotion?: boolean;
  children?: ReactNode;
  onBreakpointChange?: (isMobile: boolean) => void;
};

const DESKTOP_SRC = "/christmas/gifts/scene-desktop.mp4";
const MOBILE_SRC = "/christmas/gifts/scene-mobile.mp4";
/** Prefer sharp JPEG posters — WebP was too soft on retina desktop. */
const DESKTOP_POSTER = "/christmas/gifts/scene-desktop.jpg";
const MOBILE_POSTER = "/christmas/gifts/scene-mobile.jpg";

export const SCENE_MEDIA_ASPECT = {
  desktop: 1920 / 1080,
  mobile: 1080 / 1920,
} as const;

/** Top pad so the star clears the sticky header. */
const SCENE_TOP_INSET_PX = 18;

function preferMobile(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 767px)").matches;
}

function markPreloadLink(href: string) {
  if (document.querySelector(`link[data-gt-video-preload="${href}"]`)) return;
  const link = document.createElement("link");
  link.rel = "preload";
  link.as = "video";
  link.href = href;
  link.type = "video/mp4";
  link.setAttribute("data-gt-video-preload", href);
  document.head.appendChild(link);
}

/**
 * Photoreal chalet scene.
 * Visuals use CSS object-fit:cover (sharp, no JS stretch).
 * Hotspots share the same cover math so clicks land on the photo gifts.
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
  const [ready, setReady] = useState(false);
  const mediaAspect = isMobile ? SCENE_MEDIA_ASPECT.mobile : SCENE_MEDIA_ASPECT.desktop;
  // Gift-safe Y: wide/short viewports crop vertically — keep presents under the tree in view.
  const box = useCoverMediaBox(containerRef, mediaAspect, 0.5, "gift-safe");

  const src = isMobile ? MOBILE_SRC : DESKTOP_SRC;
  const poster = isMobile ? MOBILE_POSTER : DESKTOP_POSTER;

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
    markPreloadLink(src);
    // Warm first ~2.5MB so playback can start without waiting for the full file.
    void fetch(src, {
      credentials: "same-origin",
      headers: { Range: "bytes=0-2621440" },
      // @ts-expect-error priority is widely supported
      priority: "high",
    }).catch(() => undefined);
  }, [isMobile, reduceMotion, src]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || reduceMotion) return;

    let cancelled = false;
    setReady(false);

    const tryPlay = () => {
      if (cancelled) return;
      const p = video.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => undefined);
      }
    };

    const onPlaying = () => {
      if (!cancelled) setReady(true);
    };

    video.addEventListener("loadeddata", tryPlay);
    video.addEventListener("canplay", tryPlay);
    video.addEventListener("playing", onPlaying);
    tryPlay();

    return () => {
      cancelled = true;
      video.removeEventListener("loadeddata", tryPlay);
      video.removeEventListener("canplay", tryPlay);
      video.removeEventListener("playing", onPlaying);
    };
  }, [isMobile, reduceMotion, src]);

  const hotspotFrameStyle: CSSProperties = {
    position: "absolute",
    left: box.width ? box.left : 0,
    top: box.height ? box.top : 0,
    width: box.width || "100%",
    height: box.height || "100%",
  };

  const mediaStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    objectPosition: `${box.objectPositionX * 100}% ${box.objectPositionY * 100}%`,
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
      <div
        ref={containerRef}
        className="absolute inset-x-0 bottom-0"
        style={{ top: SCENE_TOP_INSET_PX }}
      >
        <div
          className="absolute inset-0"
          role="img"
          aria-label="Luxury Christmas chalet with a realistic Christmas tree and gifts"
        >
          {/* Sharp still under the video */}
          <img
            src={poster}
            alt=""
            style={mediaStyle}
            decoding="async"
            fetchPriority="high"
            draggable={false}
          />

          {!reduceMotion ? (
            <video
              key={src}
              ref={videoRef}
              style={{
                ...mediaStyle,
                opacity: ready ? 1 : 0,
                transition: "opacity 200ms ease",
              }}
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              poster={poster}
              disablePictureInPicture
              // @ts-expect-error non-standard but supported
              disableRemotePlayback
            >
              <source src={src} type="video/mp4" />
            </video>
          ) : null}
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
                rgba(5,5,5,0.18) 100%),
              linear-gradient(180deg,
                rgba(8,6,5,0.05) 0%,
                transparent 14%,
                transparent 88%,
                rgba(8,6,5,0.1) 100%)
            `,
          }}
        />

        {children ? (
          <div className="pointer-events-none absolute inset-0" style={{ zIndex: 4 }}>
            <div className="pointer-events-auto" style={hotspotFrameStyle}>
              <div className="absolute inset-0">{children}</div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
