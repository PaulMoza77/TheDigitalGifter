import { TreeLightLayer } from "./TreeLightLayer";

type Props = {
  className?: string;
  reduceMotion?: boolean;
};

/**
 * Photoreal luxury-chalet scene.
 * Portrait video → mobile, landscape video → desktop.
 * Source stills are used only as posters / reduced-motion fallback (unmodified).
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
      <div aria-hidden className="absolute inset-0 bg-[#0a0705]" style={{ zIndex: 0 }}>
        {reduceMotion ? (
          <picture className="absolute inset-0 hidden md:block">
            <source type="image/webp" srcSet="/christmas/gifts/scene-desktop.webp" />
            <img
              src="/christmas/gifts/scene-desktop-1280.jpg"
              alt=""
              className="h-full w-full object-cover object-center"
              decoding="async"
              fetchPriority="high"
            />
          </picture>
        ) : (
          <video
            className="absolute inset-0 hidden h-full w-full object-cover object-center md:block"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            poster="/christmas/gifts/scene-desktop-1280.jpg"
          >
            <source src="/christmas/gifts/scene-desktop.mp4" type="video/mp4" />
          </video>
        )}

        {reduceMotion ? (
          <picture className="absolute inset-0 md:hidden">
            <source type="image/webp" srcSet="/christmas/gifts/scene-mobile.webp" />
            <img
              src="/christmas/gifts/scene-mobile-640.jpg"
              alt=""
              className="h-full w-full object-cover object-center"
              decoding="async"
              fetchPriority="high"
            />
          </picture>
        ) : (
          <video
            className="absolute inset-0 h-full w-full object-cover object-center md:hidden"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            poster="/christmas/gifts/scene-mobile-640.jpg"
          >
            <source src="/christmas/gifts/scene-mobile.mp4" type="video/mp4" />
          </video>
        )}
      </div>

      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          zIndex: 1,
          background: `
            radial-gradient(ellipse at 50% 48%,
              transparent 38%,
              rgba(5,5,5,0.04) 70%,
              rgba(5,5,5,0.2) 100%),
            linear-gradient(180deg,
              rgba(8,6,5,0.06) 0%,
              transparent 12%,
              transparent 78%,
              rgba(8,6,5,0.28) 100%)
          `,
        }}
      />

      {reduceMotion ? <TreeLightLayer reduceMotion /> : null}
    </div>
  );
}
