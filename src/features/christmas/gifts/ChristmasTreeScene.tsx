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
  /** Hotspots / interactive layer aligned to the source media. */
  children?: ReactNode;
  /** Fired when the active breakpoint changes (md = 768). */
  onBreakpointChange?: (isMobile: boolean) => void;
};

const DESKTOP_SRC = "/christmas/gifts/scene-desktop.mp4";
const MOBILE_SRC = "/christmas/gifts/scene-mobile.mp4";
/** Full-res posters — sharp still while the 1080p clip warms up. */
const DESKTOP_POSTER = "/christmas/gifts/scene-desktop.jpg";
const MOBILE_POSTER = "/christmas/gifts/scene-mobile.jpg";

export const SCENE_MEDIA_ASPECT = {
  desktop: 1920 / 1080,
  mobile: 1080 / 1920,
} as const;

/** Minimal shift — large scales blur the 1080p scene. Tip clearance via top inset. */
const MEDIA_TRANSFORM = "translateY(0.8%)";
const MEDIA_TRANSFORM_ORIGIN = "50% 0%";
const SCENE_TOP_INSET_PX = 22;

/** Cache blob URLs across remounts within the same session. */
const blobCache = new Map<string, string>();
const blobInflight = new Map<string, Promise<string>>();

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
 * Download the full clip once and play from a blob URL.
 * After that, loops never touch the network → no mid-loop stutter.
 */
function loadSceneBlob(href: string): Promise<string> {
  const cached = blobCache.get(href);
  if (cached) return Promise.resolve(cached);

  const pending = blobInflight.get(href);
  if (pending) return pending;

  const job = fetch(href, { credentials: "same-origin", priority: "high" } as RequestInit)
    .then(async (res) => {
      if (!res.ok) throw new Error(`scene_video_${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      blobCache.set(href, url);
      blobInflight.delete(href);
      return url;
    })
    .catch((err) => {
      blobInflight.delete(href);
      throw err;
    });

  blobInflight.set(href, job);
  return job;
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
  const [playbackSrc, setPlaybackSrc] = useState<string | null>(null);
  const [videoVisible, setVideoVisible] = useState(false);
  const mediaAspect = isMobile ? SCENE_MEDIA_ASPECT.mobile : SCENE_MEDIA_ASPECT.desktop;
  const box = useCoverMediaBox(containerRef, mediaAspect, 0.5, 0);

  const networkSrc = isMobile ? MOBILE_SRC : DESKTOP_SRC;
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

  // Full blob first → play from memory. Sharp poster covers the warm-up.
  useEffect(() => {
    if (reduceMotion) return;
    let cancelled = false;
    setVideoVisible(false);

    const cached = blobCache.get(networkSrc);
    if (cached) {
      setPlaybackSrc(cached);
    } else {
      setPlaybackSrc(null);
    }

    markPreloadLink(networkSrc);
    void loadSceneBlob(networkSrc)
      .then((url) => {
        if (!cancelled) setPlaybackSrc(url);
      })
      .catch(() => {
        // Fallback: progressive network stream if blob fetch fails.
        if (!cancelled) setPlaybackSrc(networkSrc);
      });

    return () => {
      cancelled = true;
    };
  }, [isMobile, networkSrc, reduceMotion]);

  // Play + seamless loop (native loop often hitchs at the wrap).
  useEffect(() => {
    const video = videoRef.current;
    if (!video || reduceMotion || !playbackSrc) return;

    let cancelled = false;

    const tryPlay = () => {
      if (cancelled) return;
      const p = video.play();
      if (p && typeof p.catch === "function") p.catch(() => undefined);
    };

    const onPlaying = () => {
      if (!cancelled) setVideoVisible(true);
    };

    const onTimeUpdate = () => {
      // Restart a hair before EOF so the decoder never stalls on loop seam.
      if (video.duration && video.currentTime >= video.duration - 0.05) {
        video.currentTime = 0.001;
        tryPlay();
      }
    };

    video.addEventListener("loadeddata", tryPlay);
    video.addEventListener("canplay", tryPlay);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("timeupdate", onTimeUpdate);
    tryPlay();

    return () => {
      cancelled = true;
      video.removeEventListener("loadeddata", tryPlay);
      video.removeEventListener("canplay", tryPlay);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("timeupdate", onTimeUpdate);
    };
  }, [playbackSrc, isMobile, reduceMotion]);

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
            {/* Sharp still always underneath — no blank/soft frame while video buffers */}
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
                draggable={false}
              />
            </picture>

            {!reduceMotion && playbackSrc ? (
              <video
                key={playbackSrc}
                ref={videoRef}
                className="absolute inset-0 h-full w-full"
                style={{
                  objectFit: "fill",
                  opacity: videoVisible ? 1 : 0,
                  transition: "opacity 280ms ease",
                  // Promote to its own compositor layer for smoother decode/paint.
                  transform: "translateZ(0)",
                  backfaceVisibility: "hidden",
                }}
                autoPlay
                muted
                playsInline
                preload="auto"
                // loop handled manually for a clean wrap
                poster={poster}
                disablePictureInPicture
                disableRemotePlayback
              >
                <source src={playbackSrc} type="video/mp4" />
              </video>
            ) : null}
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
