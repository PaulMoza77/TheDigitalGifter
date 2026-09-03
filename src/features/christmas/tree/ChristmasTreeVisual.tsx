import type { Decoration, TreeStyle } from "./treeApi";

const STYLE_PALETTE: Record<
  TreeStyle,
  { foliage: string; foliageDark: string; trunk: string; glow: string }
> = {
  classic: { foliage: "#1f6b3a", foliageDark: "#0f3d22", trunk: "#5c3a1e", glow: "#f5d76e" },
  snowy: { foliage: "#2a6b55", foliageDark: "#163d32", trunk: "#4a3728", glow: "#e8f4ff" },
  gold: { foliage: "#3d6b2e", foliageDark: "#1f3d18", trunk: "#6b4a1e", glow: "#d4af37" },
  cozy: { foliage: "#2d5a3d", foliageDark: "#1a3324", trunk: "#6b3e28", glow: "#ffb347" },
  minimal: { foliage: "#3a5f4a", foliageDark: "#243830", trunk: "#4a4038", glow: "#c8c8c8" },
  magical: { foliage: "#1a4d6b", foliageDark: "#0d2a3d", trunk: "#3d2a4a", glow: "#c9a0ff" },
};

type Props = {
  style: TreeStyle;
  decorations: Decoration;
  className?: string;
};

/** CSS/SVG Christmas tree — semantic styles, no WebGL. */
export function ChristmasTreeVisual({ style, decorations, className }: Props) {
  const p = STYLE_PALETTE[style] || STYLE_PALETTE.classic;
  const reduceMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  return (
    <div
      className={className}
      role="img"
      aria-label={`${style} Christmas tree`}
      style={{
        position: "relative",
        width: "100%",
        maxWidth: 320,
        margin: "0 auto",
        aspectRatio: "3 / 4",
      }}
    >
      <svg viewBox="0 0 200 260" width="100%" height="100%" aria-hidden="true">
        <defs>
          <linearGradient id={`foliage-${style}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={p.foliage} />
            <stop offset="100%" stopColor={p.foliageDark} />
          </linearGradient>
        </defs>
        <ellipse cx="100" cy="248" rx="54" ry="8" fill="rgba(0,0,0,0.18)" />
        <rect x="88" y="210" width="24" height="36" rx="3" fill={p.trunk} />
        <polygon points="100,18 28,95 172,95" fill={`url(#foliage-${style})`} />
        <polygon points="100,55 22,145 178,145" fill={`url(#foliage-${style})`} />
        <polygon points="100,95 18,205 182,205" fill={`url(#foliage-${style})`} />

        {decorations.ornaments !== "minimal" &&
          [
            [70, 80],
            [130, 88],
            [55, 130],
            [145, 135],
            [80, 165],
            [120, 170],
            [100, 110],
          ].map(([x, y], i) => (
            <circle
              key={`${x}-${y}`}
              cx={x}
              cy={y}
              r={decorations.ornaments === "gold" ? 6 : 5}
              fill={
                decorations.ornaments === "gold"
                  ? "#d4af37"
                  : decorations.ornaments === "colorful"
                    ? ["#e74c3c", "#3498db", "#f1c40f", "#9b59b6", "#e67e22", "#1abc9c", "#e91e63"][
                        i % 7
                      ]
                    : "#c0392b"
              }
            />
          ))}

        {decorations.lights &&
          [
            [60, 100],
            [140, 105],
            [45, 155],
            [155, 160],
            [95, 140],
            [110, 185],
          ].map(([x, y], i) => (
            <circle
              key={`l-${i}`}
              cx={x}
              cy={y}
              r={3}
              fill={p.glow}
              opacity={reduceMotion ? 0.85 : undefined}
            >
              {!reduceMotion ? (
                <animate
                  attributeName="opacity"
                  values="0.35;1;0.35"
                  dur={`${1.4 + (i % 3) * 0.35}s`}
                  repeatCount="indefinite"
                />
              ) : null}
            </circle>
          ))}

        {decorations.topper === "star" && (
          <polygon
            points="100,8 104,20 116,20 106,28 110,40 100,32 90,40 94,28 84,20 96,20"
            fill={p.glow}
          />
        )}
        {decorations.topper === "angel" && (
          <g fill={p.glow}>
            <circle cx="100" cy="14" r="6" />
            <rect x="94" y="20" width="12" height="14" rx="2" />
          </g>
        )}
        {decorations.topper === "bow" && (
          <path
            d="M88 22 Q100 8 112 22 Q100 18 88 22"
            fill="#c0392b"
            stroke={p.glow}
            strokeWidth="1"
          />
        )}

        {(decorations.snow || style === "snowy") &&
          [
            [40, 50],
            [160, 70],
            [30, 120],
            [170, 140],
            [50, 180],
            [150, 190],
          ].map(([x, y], i) => (
            <circle key={`s-${i}`} cx={x} cy={y} r={2} fill="#fff" opacity={0.7}>
              {!reduceMotion ? (
                <animate
                  attributeName="cy"
                  values={`${y};${y + 18};${y}`}
                  dur={`${3 + i * 0.4}s`}
                  repeatCount="indefinite"
                />
              ) : null}
            </circle>
          ))}
      </svg>
    </div>
  );
}
