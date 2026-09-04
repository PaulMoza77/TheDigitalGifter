import { useMemo } from "react";

type Props = {
  className?: string;
  reduceMotion?: boolean;
};

/** Premium full-viewport Christmas tree scene (SVG) — richer than the tree-creator widget. */
export function ChristmasTreeScene({ className, reduceMotion }: Props) {
  const lightDots = useMemo(
    () =>
      [
        [48, 92],
        [72, 78],
        [98, 70],
        [124, 82],
        [148, 96],
        [40, 128],
        [64, 118],
        [92, 110],
        [118, 122],
        [146, 134],
        [36, 168],
        [60, 158],
        [88, 150],
        [116, 162],
        [144, 172],
        [52, 198],
        [80, 190],
        [108, 198],
        [136, 206],
        [70, 228],
        [100, 222],
        [128, 232],
      ] as const,
    [],
  );

  const ornaments = useMemo(
    () =>
      [
        { x: 78, y: 100, r: 5.5, fill: "#e74c3c" },
        { x: 118, y: 108, r: 5, fill: "#f5d76e" },
        { x: 58, y: 145, r: 6, fill: "#c0392b" },
        { x: 138, y: 152, r: 5.5, fill: "#3498db" },
        { x: 90, y: 168, r: 5, fill: "#f1c40f" },
        { x: 112, y: 188, r: 6, fill: "#9b59b6" },
        { x: 70, y: 205, r: 5, fill: "#e67e22" },
        { x: 130, y: 212, r: 5.5, fill: "#1abc9c" },
        { x: 100, y: 130, r: 4.5, fill: "#ecf0f1" },
      ] as const,
    [],
  );

  return (
    <div
      className={className}
      role="img"
      aria-label="Magical Christmas tree with warm lights and ornaments"
      style={{
        position: "relative",
        width: "100%",
        maxWidth: 520,
        margin: "0 auto",
        aspectRatio: "3 / 4",
        filter: "drop-shadow(0 24px 48px rgba(0,0,0,0.45))",
      }}
    >
      <svg viewBox="0 0 200 280" width="100%" height="100%" aria-hidden="true">
        <defs>
          <linearGradient id="gt-foliage" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2f8a4e" />
            <stop offset="45%" stopColor="#1a5c34" />
            <stop offset="100%" stopColor="#0d3320" />
          </linearGradient>
          <linearGradient id="gt-foliage-mid" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#247a42" />
            <stop offset="100%" stopColor="#123d26" />
          </linearGradient>
          <radialGradient id="gt-glow" cx="50%" cy="40%" r="55%">
            <stop offset="0%" stopColor="rgba(245,215,110,0.35)" />
            <stop offset="70%" stopColor="rgba(245,215,110,0.05)" />
            <stop offset="100%" stopColor="rgba(245,215,110,0)" />
          </radialGradient>
          <filter id="gt-soft" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="1.4" />
          </filter>
        </defs>

        <ellipse cx="100" cy="268" rx="70" ry="10" fill="rgba(0,0,0,0.28)" />
        <circle cx="100" cy="120" r="95" fill="url(#gt-glow)" />

        <rect x="90" y="232" width="20" height="34" rx="3" fill="#5c3a1e" />
        <rect x="93" y="236" width="4" height="26" fill="rgba(255,255,255,0.08)" />

        <polygon points="100,28 42,108 158,108" fill="url(#gt-foliage)" />
        <polygon points="100,62 30,158 170,158" fill="url(#gt-foliage-mid)" />
        <polygon points="100,108 18,236 182,236" fill="url(#gt-foliage)" />

        {/* Soft snow dusting */}
        <path
          d="M48 108 Q100 98 152 108"
          fill="none"
          stroke="rgba(255,255,255,0.22)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M38 158 Q100 146 162 158"
          fill="none"
          stroke="rgba(255,255,255,0.16)"
          strokeWidth="3"
          strokeLinecap="round"
        />

        {ornaments.map((o, i) => (
          <g key={`orn-${i}`}>
            <circle cx={o.x} cy={o.y} r={o.r} fill={o.fill} opacity={0.95} />
            <circle
              cx={o.x - o.r * 0.3}
              cy={o.y - o.r * 0.35}
              r={o.r * 0.28}
              fill="rgba(255,255,255,0.45)"
            />
          </g>
        ))}

        {lightDots.map(([x, y], i) => (
          <circle
            key={`lt-${i}`}
            cx={x}
            cy={y}
            r={2.6}
            fill="#ffe9a8"
            filter="url(#gt-soft)"
            opacity={reduceMotion ? 0.85 : undefined}
            style={
              reduceMotion
                ? undefined
                : {
                    animation: `gt-light-pulse ${1.6 + (i % 5) * 0.35}s ease-in-out ${
                      (i % 7) * 0.18
                    }s infinite`,
                  }
            }
          />
        ))}

        {/* Star topper */}
        <polygon
          points="100,14 105,28 120,28 108,38 112,52 100,44 88,52 92,38 80,28 95,28"
          fill="#f5d76e"
          opacity={0.95}
        />
        {!reduceMotion ? (
          <circle cx="100" cy="30" r="18" fill="rgba(245,215,110,0.18)">
            <animate
              attributeName="opacity"
              values="0.12;0.28;0.12"
              dur="3.2s"
              repeatCount="indefinite"
            />
          </circle>
        ) : null}
      </svg>

      <style>{`
        @keyframes gt-light-pulse {
          0%, 100% { opacity: 0.35; }
          40% { opacity: 1; }
          70% { opacity: 0.55; }
        }
        @media (prefers-reduced-motion: reduce) {
          .gt-light-pulse, [style*="gt-light-pulse"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
