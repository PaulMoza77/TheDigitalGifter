import { useMemo } from "react";
import { SCENE_MOODS, type GiftSceneMood } from "./sceneMoods";

type Props = {
  className?: string;
  reduceMotion?: boolean;
  mood?: GiftSceneMood;
};

/**
 * Luxury holiday suite backdrop + premium layered Christmas tree.
 * Pure SVG/CSS — no external assets required.
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
        [88, 72, 1],
        [112, 78, 0],
        [100, 96, 1],
        [74, 112, 0],
        [126, 118, 1],
        [92, 130, 0],
        [110, 138, 1],
        [68, 152, 0],
        [132, 158, 1],
        [86, 170, 0],
        [116, 176, 1],
        [58, 188, 0],
        [100, 192, 1],
        [142, 196, 0],
        [76, 210, 1],
        [124, 216, 0],
        [98, 228, 1],
        [64, 236, 0],
        [136, 240, 1],
        [88, 250, 0],
        [112, 256, 1],
        [80, 140, 0],
        [120, 200, 1],
        [70, 230, 0],
        [130, 175, 1],
      ] as const,
    [],
  );

  const ornaments = useMemo(
    () =>
      [
        { x: 82, y: 108, r: 4.2, c: "#c45c4a" },
        { x: 118, y: 114, r: 3.8, c: "#d4af6a" },
        { x: 70, y: 148, r: 4.6, c: "#8b1e2d" },
        { x: 130, y: 156, r: 4.0, c: "#c9a227" },
        { x: 94, y: 168, r: 3.6, c: "#e8e2d6" },
        { x: 112, y: 186, r: 4.4, c: "#5b7c8a" },
        { x: 78, y: 204, r: 4.0, c: "#b84a3a" },
        { x: 126, y: 212, r: 3.8, c: "#d4af6a" },
        { x: 96, y: 232, r: 4.2, c: "#8b1e2d" },
        { x: 108, y: 248, r: 3.5, c: "#e8e2d6" },
        { x: 88, y: 190, r: 3.2, c: "#d4af6a" },
        { x: 118, y: 140, r: 3.4, c: "#c45c4a" },
      ] as const,
    [],
  );

  /** Fine needle tips for natural foliage texture */
  const needles = useMemo(() => {
    const pts: Array<{ x1: number; y1: number; x2: number; y2: number; o: number }> = [];
    const tiers = [
      { cy: 78, halfW: 38, n: 10 },
      { cy: 110, halfW: 52, n: 14 },
      { cy: 148, halfW: 68, n: 16 },
      { cy: 190, halfW: 82, n: 18 },
      { cy: 232, halfW: 90, n: 20 },
    ];
    for (const t of tiers) {
      for (let i = 0; i < t.n; i++) {
        const side = i % 2 === 0 ? -1 : 1;
        const along = (i / (t.n - 1)) * 0.92 + 0.04;
        const x = 100 + side * t.halfW * along;
        const y = t.cy + (i % 3) * 2.2 - 3;
        const len = 7 + (i % 4);
        pts.push({
          x1: x,
          y1: y,
          x2: x + side * len * 0.85,
          y2: y + len * 0.55,
          o: 0.18 + (i % 4) * 0.05,
        });
      }
    }
    return pts;
  }, []);

  const snowflakes = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        x: 18 + ((i * 17) % 70),
        y: 28 + ((i * 13) % 90),
        r: 0.6 + (i % 3) * 0.35,
        delay: (i % 5) * 0.4,
        dur: 4 + (i % 4),
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
          "inset 0 0 0 1px rgba(255,255,255,0.06), 0 30px 80px rgba(0,0,0,0.45)",
      }}
    >
      {/* Room shell */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: `
            linear-gradient(180deg, rgba(0,0,0,0.18) 0%, transparent 16%),
            linear-gradient(90deg, rgba(0,0,0,0.32) 0%, transparent 16%, transparent 84%, rgba(0,0,0,0.32) 100%),
            radial-gradient(ellipse at 50% 100%, ${theme.accentGlow} 0%, transparent 55%),
            linear-gradient(180deg, ${theme.roomWarmth} 0%, ${theme.wood} 58%, ${theme.carpet} 100%)
          `,
        }}
      />

      {/* Wood paneling */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0"
        style={{
          height: "56%",
          background: `
            repeating-linear-gradient(
              90deg,
              rgba(255,255,255,0.018) 0px,
              rgba(255,255,255,0.018) 1px,
              transparent 1px,
              transparent 38px
            ),
            linear-gradient(180deg, rgba(255,255,255,0.05), transparent 42%)
          `,
          opacity: 0.75,
        }}
      />

      {/* Ceiling string lights */}
      <svg
        aria-hidden
        className="absolute inset-x-[6%] top-[2%] h-8 w-[88%]"
        viewBox="0 0 200 24"
        preserveAspectRatio="none"
      >
        <path
          d="M0 8 Q50 18 100 6 T200 10"
          fill="none"
          stroke="rgba(212,175,110,0.35)"
          strokeWidth="0.8"
        />
        {[12, 36, 60, 84, 108, 132, 156, 180].map((x, i) => (
          <circle
            key={x}
            cx={x}
            cy={i % 2 === 0 ? 10 : 14}
            r="1.6"
            fill={i % 3 === 0 ? "#f0c090" : "#ffe6a8"}
            opacity={reduceMotion ? 0.7 : undefined}
            style={
              reduceMotion
                ? undefined
                : {
                    animation: `gt-light-breathe ${2.4 + (i % 3) * 0.5}s ease-in-out ${
                      i * 0.18
                    }s infinite`,
                  }
            }
          />
        ))}
      </svg>

      {/* Panoramic window */}
      <div
        aria-hidden
        className="absolute left-[7%] top-[8%] right-[7%] h-[32%] overflow-hidden rounded-[16px]"
        style={{
          boxShadow:
            "inset 0 0 0 2px rgba(212,175,110,0.2), 0 14px 44px rgba(0,0,0,0.4)",
          background: theme.windowSky,
        }}
      >
        {/* Distant mountains */}
        <div
          className="absolute inset-x-0 bottom-0 h-[55%]"
          style={{
            background: `
              linear-gradient(180deg, transparent 0%, rgba(180,200,220,0.12) 100%),
              radial-gradient(ellipse at 30% 100%, rgba(220,230,240,0.35) 0%, transparent 50%),
              radial-gradient(ellipse at 70% 100%, rgba(200,215,230,0.28) 0%, transparent 48%)
            `,
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 78% 18%, rgba(255,255,255,0.6) 0 2.5px, transparent 3.5px), radial-gradient(circle at 28% 36%, rgba(255,255,255,0.35) 0 1px, transparent 2px), radial-gradient(ellipse at 50% 100%, rgba(200,220,240,0.2), transparent 55%)",
          }}
        />
        {!reduceMotion
          ? snowflakes.map((s, i) => (
              <span
                key={i}
                className="absolute rounded-full bg-white/70"
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
        {/* Velvet curtains */}
        <div
          className="absolute inset-y-0 left-0 w-[16%]"
          style={{
            background:
              "linear-gradient(90deg, rgba(72,38,32,0.95), rgba(110,62,48,0.55), transparent)",
          }}
        />
        <div
          className="absolute inset-y-0 right-0 w-[16%]"
          style={{
            background:
              "linear-gradient(270deg, rgba(72,38,32,0.95), rgba(110,62,48,0.55), transparent)",
          }}
        />
        <div
          className="absolute inset-x-[14%] top-0 h-[12%]"
          style={{
            background: "linear-gradient(180deg, rgba(212,175,110,0.4), transparent)",
          }}
        />
        {/* Window mullion */}
        <div
          className="absolute left-1/2 top-[8%] bottom-[8%] w-px -translate-x-1/2"
          style={{ background: "rgba(212,175,110,0.22)" }}
        />
      </div>

      {/* Side lounge silhouettes */}
      <div
        aria-hidden
        className="absolute bottom-[18%] left-[1.5%] h-[22%] w-[14%] rounded-t-[40%]"
        style={{
          background:
            "linear-gradient(180deg, rgba(55,35,28,0.55), rgba(30,18,14,0.7))",
          boxShadow: "inset 0 8px 16px rgba(255,200,140,0.06)",
        }}
      />
      <div
        aria-hidden
        className="absolute bottom-[18%] right-[1.5%] h-[22%] w-[14%] rounded-t-[40%]"
        style={{
          background:
            "linear-gradient(180deg, rgba(55,35,28,0.55), rgba(30,18,14,0.7))",
          boxShadow: "inset 0 8px 16px rgba(255,200,140,0.06)",
        }}
      />

      {/* Warm floor lamps */}
      <div
        aria-hidden
        className="absolute left-[3%] top-[40%] h-20 w-12 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(255,190,110,0.5) 0%, transparent 70%)",
          filter: "blur(3px)",
        }}
      />
      <div
        aria-hidden
        className="absolute right-[3%] top-[40%] h-20 w-12 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(255,190,110,0.5) 0%, transparent 70%)",
          filter: "blur(3px)",
        }}
      />

      {/* Soft rug under tree */}
      <div
        aria-hidden
        className="absolute bottom-[3%] left-1/2 h-[14%] w-[82%] -translate-x-1/2 rounded-[100%]"
        style={{
          background:
            "radial-gradient(ellipse at 50% 50%, rgba(140,60,50,0.35) 0%, rgba(80,40,32,0.18) 45%, transparent 72%)",
          boxShadow: "0 0 48px rgba(0,0,0,0.4)",
        }}
      />

      {/* Tree SVG */}
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
            : { animation: "gt-scene-breathe 8s ease-in-out infinite" }
        }
      >
        <defs>
          <linearGradient id="gt-needle-a" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4a9a62" />
            <stop offset="28%" stopColor="#2a7040" />
            <stop offset="70%" stopColor="#174a28" />
            <stop offset="100%" stopColor="#0a2816" />
          </linearGradient>
          <linearGradient id="gt-needle-b" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#3a8850" />
            <stop offset="55%" stopColor="#1c5530" />
            <stop offset="100%" stopColor="#0f3220" />
          </linearGradient>
          <linearGradient id="gt-needle-deep" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2d6e42" />
            <stop offset="100%" stopColor="#081c12" />
          </linearGradient>
          <radialGradient id="gt-tree-bloom" cx="50%" cy="32%" r="58%">
            <stop offset="0%" stopColor="rgba(255,220,140,0.36)" />
            <stop offset="45%" stopColor="rgba(255,200,100,0.08)" />
            <stop offset="100%" stopColor="rgba(255,200,100,0)" />
          </radialGradient>
          <filter id="gt-soft-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.7" />
          </filter>
          <filter id="gt-branch-soft" x="-8%" y="-8%" width="116%" height="116%">
            <feGaussianBlur stdDeviation="0.28" />
          </filter>
        </defs>

        <ellipse cx="100" cy="300" rx="68" ry="10" fill="rgba(0,0,0,0.4)" />
        <circle cx="100" cy="148" r="92" fill="url(#gt-tree-bloom)" />

        {/* Trunk + planter */}
        <ellipse cx="100" cy="292" rx="22" ry="5" fill="#3a2818" opacity="0.85" />
        <rect x="91" y="266" width="18" height="28" rx="2" fill="#5c3c24" />
        <rect x="94" y="268" width="3" height="24" fill="rgba(255,255,255,0.1)" />
        <path
          d="M78 292 Q100 278 122 292 Q100 298 78 292Z"
          fill="#4a3220"
          opacity="0.9"
        />

        {/* Layered foliage — organic scalloped tiers */}
        <g filter="url(#gt-branch-soft)">
          <path
            d="M100 38
               C116 52 128 66 138 86
               C126 82 114 80 100 80
               C86 80 74 82 62 86
               C72 66 84 52 100 38Z"
            fill="url(#gt-needle-a)"
          />
          <path
            d="M100 62
               C122 82 140 102 154 126
               C138 118 118 114 100 114
               C82 114 62 118 46 126
               C60 102 78 82 100 62Z"
            fill="url(#gt-needle-b)"
          />
          <path
            d="M100 94
               C128 118 150 142 166 170
               C146 160 122 154 100 154
               C78 154 54 160 34 170
               C50 142 72 118 100 94Z"
            fill="url(#gt-needle-deep)"
          />
          <path
            d="M100 128
               C134 156 160 184 178 220
               C154 206 126 198 100 198
               C74 198 46 206 22 220
               C40 184 66 156 100 128Z"
            fill="url(#gt-needle-a)"
          />
          <path
            d="M100 168
               C138 200 166 232 186 268
               C156 252 126 244 100 244
               C74 244 44 252 14 268
               C34 232 62 200 100 168Z"
            fill="url(#gt-needle-b)"
          />
          {/* Soft under-layer for depth */}
          <path
            d="M100 200
               C142 228 168 252 190 286
               C158 274 128 268 100 268
               C72 268 42 274 10 286
               C32 258 58 228 100 200Z"
            fill="url(#gt-needle-deep)"
            opacity="0.85"
          />
        </g>

        {/* Natural needle tips */}
        <g strokeLinecap="round">
          {needles.map((n, i) => (
            <line
              key={`n-${i}`}
              x1={n.x1}
              y1={n.y1}
              x2={n.x2}
              y2={n.y2}
              stroke={i % 3 === 0 ? "rgba(160,210,150,0.35)" : "rgba(40,90,55,0.55)"}
              strokeWidth={0.7}
              opacity={n.o}
            />
          ))}
        </g>

        {/* Soft branch edge highlights */}
        <path
          d="M66 118 Q100 104 134 118"
          fill="none"
          stroke="rgba(190,230,180,0.2)"
          strokeWidth="1.1"
        />
        <path
          d="M50 164 Q100 146 150 164"
          fill="none"
          stroke="rgba(180,220,170,0.16)"
          strokeWidth="1.2"
        />
        <path
          d="M38 216 Q100 194 162 216"
          fill="none"
          stroke="rgba(180,220,170,0.13)"
          strokeWidth="1.3"
        />

        {ornaments.map((o, i) => (
          <g key={`o-${i}`}>
            <circle cx={o.x} cy={o.y} r={o.r + 0.6} fill="rgba(0,0,0,0.25)" />
            <circle cx={o.x} cy={o.y} r={o.r} fill={o.c} opacity={0.94} />
            <circle
              cx={o.x - o.r * 0.28}
              cy={o.y - o.r * 0.32}
              r={o.r * 0.28}
              fill="rgba(255,255,255,0.48)"
            />
          </g>
        ))}

        {lights.map(([x, y, warm], i) => (
          <circle
            key={`l-${i}`}
            cx={x}
            cy={y}
            r={warm ? 2.5 : 2.15}
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
            opacity={reduceMotion ? 0.85 : undefined}
            style={
              reduceMotion
                ? undefined
                : {
                    animation: `gt-light-breathe ${2.1 + (i % 5) * 0.45}s ease-in-out ${
                      (i % 6) * 0.22
                    }s infinite`,
                  }
            }
          />
        ))}

        {/* Elegant star topper */}
        <g transform="translate(100 34)">
          <polygon
            points="0,-15 3.6,-3.6 15,-3.6 5.6,2.6 9.2,14.5 0,7.2 -9.2,14.5 -5.6,2.6 -15,-3.6 -3.6,-3.6"
            fill="#e8c97a"
          />
          <polygon
            points="0,-10 2.2,-2.4 9.5,-2.4 3.6,1.6 5.8,9 0,4.6 -5.8,9 -3.6,1.6 -9.5,-2.4 -2.2,-2.4"
            fill="#fff4d0"
            opacity="0.55"
          />
          {!reduceMotion ? (
            <circle r="22" fill="rgba(232,201,122,0.18)">
              <animate
                attributeName="opacity"
                values="0.1;0.3;0.1"
                dur="3.4s"
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
          0% { transform: translateY(0); opacity: 0.5; }
          100% { transform: translateY(52px); opacity: 0; }
        }
        @keyframes gt-scene-breathe {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
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
