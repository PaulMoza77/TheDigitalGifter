import { memo, useMemo } from "react";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

/** Deterministic flakes for the window pane — no Math.random on each render. */
const WINDOW_FLAKES = Array.from({ length: 18 }, (_, i) => {
  const n = i + 1;
  return {
    id: i,
    left: 6 + ((n * 17) % 88),
    size: 1.5 + (n % 3) * 0.7,
    duration: 7 + (n % 6) * 1.1,
    delay: -((n * 0.9) % 10),
    opacity: 0.35 + (n % 4) * 0.12,
    drift: (n % 2 === 0 ? 1 : -1) * (4 + (n % 4) * 2),
  };
});

/** Soft tree-light points clustered on the left tree mass. */
const TREE_LIGHTS = [
  { left: "11%", top: "22%", delay: "0s", dur: "2.8s", size: 3 },
  { left: "16%", top: "28%", delay: "0.6s", dur: "3.4s", size: 2.5 },
  { left: "9%", top: "36%", delay: "1.1s", dur: "3.1s", size: 3.2 },
  { left: "18%", top: "34%", delay: "1.7s", dur: "2.6s", size: 2.2 },
  { left: "13%", top: "44%", delay: "0.3s", dur: "3.6s", size: 2.8 },
  { left: "20%", top: "48%", delay: "2.1s", dur: "2.9s", size: 2.4 },
  { left: "8%", top: "52%", delay: "1.4s", dur: "3.3s", size: 2.6 },
  { left: "15%", top: "58%", delay: "0.9s", dur: "3.0s", size: 3 },
  { left: "21%", top: "40%", delay: "2.4s", dur: "2.7s", size: 2.2 },
  { left: "12%", top: "66%", delay: "1.8s", dur: "3.5s", size: 2.5 },
  { left: "17%", top: "72%", delay: "0.5s", dur: "3.2s", size: 2.3 },
  { left: "7%", top: "42%", delay: "2.8s", dur: "2.5s", size: 2.1 },
];

/**
 * CSS-only atmosphere for the living-room hero: fire glow, window snow,
 * and tree-light twinkle. No video / heavy assets.
 */
export const HeroAtmosphere = memo(function HeroAtmosphere() {
  const reduced = usePrefersReducedMotion();
  const flakes = useMemo(() => WINDOW_FLAKES, []);

  return (
    <div className="xmas-hero__atmosphere" aria-hidden="true" data-reduced={reduced ? "true" : "false"}>
      <div className="xmas-hero__fire">
        <span className="xmas-hero__flame xmas-hero__flame--core" />
        <span className="xmas-hero__flame xmas-hero__flame--lift" />
        <span className="xmas-hero__flame xmas-hero__flame--side" />
        <span className="xmas-hero__fire-glow" />
      </div>

      <div className="xmas-hero__window">
        {!reduced
          ? flakes.map((flake) => (
              <span
                key={flake.id}
                className="xmas-hero__snowflake"
                style={{
                  left: `${flake.left}%`,
                  width: flake.size,
                  height: flake.size,
                  opacity: flake.opacity,
                  animationDuration: `${flake.duration}s`,
                  animationDelay: `${flake.delay}s`,
                  ["--wdrift" as string]: `${flake.drift}px`,
                }}
              />
            ))
          : null}
      </div>

      <div className="xmas-hero__tree-lights">
        {TREE_LIGHTS.map((light, i) => (
          <span
            key={i}
            className="xmas-hero__spark"
            style={{
              left: light.left,
              top: light.top,
              width: light.size,
              height: light.size,
              animationDelay: light.delay,
              animationDuration: light.dur,
            }}
          />
        ))}
      </div>

      <div className="xmas-hero__shimmer" />
    </div>
  );
});
