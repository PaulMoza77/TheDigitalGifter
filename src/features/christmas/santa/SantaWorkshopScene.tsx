import { memo } from "react";

/** Workshop Santa scene — CSS illustration (no final plate asset required for V1 structure). */
export const SantaWorkshopScene = memo(function SantaWorkshopScene({
  accentName,
  compact,
}: {
  accentName?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`santa-scene relative overflow-hidden ${compact ? "min-h-[220px] sm:min-h-[280px]" : "min-h-[320px] sm:min-h-[420px]"}`}
      aria-hidden={accentName ? undefined : true}
      role={accentName ? "img" : undefined}
      aria-label={accentName ? `Santa preparing a Christmas message for ${accentName}` : undefined}
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,rgba(212,175,55,0.22),transparent_55%),radial-gradient(ellipse_at_70%_80%,rgba(122,16,32,0.45),transparent_50%),linear-gradient(165deg,#0c1f18_0%,#132a22_38%,#1a0a10_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:radial-gradient(circle_at_18%_22%,rgba(255,236,180,0.5)_0_1.5px,transparent_2px),radial-gradient(circle_at_72%_18%,rgba(255,220,150,0.35)_0_1px,transparent_2px),radial-gradient(circle_at_88%_48%,rgba(255,210,120,0.4)_0_1.5px,transparent_2px)]" />

      {/* Fireplace glow */}
      <div className="santa-scene__fire absolute bottom-0 left-1/2 h-28 w-40 -translate-x-1/2 rounded-full bg-[#e8a54b]/35 blur-2xl" />
      <div className="absolute bottom-0 left-[12%] right-[12%] h-16 bg-gradient-to-t from-[#2a1208]/90 to-transparent" />

      {/* Tree silhouette */}
      <svg
        className="absolute bottom-6 right-[6%] h-[55%] w-24 text-[#1B4332] opacity-80 sm:w-32"
        viewBox="0 0 80 140"
        fill="currentColor"
      >
        <polygon points="40,8 68,48 55,48 72,78 58,78 78,112 2,112 22,78 8,78 25,48 12,48" />
        <rect x="34" y="112" width="12" height="18" fill="#4a2c14" />
        <circle cx="40" cy="14" r="3" fill="#d4af37" className="santa-scene__star" />
      </svg>

      {/* Presents */}
      <div className="absolute bottom-5 left-[10%] h-10 w-14 rounded-sm bg-[#7a1020] shadow-lg">
        <div className="absolute inset-y-0 left-1/2 w-1.5 -translate-x-1/2 bg-[#d4af37]" />
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 bg-[#d4af37]" />
      </div>
      <div className="absolute bottom-5 left-[22%] h-8 w-10 rounded-sm bg-[#1B4332] shadow-lg">
        <div className="absolute inset-y-0 left-1/2 w-1 -translate-x-1/2 bg-[#c9a227]" />
      </div>

      {/* Santa figure */}
      <div className="santa-scene__santa absolute bottom-8 left-1/2 w-[140px] -translate-x-1/2 sm:w-[170px]">
        <svg viewBox="0 0 160 220" className="h-auto w-full drop-shadow-[0_12px_28px_rgba(0,0,0,0.45)]">
          <ellipse cx="80" cy="208" rx="48" ry="8" fill="rgba(0,0,0,0.25)" />
          <path d="M40 200 Q80 150 120 200 Z" fill="#7a1020" />
          <path d="M48 165 Q80 120 112 165 Q80 175 48 165Z" fill="#9b1b2e" />
          <circle cx="80" cy="88" r="36" fill="#f3d2b3" />
          <path d="M45 70 Q80 20 115 70 L105 78 Q80 40 55 78 Z" fill="#7a1020" />
          <ellipse cx="80" cy="48" rx="10" ry="6" fill="#f5f0e6" />
          <circle cx="80" cy="34" r="8" fill="#f5f0e6" />
          <path d="M48 100 Q80 130 112 100 Q95 145 80 148 Q65 145 48 100Z" fill="#f5f0e6" />
          <circle cx="68" cy="88" r="3.5" fill="#2a1a12" />
          <circle cx="92" cy="88" r="3.5" fill="#2a1a12" />
          <ellipse cx="80" cy="102" rx="7" ry="5" fill="#c45c4a" />
          <path d="M62 110 Q80 122 98 110" fill="none" stroke="#8b4518" strokeWidth="2" strokeLinecap="round" />
          <rect x="70" y="148" width="20" height="14" rx="3" fill="#d4af37" />
        </svg>
      </div>

      {accentName ? (
        <p className="absolute left-4 top-4 max-w-[70%] font-[family-name:var(--santa-display)] text-lg text-[#F5EDE0] sm:text-xl">
          For {accentName}
        </p>
      ) : null}

      <style>{`
        .santa-scene__santa {
          animation: santa-idle 4.5s ease-in-out infinite;
          transform-origin: center bottom;
        }
        .santa-scene__fire {
          animation: santa-fire 2.8s ease-in-out infinite;
        }
        .santa-scene__star {
          animation: santa-twinkle 2.2s ease-in-out infinite;
        }
        @keyframes santa-idle {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          50% { transform: translateX(-50%) translateY(-4px); }
        }
        @keyframes santa-fire {
          0%, 100% { opacity: 0.55; transform: translateX(-50%) scale(1); }
          50% { opacity: 0.85; transform: translateX(-50%) scale(1.08); }
        }
        @keyframes santa-twinkle {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .santa-scene__santa,
          .santa-scene__fire,
          .santa-scene__star {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
});
