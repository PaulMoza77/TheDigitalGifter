import { useEffect, useState } from "react";
import { LANDING_ASSETS } from "./assets";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

/**
 * Santa cutout with transparent WebP assets (no black plate).
 * Image crossfade only — the legacy webm had an opaque black background.
 */
export function SantaPresence({ alt }: { alt: string }) {
  const reduced = usePrefersReducedMotion();
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    if (reduced) return;
    const id = window.setInterval(() => {
      setSpeaking((prev) => !prev);
    }, 2400);
    return () => window.clearInterval(id);
  }, [reduced]);

  return (
    <div className="xmas-santa__asset">
      <img
        src={speaking && !reduced ? LANDING_ASSETS.santaSpeak : LANDING_ASSETS.santaIdle}
        alt={alt}
        width={540}
        height={720}
        decoding="async"
      />
    </div>
  );
}
