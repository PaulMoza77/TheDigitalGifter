import { useMemo } from "react";

type Props = {
  className?: string;
  reduceMotion?: boolean;
};

/**
 * Photoreal luxury-chalet scene — raster WebP/JPEG layers + ambient CSS.
 * Interactive gifts are separate DOM overlays (not baked into the image).
 */
export function ChristmasTreeScene({ className, reduceMotion }: Props) {
  const ambient = useMemo(
    () =>
      reduceMotion
        ? null
        : Array.from({ length: 10 }, (_, i) => ({
            left: `${12 + ((i * 23) % 76)}%`,
            top: `${18 + ((i * 17) % 50)}%`,
            delay: `${i * 0.45}s`,
            size: 2 + (i % 3),
          })),
    [reduceMotion],
  );

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
        borderRadius: 0,
      }}
    >
      {/* Full-bleed ambient room fill */}
      <div
        aria-hidden
        className="absolute inset-0 scale-110"
        style={{
          backgroundImage: "url(/christmas/gifts/scene-ambient.jpg)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "blur(18px) saturate(1.05)",
          transform: "scale(1.12)",
        }}
      />

      {/* Desktop / tablet photoreal scene */}
      <picture className="absolute inset-0 hidden md:block">
        <source
          type="image/webp"
          srcSet="/christmas/gifts/scene-desktop.webp"
        />
        <img
          src="/christmas/gifts/scene-desktop-1280.jpg"
          alt=""
          className="h-full w-full object-cover object-[center_58%]"
          decoding="async"
          fetchPriority="high"
        />
      </picture>

      {/* Mobile photoreal scene */}
      <picture className="absolute inset-0 md:hidden">
        <source type="image/webp" srcSet="/christmas/gifts/scene-mobile.webp" />
        <img
          src="/christmas/gifts/scene-mobile-640.jpg"
          alt=""
          className="h-full w-full object-cover object-[center_42%]"
          decoding="async"
          fetchPriority="high"
        />
      </picture>

      {/* Soft vignette + warm center so edges blend into viewport */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse at 50% 42%, rgba(255,210,140,0.12) 0%, transparent 42%),
            radial-gradient(ellipse at 50% 50%, transparent 35%, rgba(0,0,0,0.45) 100%),
            linear-gradient(180deg, rgba(8,6,5,0.25) 0%, transparent 18%, transparent 72%, rgba(8,6,5,0.55) 100%)
          `,
        }}
      />

      {/* Subtle twinkle over tree lights */}
      {ambient
        ? ambient.map((dot, i) => (
            <span
              key={i}
              className="absolute rounded-full bg-amber-100"
              style={{
                left: dot.left,
                top: dot.top,
                width: dot.size,
                height: dot.size,
                opacity: 0.35,
                animation: `gt-twinkle ${2.8 + (i % 4) * 0.5}s ease-in-out ${dot.delay} infinite`,
              }}
            />
          ))
        : null}

      <style>{`
        @keyframes gt-twinkle {
          0%, 100% { opacity: 0.15; transform: scale(0.85); }
          50% { opacity: 0.7; transform: scale(1.15); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="gt-twinkle"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
