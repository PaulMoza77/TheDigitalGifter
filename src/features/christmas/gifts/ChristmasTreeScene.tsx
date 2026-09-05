import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { GIFT_TREE_SCENE } from "./giftTreeMedia";
import { useCoverMediaBox } from "./useCoverMediaBox";

type Props = {
  className?: string;
  reduceMotion?: boolean;
  children?: ReactNode;
  onBreakpointChange?: (isMobile: boolean) => void;
  /** Fires once when the hero video can play through the first frames. */
  onHeroReady?: () => void;
};

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

/**
 * Photoreal chalet scene.
 * ONE network owner for the hero MP4: the <video> element itself.
 * Do not add <link rel=preload as=video> or fetch(mp4) — those duplicate the ~3.8MB transfer.
 */
export function ChristmasTreeScene({
  className,
  reduceMotion,
  children,
  onBreakpointChange,
  onHeroReady,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMobile, setIsMobile] = useState(preferMobile);
  const [ready, setReady] = useState(false);
  const heroReadyFired = useRef(false);
  const mediaAspect = isMobile ? SCENE_MEDIA_ASPECT.mobile : SCENE_MEDIA_ASPECT.desktop;
  const box = useCoverMediaBox(containerRef, mediaAspect, 0.5, "gift-safe");

  const src = isMobile ? GIFT_TREE_SCENE.mobileMp4 : GIFT_TREE_SCENE.desktopMp4;
  const posterJpg = isMobile
    ? GIFT_TREE_SCENE.mobilePosterJpg
    : GIFT_TREE_SCENE.desktopPosterJpg;
  const posterWebp = isMobile
    ? GIFT_TREE_SCENE.mobilePosterWebp
    : GIFT_TREE_SCENE.desktopPosterWebp;

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
    heroReadyFired.current = false;
    setReady(false);
    const video = videoRef.current;
    if (!video || reduceMotion) return;

    let cancelled = false;

    const markReady = () => {
      if (cancelled) return;
      setReady(true);
      if (!heroReadyFired.current) {
        heroReadyFired.current = true;
        onHeroReady?.();
      }
    };

    const tryPlay = () => {
      if (cancelled) return;
      const p = video.play();
      if (p && typeof p.catch === "function") p.catch(() => undefined);
    };

    video.addEventListener("loadeddata", tryPlay);
    video.addEventListener("canplay", tryPlay);
    video.addEventListener("playing", markReady);
    tryPlay();

    return () => {
      cancelled = true;
      video.removeEventListener("loadeddata", tryPlay);
      video.removeEventListener("canplay", tryPlay);
      video.removeEventListener("playing", markReady);
    };
  }, [isMobile, reduceMotion, src, onHeroReady]);

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
          {/* Crisp poster under the video — webp first, jpg fallback. */}
          <picture>
            <source srcSet={posterWebp} type="image/webp" />
            <img
              src={posterJpg}
              alt=""
              style={mediaStyle}
              decoding="async"
              fetchPriority="high"
              draggable={false}
            />
          </picture>

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
              // Sole network owner for the hero MP4. Do not combine with fetch()/preload link.
              preload="auto"
              poster={posterJpg}
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
