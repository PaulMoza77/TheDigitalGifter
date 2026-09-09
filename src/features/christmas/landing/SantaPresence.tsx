import { useEffect, useRef, useState } from "react";
import { LANDING_ASSETS } from "./assets";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

export function SantaPresence({ alt }: { alt: string }) {
  const reduced = usePrefersReducedMotion();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [useVideo, setUseVideo] = useState(!reduced);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    if (reduced) {
      setUseVideo(false);
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    const play = () => {
      video.play().catch(() => setUseVideo(false));
    };
    play();
  }, [reduced, useVideo]);

  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => {
      setSpeaking((prev) => !prev);
    }, 2400);
    return () => window.clearInterval(id);
  }, [reduced]);

  return (
    <div className="xmas-santa__asset">
      {useVideo ? (
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          poster={LANDING_ASSETS.santaIdle}
          aria-label={alt}
          onError={() => setUseVideo(false)}
        >
          <source src={LANDING_ASSETS.santaWebm} type="video/webm" />
        </video>
      ) : (
        <img
          src={speaking && !reduced ? LANDING_ASSETS.santaSpeak : LANDING_ASSETS.santaIdle}
          alt={alt}
          width={540}
          height={720}
          decoding="async"
        />
      )}
    </div>
  );
}
