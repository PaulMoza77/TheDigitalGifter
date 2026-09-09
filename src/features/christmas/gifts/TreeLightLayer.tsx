type Light = {
  left: string;
  top: string;
  size: number;
  delay: string;
  duration: string;
  opacity: number;
  blur?: boolean;
};

type Glint = {
  left: string;
  top: string;
  delay: string;
  duration: string;
};

/**
 * Warm lights across the photoreal tree canopy.
 * Sized + blended to read as living sparkle on the static photo.
 */
const TREE_LIGHTS: Light[] = [
  { left: "49%", top: "13%", size: 11, delay: "0.2s", duration: "3.1s", opacity: 0.95, blur: true },
  { left: "53%", top: "17%", size: 8, delay: "1.1s", duration: "4.0s", opacity: 0.8 },
  { left: "45%", top: "19%", size: 13, delay: "0.55s", duration: "2.6s", opacity: 1, blur: true },
  { left: "57%", top: "21%", size: 7, delay: "2.0s", duration: "4.8s", opacity: 0.75 },
  { left: "41%", top: "25%", size: 14, delay: "0.35s", duration: "3.5s", opacity: 0.9, blur: true },
  { left: "50%", top: "27%", size: 9, delay: "1.65s", duration: "2.3s", opacity: 0.85 },
  { left: "59%", top: "29%", size: 11, delay: "0.85s", duration: "4.2s", opacity: 0.95 },
  { left: "38%", top: "33%", size: 8, delay: "2.35s", duration: "2.9s", opacity: 0.8 },
  { left: "46%", top: "34%", size: 15, delay: "0.1s", duration: "3.3s", opacity: 1, blur: true },
  { left: "54%", top: "35%", size: 7, delay: "1.4s", duration: "5.0s", opacity: 0.7 },
  { left: "61%", top: "37%", size: 12, delay: "0.7s", duration: "2.7s", opacity: 0.9 },
  { left: "42%", top: "41%", size: 10, delay: "2.05s", duration: "3.8s", opacity: 0.85, blur: true },
  { left: "50%", top: "43%", size: 9, delay: "0.3s", duration: "3.0s", opacity: 0.95 },
  { left: "58%", top: "44%", size: 14, delay: "1.75s", duration: "4.5s", opacity: 1, blur: true },
  { left: "36%", top: "47%", size: 8, delay: "0.95s", duration: "2.4s", opacity: 0.75 },
  { left: "47%", top: "49%", size: 12, delay: "2.5s", duration: "3.6s", opacity: 0.9 },
  { left: "55%", top: "51%", size: 7, delay: "0.5s", duration: "4.9s", opacity: 0.8 },
  { left: "62%", top: "49%", size: 10, delay: "1.5s", duration: "3.0s", opacity: 0.85 },
  { left: "40%", top: "55%", size: 11, delay: "0.8s", duration: "4.1s", opacity: 0.9, blur: true },
  { left: "49%", top: "57%", size: 15, delay: "2.15s", duration: "2.5s", opacity: 1, blur: true },
  { left: "57%", top: "56%", size: 8, delay: "1.2s", duration: "3.4s", opacity: 0.8 },
  { left: "44%", top: "61%", size: 12, delay: "0.05s", duration: "3.9s", opacity: 0.95 },
  { left: "52%", top: "63%", size: 9, delay: "1.85s", duration: "2.8s", opacity: 0.85 },
  { left: "41%", top: "67%", size: 8, delay: "0.65s", duration: "4.7s", opacity: 0.75 },
  { left: "48%", top: "69%", size: 13, delay: "2.3s", duration: "3.2s", opacity: 0.95, blur: true },
  { left: "56%", top: "68%", size: 7, delay: "1.3s", duration: "2.2s", opacity: 0.7 },
  { left: "43%", top: "72%", size: 10, delay: "0.45s", duration: "3.7s", opacity: 0.85 },
  { left: "51%", top: "73%", size: 11, delay: "1.95s", duration: "4.3s", opacity: 0.9, blur: true },
];

const STAR_GLINTS: Glint[] = [
  { left: "50%", top: "11%", delay: "0.6s", duration: "4.8s" },
  { left: "44%", top: "28%", delay: "2.2s", duration: "5.6s" },
  { left: "57%", top: "31%", delay: "1.0s", duration: "4.1s" },
  { left: "46%", top: "46%", delay: "3.4s", duration: "5.4s" },
  { left: "54%", top: "53%", delay: "0.25s", duration: "3.6s" },
  { left: "40%", top: "58%", delay: "4.0s", duration: "6.2s" },
  { left: "60%", top: "60%", delay: "1.8s", duration: "4.5s" },
  { left: "48%", top: "66%", delay: "2.8s", duration: "5.0s" },
];

type Props = {
  reduceMotion?: boolean;
};

/**
 * DOM/CSS lighting layer ABOVE the static photoreal tree.
 * Does not redraw the tree — only adds living sparkle.
 */
export function TreeLightLayer({ reduceMotion }: Props) {
  if (reduceMotion) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ zIndex: 3 }}
    >
      {TREE_LIGHTS.map((light, i) => (
        <span
          key={`tl-${i}`}
          className="gt-tree-light absolute rounded-full"
          style={{
            left: light.left,
            top: light.top,
            width: light.size + 8,
            height: light.size + 8,
            marginLeft: -(light.size + 8) / 2,
            marginTop: -(light.size + 8) / 2,
            opacity: light.opacity,
            background: `radial-gradient(circle,
              rgba(255,252,220,1) 0%,
              rgba(255,230,130,0.98) 16%,
              rgba(255,190,70,0.65) 38%,
              rgba(255,150,40,0.22) 58%,
              transparent 76%)`,
            filter: light.blur ? "blur(1.2px)" : "blur(0.5px)",
            mixBlendMode: "screen",
            animation: `gt-tree-twinkle ${light.duration} ease-in-out ${light.delay} infinite`,
            willChange: "opacity, transform",
          }}
        />
      ))}

      {STAR_GLINTS.map((g, i) => (
        <span
          key={`gl-${i}`}
          className="gt-star-glint absolute"
          style={{
            left: g.left,
            top: g.top,
            width: 16,
            height: 16,
            marginLeft: -8,
            marginTop: -8,
            mixBlendMode: "screen",
            animation: `gt-star-glint ${g.duration} ease-in-out ${g.delay} infinite`,
            willChange: "opacity, transform",
          }}
        />
      ))}

      <style>{`
        .gt-tree-light {
          transform: scale(0.85);
        }
        @keyframes gt-tree-twinkle {
          0%, 100% { opacity: 0.28; transform: scale(0.65); }
          35% { opacity: 1; transform: scale(1.55); }
          55% { opacity: 0.5; transform: scale(0.85); }
          75% { opacity: 0.85; transform: scale(1.2); }
        }
        .gt-star-glint {
          opacity: 0;
          background:
            linear-gradient(90deg, transparent 40%, rgba(255,248,220,1) 50%, transparent 60%),
            linear-gradient(0deg, transparent 40%, rgba(255,248,220,1) 50%, transparent 60%);
          clip-path: polygon(50% 0%, 58% 42%, 100% 50%, 58% 58%, 50% 100%, 42% 58%, 0% 50%, 42% 42%);
        }
        @keyframes gt-star-glint {
          0%, 100% { opacity: 0; transform: scale(0) rotate(0deg); }
          38% { opacity: 1; transform: scale(1.15) rotate(12deg); }
          52% { opacity: 0.4; transform: scale(0.75) rotate(20deg); }
          68% { opacity: 0; transform: scale(0) rotate(28deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .gt-tree-light,
          .gt-star-glint { animation: none !important; }
          .gt-star-glint { opacity: 0 !important; }
        }
      `}</style>
    </div>
  );
}
