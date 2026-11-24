import { useEffect, useRef, useState } from "react";
import {
  NORTH_POLE_POSTER,
  NORTH_POLE_POSTER_WEBP,
  NORTH_POLE_POSTER_MOBILE_WEBP,
  NORTH_POLE_VIDEO_PREVIEW,
} from "./NorthPoleScene";

export function SantaLandingVideo({ alt }: { alt: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [near, setNear] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const connection = (
      navigator as Navigator & { connection?: { saveData?: boolean } }
    ).connection;
    setEnabled(!reduced.matches && !connection?.saveData);
    const change = () => setEnabled(!reduced.matches && !connection?.saveData);
    reduced.addEventListener?.("change", change);
    return () => reduced.removeEventListener?.("change", change);
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: "120px 0px" },
    );
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !enabled || !near) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && !document.hidden)
        void video.play().catch(() => {});
      else video.pause();
    });
    observer.observe(video);
    const visibility = () => {
      if (document.hidden) video.pause();
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [enabled, near]);

  return (
    <div ref={hostRef} className="sc-landing-video">
      <picture>
        <source
          type="image/webp"
          srcSet={`${NORTH_POLE_POSTER_MOBILE_WEBP} 750w, ${NORTH_POLE_POSTER_WEBP} 1080w`}
          sizes="(max-width: 760px) 90vw, 420px"
        />
        <img
          src={NORTH_POLE_POSTER}
          alt={alt}
          width={1080}
          height={1920}
          loading="lazy"
          decoding="async"
        />
      </picture>
      {near && enabled && !failed && (
        <video
          ref={videoRef}
          src={NORTH_POLE_VIDEO_PREVIEW}
          poster={NORTH_POLE_POSTER_MOBILE_WEBP}
          muted
          playsInline
          loop
          preload="none"
          aria-label={alt}
          onError={() => {
            setFailed(true);
          }}
        />
      )}
    </div>
  );
}
