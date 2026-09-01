import { memo, useMemo, type CSSProperties } from "react";

/** Deterministic flake layout — computed once, no runtime random churn. */
const FLAKE_COUNT = 52;

function buildFlakes() {
  return Array.from({ length: FLAKE_COUNT }, (_, i) => {
    const n = i + 1;
    return {
      id: i,
      left: ((n * 37) % 100) + (n % 3) * 0.4,
      size: 2 + (n % 4) * 0.75,
      duration: 9 + (n % 7) * 1.6,
      delay: -((n * 1.13) % 16),
      opacity: 0.12 + (n % 6) * 0.06,
      drift: (n % 2 === 0 ? 1 : -1) * (6 + (n % 5) * 3),
    };
  });
}

const FLAKES = buildFlakes();

export const ChristmasSnowfall = memo(function ChristmasSnowfall() {
  const flakes = useMemo(() => FLAKES, []);

  return (
    <div
      aria-hidden="true"
      className="christmas-snow pointer-events-none absolute inset-0 overflow-hidden"
    >
      {flakes.map((flake) => (
        <span
          key={flake.id}
          className="christmas-snow__flake absolute rounded-full bg-white"
          style={
            {
              left: `${flake.left}%`,
              top: "-4%",
              width: `${flake.size}px`,
              height: `${flake.size}px`,
              opacity: flake.opacity,
              animationDuration: `${flake.duration}s`,
              animationDelay: `${flake.delay}s`,
              "--cv2-drift": `${flake.drift}px`,
              "--flake-opacity": flake.opacity,
            } as CSSProperties
          }
        />
      ))}
      <style>{`
        .christmas-snow {
          contain: strict;
          z-index: 1;
        }
        .christmas-snow__flake {
          will-change: transform, opacity;
          animation-name: cv2-snow-fall;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
        @keyframes cv2-snow-fall {
          0% {
            transform: translate3d(0, -6vh, 0);
            opacity: 0;
          }
          8% {
            opacity: var(--flake-opacity, 0.35);
          }
          100% {
            transform: translate3d(var(--cv2-drift, 0px), 106vh, 0);
            opacity: 0;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .christmas-snow__flake {
            animation: none !important;
            opacity: 0.08 !important;
          }
        }
      `}</style>
    </div>
  );
});
