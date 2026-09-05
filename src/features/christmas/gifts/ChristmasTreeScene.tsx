import { TreeLightLayer } from "./TreeLightLayer";

type Props = {
  className?: string;
  reduceMotion?: boolean;
};

type Glow = {
  left: string;
  top: string;
  w: string;
  h: string;
  color: string;
  delay: string;
  duration: string;
};

const AMBIENT_GLOWS: Glow[] = [
  {
    left: "18%",
    top: "58%",
    w: "22%",
    h: "28%",
    color: "rgba(255,140,50,0.22)",
    delay: "0s",
    duration: "2.6s",
  },
  {
    left: "72%",
    top: "42%",
    w: "16%",
    h: "20%",
    color: "rgba(255,200,120,0.14)",
    delay: "0.8s",
    duration: "3.4s",
  },
  {
    left: "42%",
    top: "68%",
    w: "20%",
    h: "18%",
    color: "rgba(255,190,90,0.16)",
    delay: "1.4s",
    duration: "2.9s",
  },
  {
    left: "48%",
    top: "22%",
    w: "14%",
    h: "16%",
    color: "rgba(255,220,140,0.12)",
    delay: "0.4s",
    duration: "3.8s",
  },
];

const SNOW_DESKTOP = Array.from({ length: 16 }, (_, i) => ({
  left: `${62 + ((i * 17) % 34)}%`,
  delay: `${(i * 0.7) % 9}s`,
  duration: `${8 + (i % 10)}s`,
  size: 1.5 + (i % 3) * 0.6,
  opacity: 0.18 + (i % 4) * 0.04,
}));

const SNOW_MOBILE = Array.from({ length: 10 }, (_, i) => ({
  left: `${58 + ((i * 19) % 38)}%`,
  delay: `${(i * 0.9) % 8}s`,
  duration: `${9 + (i % 8)}s`,
  size: 1.4 + (i % 2) * 0.5,
  opacity: 0.16 + (i % 3) * 0.04,
}));

/**
 * Photoreal luxury-chalet scene — full-bleed raster + living ambient CSS.
 * Interactive gifts are separate DOM overlays (not baked into the image).
 */
export function ChristmasTreeScene({ className, reduceMotion }: Props) {
  return (
    <div
      className={className}
      role="img"
      aria-label="Luxury Christmas chalet with a realistic Christmas tree and gifts"
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: 280,
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: 0,
      }}
    >
      {/* z0 — environment background (single immersive plane) */}
      <div
        aria-hidden
        className={`absolute inset-0 ${reduceMotion ? "" : "gt-scene-breathe"}`}
        style={{ zIndex: 0, transformOrigin: "50% 45%" }}
      >
        <picture className="absolute inset-0 hidden md:block">
          <source type="image/webp" srcSet="/christmas/gifts/scene-desktop.webp" />
          <img
            src="/christmas/gifts/scene-desktop-1280.jpg"
            alt=""
            className="h-full w-full object-cover object-[center_52%]"
            decoding="async"
            fetchPriority="high"
            style={{ filter: "brightness(1.16) saturate(1.14) contrast(1.03)" }}
          />
        </picture>

        <picture className="absolute inset-0 md:hidden">
          <source type="image/webp" srcSet="/christmas/gifts/scene-mobile.webp" />
          <img
            src="/christmas/gifts/scene-mobile-640.jpg"
            alt=""
            className="h-full w-full object-cover object-[center_40%]"
            decoding="async"
            fetchPriority="high"
            style={{ filter: "brightness(1.18) saturate(1.15) contrast(1.03)" }}
          />
        </picture>
      </div>

      {/* z1 — soft edge vignette only; keep center vivid */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          zIndex: 1,
          background: `
            radial-gradient(ellipse at 50% 48%,
              transparent 34%,
              rgba(5,5,5,0.02) 62%,
              rgba(5,5,5,0.22) 100%),
            linear-gradient(180deg,
              rgba(8,6,5,0.08) 0%,
              transparent 10%,
              transparent 82%,
              rgba(8,6,5,0.26) 100%)
          `,
        }}
      />

      {/* Warm center lift — no blend mode (Safari-safe) */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          zIndex: 1,
          background:
            "radial-gradient(ellipse at 50% 42%, rgba(255,215,150,0.11) 0%, transparent 50%)",
        }}
      />

      {/* z2 — extremely restrained central frame (transparent, room continues) */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[7%] hidden h-[74%] w-[min(620px,64vw)] -translate-x-1/2 rounded-[24px] md:block"
        style={{
          zIndex: 2,
          border: "1px solid rgba(220,180,95,0.22)",
          background: "transparent",
          boxShadow: "none",
        }}
      />

      {/* z3 — ambient animation layers */}
      {!reduceMotion ? (
        <>
          {/* Fireplace flicker glow — stronger so fire reads alive */}
          <div
            aria-hidden
            className="gt-fire-glow absolute"
            style={{
              zIndex: 3,
              left: "6%",
              top: "50%",
              width: "30%",
              height: "40%",
              borderRadius: "50%",
              background:
                "radial-gradient(ellipse at 40% 60%, rgba(255,130,40,0.5) 0%, rgba(255,170,60,0.28) 32%, transparent 68%)",
              filter: "blur(16px)",
              mixBlendMode: "screen",
              animation: "gt-fire-flicker 2.2s ease-in-out infinite",
              willChange: "opacity, transform",
            }}
          />

          {AMBIENT_GLOWS.map((g, i) => (
            <div
              key={`ag-${i}`}
              aria-hidden
              className="gt-ambient-glow absolute rounded-full"
              style={{
                zIndex: 3,
                left: g.left,
                top: g.top,
                width: g.w,
                height: g.h,
                transform: "translate(-50%, -50%)",
                background: `radial-gradient(circle, ${g.color} 0%, transparent 70%)`,
                filter: "blur(22px)",
                mixBlendMode: "screen",
                animation: `gt-ambient-breathe ${g.duration} ease-in-out ${g.delay} infinite`,
                willChange: "opacity, transform",
              }}
            />
          ))}

          {/* Window snow — desktop (right exterior) */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 hidden overflow-hidden md:block"
            style={{ zIndex: 3, clipPath: "inset(8% 0 18% 58%)" }}
          >
            {SNOW_DESKTOP.map((s, i) => (
              <span
                key={`sd-${i}`}
                className="gt-snow absolute rounded-full bg-white"
                style={{
                  left: s.left,
                  top: "-4%",
                  width: s.size,
                  height: s.size,
                  opacity: s.opacity,
                  animation: `gt-snow-fall ${s.duration} linear ${s.delay} infinite`,
                  willChange: "transform, opacity",
                }}
              />
            ))}
          </div>

          {/* Window snow — mobile (right exterior) */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 overflow-hidden md:hidden"
            style={{ zIndex: 3, clipPath: "inset(10% 0 22% 52%)" }}
          >
            {SNOW_MOBILE.map((s, i) => (
              <span
                key={`sm-${i}`}
                className="gt-snow absolute rounded-full bg-white"
                style={{
                  left: s.left,
                  top: "-4%",
                  width: s.size,
                  height: s.size,
                  opacity: s.opacity,
                  animation: `gt-snow-fall ${s.duration} linear ${s.delay} infinite`,
                  willChange: "transform, opacity",
                }}
              />
            ))}
          </div>
        </>
      ) : null}

      <TreeLightLayer reduceMotion={reduceMotion} />

      <style>{`
        @keyframes gt-scene-breathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.006); }
        }
        .gt-scene-breathe {
          animation: gt-scene-breathe 24s ease-in-out infinite;
          will-change: transform;
        }
        @keyframes gt-fire-flicker {
          0%, 100% { opacity: 0.55; transform: scale(1) translate(0, 0); }
          30% { opacity: 0.85; transform: scale(1.06) translate(1%, -1%); }
          55% { opacity: 0.62; transform: scale(0.97) translate(-1%, 1%); }
          75% { opacity: 0.9; transform: scale(1.04) translate(0.5%, -0.5%); }
        }
        @keyframes gt-ambient-breathe {
          0%, 100% { opacity: 0.45; transform: translate(-50%, -50%) scale(0.96); }
          50% { opacity: 0.85; transform: translate(-50%, -50%) scale(1.05); }
        }
        @keyframes gt-snow-fall {
          0% { transform: translate3d(0, -5%, 0); opacity: 0; }
          8% { opacity: 0.35; }
          90% { opacity: 0.2; }
          100% { transform: translate3d(-8px, 110vh, 0); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .gt-scene-breathe,
          .gt-fire-glow,
          .gt-ambient-glow,
          .gt-snow {
            animation: none !important;
          }
          .gt-fire-glow { opacity: 0.5; }
          .gt-ambient-glow { opacity: 0.4; }
          .gt-snow { display: none; }
        }
      `}</style>
    </div>
  );
}
