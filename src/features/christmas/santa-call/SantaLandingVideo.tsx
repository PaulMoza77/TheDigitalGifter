import { useEffect, useRef, useState } from "react";
import { NORTH_POLE_POSTER, NORTH_POLE_VIDEO_PREVIEW } from "./NorthPoleScene";
export function SantaLandingVideo({
  alt,
}: {
  alt: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [enabled, setEnabled] = useState(false),
    [failed, setFailed] = useState(false);
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
    const video = ref.current;
    if (!video || !enabled) return;
    const observer = new IntersectionObserver((entries) => {
      if (
        entries[0].isIntersecting &&
        !document.hidden
      )
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
  }, [enabled]);
  return (
    <>
      <img
        src={NORTH_POLE_POSTER}
        alt={alt}
        width="1080"
        height="1920"
        fetchPriority="high"
      />
      {enabled && !failed && (
        <video
          ref={ref}
          src={NORTH_POLE_VIDEO_PREVIEW}
          poster={NORTH_POLE_POSTER}
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
    </>
  );
}
