import { useEffect, useRef, useState } from "react";
import { LANDING_ASSETS } from "./assets";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

export function SantaPresence({
  alt,
  acknowledge = false,
}: {
  alt: string;
  /** Subtle lean toward the form once a valid name is entered. */
  acknowledge?: boolean;
}) {
  const reduced = usePrefersReducedMotion();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [useVideo, setUseVideo] = useState(!reduced);
  const [inView, setInView] = useState(true);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        setInView(entry.isIntersecting);
      },
      { rootMargin: "120px 0px", threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (reduced) {
      setUseVideo(false);
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    if (!inView) {
      video.pause();
      return;
    }
    video.play().catch(() => setUseVideo(false));
  }, [reduced, useVideo, inView]);

  return (
    <div
      ref={rootRef}
      className={`xmas-santa__asset${acknowledge ? " xmas-santa__asset--ack" : ""}`}
      data-santa-state={acknowledge ? "acknowledge" : "idle"}
    >
      <picture>
        <source media="(max-width: 640px)" srcSet={LANDING_ASSETS.santaStaticMobile} />
        <img
          src={LANDING_ASSETS.santaStatic}
          alt={useVideo ? "" : alt}
          width={540}
          height={720}
          decoding="async"
        />
      </picture>
      {useVideo ? (
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster={LANDING_ASSETS.santaStatic}
          aria-label={alt}
          onError={() => setUseVideo(false)}
        >
          <source src={LANDING_ASSETS.santaWebm} type="video/webm" />
        </video>
      ) : null}
    </div>
  );
}
