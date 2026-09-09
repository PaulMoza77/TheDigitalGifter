import { memo } from "react";

const FLAKES = Array.from({ length: 28 }, (_, i) => {
  const n = i + 1;
  return {
    id: i,
    left: ((n * 37) % 100) + (n % 3) * 0.35,
    size: 2 + (n % 3),
    duration: 11 + (n % 8) * 1.4,
    delay: -((n * 1.2) % 14),
    opacity: 0.14 + (n % 5) * 0.08,
    drift: (n % 2 === 0 ? 1 : -1) * (8 + (n % 5) * 3),
  };
});

export const AmbientSnow = memo(function AmbientSnow() {
  return (
    <div className="xmas-ambient" aria-hidden="true">
      <div className="xmas-ambient__glow" />
      {FLAKES.map((flake) => (
        <span
          key={flake.id}
          className="xmas-flake"
          style={{
            left: `${flake.left}%`,
            width: flake.size,
            height: flake.size,
            opacity: flake.opacity,
            animationDuration: `${flake.duration}s`,
            animationDelay: `${flake.delay}s`,
            ["--drift" as string]: `${flake.drift}px`,
          }}
        />
      ))}
    </div>
  );
});
