/**
 * User-started demo: no heavy poster/MP4 until the card is mostly on-screen,
 * and no MP4 until the parent taps Play. Keeps mobile LCP on the hero H1/CTA.
 */
import { useEffect, useRef, useState } from "react";

const POSTER_JPG = "/assets/christmas/grace/grace-poster.jpg";
const POSTER_WEBP = "/assets/christmas/grace/grace-poster.webp";
const POSTER_WEBP_480 = "/assets/christmas/grace/grace-poster-480.webp";
const DEMO_SRC = "/assets/christmas/grace/grace-demo.mp4";

export function GraceLandingDemo() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [revealStill, setRevealStill] = useState(false);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof IntersectionObserver === "undefined") {
      setRevealStill(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.35)) {
          setRevealStill(true);
          observer.disconnect();
        }
      },
      { threshold: [0, 0.35, 0.6] },
    );
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={hostRef} className="sc-grace-demo">
      {started ? (
        <video
          controls
          autoPlay
          playsInline
          preload="metadata"
          width={720}
          height={1280}
          poster={POSTER_WEBP_480}
          src={DEMO_SRC}
          aria-label="Conversație cu Grace: ea răspunde, iar Moș Crăciun reacționează și îi spune numele."
        />
      ) : (
        <button
          type="button"
          className="sc-grace-demo-start"
          onClick={() => {
            setRevealStill(true);
            setStarted(true);
          }}
          aria-label="Redă conversația cu Grace"
        >
          {revealStill ? (
            <picture>
              <source
                type="image/webp"
                srcSet={`${POSTER_WEBP_480} 480w, ${POSTER_WEBP} 720w`}
                sizes="(max-width: 760px) 90vw, 420px"
              />
              <img
                src={POSTER_JPG}
                alt=""
                width={720}
                height={1280}
                decoding="async"
                fetchPriority="low"
              />
            </picture>
          ) : (
            <span className="sc-grace-placeholder" aria-hidden="true" />
          )}
          <span className="sc-grace-play" aria-hidden="true">
            ▶
          </span>
        </button>
      )}
    </div>
  );
}
