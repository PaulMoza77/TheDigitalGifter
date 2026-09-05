import { useMemo } from "react";
import { SCENE_MOODS, type GiftSceneMood } from "./sceneMoods";

type Props = {
  className?: string;
  reduceMotion?: boolean;
  mood?: GiftSceneMood;
};

/**
 * Cinematic luxury-suite backdrop + organic Christmas tree.
 * SVG/CSS only — tuned for mobile-first premium impression.
 */
export function ChristmasTreeScene({
  className,
  reduceMotion,
  mood = "alpine_suite",
}: Props) {
  const theme = SCENE_MOODS[mood];

  const lights = useMemo(
    () =>
      [
        [100, 58, 1],
        [88, 78, 0],
        [112, 82, 1],
        [76, 102, 0],
        [124, 108, 1],
        [96, 118, 0],
        [108, 128, 1],
        [68, 138, 0],
        [132, 144, 1],
        [86, 156, 0],
        [116, 162, 1],
        [58, 174, 0],
        [100, 178, 1],
        [142, 184, 0],
        [74, 196, 1],
        [126, 202, 0],
        [94, 214, 1],
        [64, 224, 0],
        [136, 228, 1],
        [84, 240, 0],
        [112, 246, 1],
        [78, 148, 0],
        [120, 188, 1],
        [70, 218, 0],
        [130, 166, 1],
        [90, 98, 0],
        [110, 208, 1],
      ] as const,
    [],
  );

  const ornaments = useMemo(
    () =>
      [
        { x: 84, y: 96, r: 4.4, c: "#c45c4a" },
        { x: 118, y: 104, r: 3.9, c: "#d4af6a" },
        { x: 72, y: 136, r: 4.8, c: "#8b1e2d" },
        { x: 130, y: 144, r: 4.1, c: "#c9a227" },
        { x: 96, y: 154, r: 3.5, c: "#e8e2d6" },
        { x: 114, y: 172, r: 4.5, c: "#5b7c8a" },
        { x: 78, y: 190, r: 4.0, c: "#b84a3a" },
        { x: 128, y: 198, r: 3.8, c: "#d4af6a" },
        { x: 94, y: 218, r: 4.3, c: "#8b1e2d" },
        { x: 110, y: 234, r: 3.6, c: "#e8e2d6" },
        { x: 88, y: 176, r: 3.3, c: "#d4af6a" },
        { x: 120, y: 128, r: 3.5, c: "#c45c4a" },
        { x: 66, y: 210, r: 3.7, c: "#d4af6a" },
        { x: 138, y: 216, r: 3.4, c: "#e8e2d6" },
      ] as const,
    [],
  );

  /** Dense short needles — readable at phone size */
  const needles = useMemo(() => {
    const pts: Array<{ x1: number; y1: number; x2: number; y2: number; o: number }> =
      [];
    const bands = [
      { cy: 70, halfW: 28, n: 12 },
      { cy: 95, halfW: 42, n: 16 },
      { cy: 125, halfW: 56, n: 20 },
      { cy: 158, halfW: 70, n: 24 },
      { cy: 192, halfW: 82, n: 26 },
      { cy: 228, halfW: 92, n: 28 },
      { cy: 255, halfW: 96, n: 22 },
    ];
    for (const t of bands) {
      for (let i = 0; i < t.n; i++) {
        const side = i % 2 === 0 ? -1 : 1;
        const along = (i / Math.max(t.n - 1, 1)) * 0.94 + 0.03;
        const x = 100 + side * t.halfW * along;
        const y = t.cy + (i % 5) * 1.8 - 4;
        const len = 6 + (i % 5);
        pts.push({
          x1: x,
          y1: y,
          x2: x + side * len * 0.9,
          y2: y + len * 0.5,
          o: 0.22 + (i % 4) * 0.07,
        });
      }
    }
    return pts;
  }, []);

  const snowflakes = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => ({
        x: 16 + ((i * 17) % 72),
        y: 22 + ((i * 13) % 95),
        r: 0.55 + (i % 3) * 0.4,
        delay: (i % 5) * 0.35,
        dur: 3.8 + (i % 4),
      })),
    [],
  );

  return (
    <div
      className={className}
      role="img"
      aria-label="Luxury Christmas suite with a premium Christmas tree and gifts"
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: 280,
        borderRadius: 28,
        overflow: "hidden",
        pointerEvents: "none",
        boxShadow:
          "inset 0 0 0 1px rgba(255,255,255,0.07), 0 28px 70px rgba(0,0,0,0.5)",
      }}
    >
      {/* Room volume */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: `
            linear-gradient(180deg, rgba(0,0,0,0.22) 0%, transparent 14%),
            linear-gradient(90deg, rgba(0,0,0,0.38) 0%, transparent 14%, transparent 86%, rgba(0,0,0,0.38) 100%),
            radial-gradient(ellipse at 50% 100%, ${theme.accentGlow} 0%, transparent 52%),
            linear-gradient(180deg, ${theme.roomWarmth} 0%, ${theme.wood} 54%, ${theme.carpet} 100%)
          `,
        }}
      />

      {/* Wall paneling + crown molding */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0"
        style={{
          height: "52%",
          background: `
            repeating-linear-gradient(
              90deg,
              rgba(255,255,255,0.02) 0px,
              rgba(255,255,255,0.02) 1px,
              transparent 1px,
              transparent 36px
            ),
            linear-gradient(180deg, rgba(255,255,255,0.06), transparent 40%)
          `,
          opacity: 0.8,
        }}
      />
      <div
        aria-hidden
        className="absolute inset-x-[4%] top-[5.5%] h-[1.5px]"
        style={{ background: "linear-gradient(90deg, transparent, rgba(212,175,110,0.35), transparent)" }}
      />

      {/* Ceiling fairy lights */}
      <svg
        aria-hidden
        className="absolute inset-x-[5%] top-[1.5%] h-7 w-[90%]"
        viewBox="0 0 200 22"
        preserveAspectRatio="none"
      >
        <path
          d="M0 7 Q50 16 100 5 T200 9"
          fill="none"
          stroke="rgba(212,175,110,0.32)"
          strokeWidth="0.7"
        />
        {[10, 32, 54, 76, 98, 120, 142, 164, 186].map((x, i) => (
          <circle
            key={x}
            cx={x}
            cy={i % 2 === 0 ? 9 : 13}
            r="1.55"
            fill={i % 3 === 0 ? "#f0c090" : "#ffe6a8"}
            style={
              reduceMotion
                ? { opacity: 0.7 }
                : {
                    animation: `gt-light-breathe ${2.3 + (i % 3) * 0.45}s ease-in-out ${
                      i * 0.16
                    }s infinite`,
                  }
            }
          />
        ))}
      </svg>

      {/* Panoramic night window */}
      <div
        aria-hidden
        className="absolute left-[6%] top-[8%] right-[6%] h-[30%] overflow-hidden rounded-[14px]"
        style={{
          boxShadow:
            "inset 0 0 0 2px rgba(212,175,110,0.22), 0 16px 40px rgba(0,0,0,0.42)",
          background: theme.windowSky,
        }}
      >
        <div
          className="absolute inset-x-0 bottom-0 h-[60%]"
          style={{
            background: `
              linear-gradient(180deg, transparent, rgba(190,210,230,0.14)),
              radial-gradient(ellipse at 28% 100%, rgba(230,235,245,0.4) 0%, transparent 48%),
              radial-gradient(ellipse at 72% 100%, rgba(200,215,230,0.32) 0%, transparent 46%)
            `,
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 76% 16%, rgba(255,255,255,0.65) 0 2.4px, transparent 3.4px), radial-gradient(circle at 24% 34%, rgba(255,255,255,0.35) 0 1px, transparent 2px)",
          }}
        />
        {!reduceMotion
          ? snowflakes.map((s, i) => (
              <span
                key={i}
                className="absolute rounded-full bg-white/75"
                style={{
                  left: `${s.x}%`,
                  top: `${s.y}%`,
                  width: s.r * 2,
                  height: s.r * 2,
                  animation: `gt-window-snow ${s.dur}s linear ${s.delay}s infinite`,
                }}
              />
            ))
          : null}
        <div
          className="absolute inset-y-0 left-0 w-[15%]"
          style={{
            background:
              "linear-gradient(90deg, rgba(78,40,34,0.96), rgba(118,68,52,0.5), transparent)",
          }}
        />
        <div
          className="absolute inset-y-0 right-0 w-[15%]"
          style={{
            background:
              "linear-gradient(270deg, rgba(78,40,34,0.96), rgba(118,68,52,0.5), transparent)",
          }}
        />
        <div
          className="absolute inset-x-[13%] top-0 h-[11%]"
          style={{
            background: "linear-gradient(180deg, rgba(212,175,110,0.42), transparent)",
          }}
        />
        <div
          className="absolute left-1/2 top-[7%] bottom-[7%] w-px -translate-x-1/2"
          style={{ background: "rgba(212,175,110,0.2)" }}
        />
        <div
          className="absolute inset-x-[7%] top-1/2 h-px"
          style={{ background: "rgba(212,175,110,0.12)" }}
        />
      </div>

      {/* Lounge chairs */}
      <div
        aria-hidden
        className="absolute bottom-[16%] left-[1%] h-[24%] w-[13%] rounded-t-[42%]"
        style={{
          background:
            "linear-gradient(180deg, rgba(62,38,30,0.62), rgba(28,16,12,0.78))",
          boxShadow: "inset 0 10px 18px rgba(255,200,140,0.07)",
        }}
      />
      <div
        aria-hidden
        className="absolute bottom-[16%] right-[1%] h-[24%] w-[13%] rounded-t-[42%]"
        style={{
          background:
            "linear-gradient(180deg, rgba(62,38,30,0.62), rgba(28,16,12,0.78))",
          boxShadow: "inset 0 10px 18px rgba(255,200,140,0.07)",
        }}
      />

      {/* Floor lamps */}
      <div
        aria-hidden
        className="absolute left-[2%] top-[38%] h-[22%] w-[11%] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(255,190,110,0.55) 0%, transparent 68%)",
          filter: "blur(2px)",
        }}
      />
      <div
        aria-hidden
        className="absolute right-[2%] top-[38%] h-[22%] w-[11%] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(255,190,110,0.55) 0%, transparent 68%)",
          filter: "blur(2px)",
        }}
      />

      {/* Rug */}
      <div
        aria-hidden
        className="absolute bottom-[2.5%] left-1/2 h-[15%] w-[84%] -translate-x-1/2 rounded-[100%]"
        style={{
          background:
            "radial-gradient(ellipse at 50% 50%, rgba(150,55,48,0.4) 0%, rgba(90,40,32,0.2) 42%, transparent 72%)",
          boxShadow: "0 0 50px rgba(0,0,0,0.42)",
        }}
      />

      <svg
        viewBox="0 0 200 320"
        width="100%"
        height="100%"
        className="absolute inset-0"
        aria-hidden="true"
        preserveAspectRatio="xMidYMax meet"
        style={
          reduceMotion
            ? undefined
            : { animation: "gt-scene-breathe 9s ease-in-out infinite" }
        }
      >
        <defs>
          <linearGradient id="gt-foliage-lit" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5aad6e" />
            <stop offset="22%" stopColor="#2f7a45" />
            <stop offset="65%" stopColor="#174a2a" />
            <stop offset="100%" stopColor="#071a10" />
          </linearGradient>
          <linearGradient id="gt-foliage-mid" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#3f8f55" />
            <stop offset="50%" stopColor="#1c5730" />
            <stop offset="100%" stopColor="#0a2818" />
          </linearGradient>
          <linearGradient id="gt-foliage-deep" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2a6a3c" />
            <stop offset="100%" stopColor="#04140c" />
          </linearGradient>
          <radialGradient id="gt-tree-glow" cx="50%" cy="30%" r="58%">
            <stop offset="0%" stopColor="rgba(255,220,145,0.4)" />
            <stop offset="40%" stopColor="rgba(255,200,100,0.1)" />
            <stop offset="100%" stopColor="rgba(255,200,100,0)" />
          </radialGradient>
          <filter id="gt-soft-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.8" />
          </filter>
          <filter id="gt-branch-blur" x="-6%" y="-6%" width="112%" height="112%">
            <feGaussianBlur stdDeviation="0.22" />
          </filter>
        </defs>

        <ellipse cx="100" cy="302" rx="70" ry="11" fill="rgba(0,0,0,0.45)" />
        <circle cx="100" cy="145" r="95" fill="url(#gt-tree-glow)" />

        {/* Planter + trunk */}
        <ellipse cx="100" cy="294" rx="24" ry="5.5" fill="#3a2818" opacity="0.9" />
        <path
          d="M76 294 Q100 278 124 294 Q100 302 76 294Z"
          fill="#4a3220"
        />
        <rect x="92" y="262" width="16" height="32" rx="2" fill="#5c3c24" />
        <rect x="95" y="264" width="3" height="28" fill="rgba(255,255,255,0.1)" />

        {/* Organic foliage — irregular overlapping lobes (not stacked triangles) */}
        <g filter="url(#gt-branch-blur)">
          {/* Back depth mass */}
          <path
            d="M100 48
               C122 70 138 96 148 128
               C136 120 118 116 100 116
               C82 116 64 120 52 128
               C62 96 78 70 100 48Z"
            fill="url(#gt-foliage-deep)"
            opacity="0.9"
          />

          {/* Upper crown — asymmetrical */}
          <path
            d="M100 36
               C112 48 124 62 132 80
               C124 74 112 72 100 72
               C88 72 78 74 68 82
               C78 60 90 46 100 36Z"
            fill="url(#gt-foliage-lit)"
          />
          <ellipse cx="92" cy="78" rx="18" ry="14" fill="url(#gt-foliage-mid)" opacity="0.85" />
          <ellipse cx="110" cy="82" rx="16" ry="13" fill="url(#gt-foliage-lit)" opacity="0.8" />

          {/* Mid-upper */}
          <path
            d="M100 66
               C126 90 146 116 156 146
               C140 136 120 132 100 132
               C80 132 60 136 44 146
               C54 116 74 90 100 66Z"
            fill="url(#gt-foliage-mid)"
          />
          <ellipse cx="74" cy="118" rx="22" ry="16" fill="url(#gt-foliage-deep)" opacity="0.75" />
          <ellipse cx="128" cy="122" rx="24" ry="17" fill="url(#gt-foliage-lit)" opacity="0.7" />
          <ellipse cx="100" cy="128" rx="28" ry="12" fill="url(#gt-foliage-mid)" opacity="0.65" />

          {/* Mid */}
          <path
            d="M100 108
               C134 138 158 170 170 204
               C148 190 122 184 100 184
               C78 184 52 190 30 204
               C42 170 66 138 100 108Z"
            fill="url(#gt-foliage-deep)"
          />
          <ellipse cx="62" cy="168" rx="28" ry="20" fill="url(#gt-foliage-mid)" opacity="0.8" />
          <ellipse cx="140" cy="172" rx="30" ry="21" fill="url(#gt-foliage-lit)" opacity="0.72" />
          <ellipse cx="96" cy="178" rx="34" ry="14" fill="url(#gt-foliage-mid)" opacity="0.6" />

          {/* Lower canopy */}
          <path
            d="M100 152
               C140 186 168 222 184 262
               C156 246 126 240 100 240
               C74 240 44 246 16 262
               C32 222 60 186 100 152Z"
            fill="url(#gt-foliage-mid)"
          />
          <ellipse cx="48" cy="220" rx="32" ry="22" fill="url(#gt-foliage-deep)" opacity="0.78" />
          <ellipse cx="154" cy="224" rx="34" ry="23" fill="url(#gt-foliage-lit)" opacity="0.7" />
          <ellipse cx="100" cy="236" rx="42" ry="16" fill="url(#gt-foliage-deep)" opacity="0.55" />

          {/* Skirt */}
          <path
            d="M100 196
               C146 230 172 258 192 288
               C158 276 128 270 100 270
               C72 270 42 276 8 288
               C28 258 54 230 100 196Z"
            fill="url(#gt-foliage-deep)"
          />
          <ellipse cx="40" cy="262" rx="28" ry="16" fill="url(#gt-foliage-mid)" opacity="0.65" />
          <ellipse cx="160" cy="264" rx="30" ry="16" fill="url(#gt-foliage-lit)" opacity="0.6" />
        </g>

        {/* Needle fringe */}
        <g strokeLinecap="round">
          {needles.map((n, i) => (
            <line
              key={`n-${i}`}
              x1={n.x1}
              y1={n.y1}
              x2={n.x2}
              y2={n.y2}
              stroke={
                i % 3 === 0 ? "rgba(170,220,160,0.42)" : "rgba(30,80,48,0.6)"
              }
              strokeWidth={0.75}
              opacity={n.o}
            />
          ))}
        </g>

        {/* Soft highlight arcs */}
        <path
          d="M72 110 Q100 96 128 110"
          fill="none"
          stroke="rgba(200,235,190,0.22)"
          strokeWidth="1.1"
        />
        <path
          d="M52 164 Q100 144 148 164"
          fill="none"
          stroke="rgba(190,230,180,0.16)"
          strokeWidth="1.2"
        />
        <path
          d="M36 220 Q100 196 164 220"
          fill="none"
          stroke="rgba(180,220,170,0.13)"
          strokeWidth="1.3"
        />

        {ornaments.map((o, i) => (
          <g key={`o-${i}`}>
            <circle cx={o.x} cy={o.y + 0.8} r={o.r + 0.5} fill="rgba(0,0,0,0.28)" />
            <circle cx={o.x} cy={o.y} r={o.r} fill={o.c} opacity={0.95} />
            <circle
              cx={o.x - o.r * 0.3}
              cy={o.y - o.r * 0.34}
              r={o.r * 0.3}
              fill="rgba(255,255,255,0.5)"
            />
          </g>
        ))}

        {lights.map(([x, y, warm], i) => (
          <circle
            key={`l-${i}`}
            cx={x}
            cy={y}
            r={warm ? 2.6 : 2.2}
            fill={
              warm
                ? "#ffe6a8"
                : i % 5 === 0
                  ? "#f0b8c8"
                  : i % 7 === 0
                    ? "#b8d4f0"
                    : "#ffe6a8"
            }
            filter="url(#gt-soft-glow)"
            style={
              reduceMotion
                ? { opacity: 0.85 }
                : {
                    animation: `gt-light-breathe ${2 + (i % 5) * 0.4}s ease-in-out ${
                      (i % 6) * 0.2
                    }s infinite`,
                  }
            }
          />
        ))}

        {/* Star topper */}
        <g transform="translate(100 32)">
          <polygon
            points="0,-15 3.5,-3.5 15,-3.5 5.5,2.5 9,14.5 0,7 -9,14.5 -5.5,2.5 -15,-3.5 -3.5,-3.5"
            fill="#e8c97a"
          />
          <polygon
            points="0,-9 2,-2.2 9,-2.2 3.4,1.5 5.5,8.5 0,4.2 -5.5,8.5 -3.4,1.5 -9,-2.2 -2,-2.2"
            fill="#fff4d0"
            opacity="0.55"
          />
          {!reduceMotion ? (
            <circle r="22" fill="rgba(232,201,122,0.2)">
              <animate
                attributeName="opacity"
                values="0.1;0.32;0.1"
                dur="3.2s"
                repeatCount="indefinite"
              />
            </circle>
          ) : null}
        </g>
      </svg>

      <style>{`
        @keyframes gt-light-breathe {
          0%, 100% { opacity: 0.35; }
          45% { opacity: 1; }
          70% { opacity: 0.55; }
        }
        @keyframes gt-window-snow {
          0% { transform: translateY(0); opacity: 0.55; }
          100% { transform: translateY(54px); opacity: 0; }
        }
        @keyframes gt-scene-breathe {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-2.5px); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="gt-light-breathe"],
          [style*="gt-window-snow"],
          [style*="gt-scene-breathe"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
