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

/** Strategically placed warm lights across the photoreal tree canopy. */
const TREE_LIGHTS: Light[] = [
  { left: "48%", top: "14%", size: 5, delay: "0.2s", duration: "3.4s", opacity: 0.85, blur: true },
  { left: "52%", top: "18%", size: 4, delay: "1.1s", duration: "4.2s", opacity: 0.7 },
  { left: "44%", top: "20%", size: 6, delay: "0.6s", duration: "2.8s", opacity: 0.9, blur: true },
  { left: "56%", top: "22%", size: 3, delay: "2.0s", duration: "5.1s", opacity: 0.65 },
  { left: "40%", top: "26%", size: 7, delay: "0.4s", duration: "3.8s", opacity: 0.8, blur: true },
  { left: "50%", top: "28%", size: 4, delay: "1.7s", duration: "2.5s", opacity: 0.75 },
  { left: "60%", top: "30%", size: 5, delay: "0.9s", duration: "4.6s", opacity: 0.85 },
  { left: "37%", top: "34%", size: 4, delay: "2.4s", duration: "3.1s", opacity: 0.7 },
  { left: "46%", top: "35%", size: 8, delay: "0.15s", duration: "3.6s", opacity: 0.95, blur: true },
  { left: "54%", top: "36%", size: 3, delay: "1.4s", duration: "5.4s", opacity: 0.6 },
  { left: "62%", top: "38%", size: 6, delay: "0.75s", duration: "2.9s", opacity: 0.8 },
  { left: "42%", top: "42%", size: 5, delay: "2.1s", duration: "4.0s", opacity: 0.75, blur: true },
  { left: "50%", top: "44%", size: 4, delay: "0.35s", duration: "3.3s", opacity: 0.85 },
  { left: "58%", top: "45%", size: 7, delay: "1.8s", duration: "4.8s", opacity: 0.9, blur: true },
  { left: "35%", top: "48%", size: 4, delay: "1.0s", duration: "2.6s", opacity: 0.65 },
  { left: "47%", top: "50%", size: 6, delay: "2.6s", duration: "3.9s", opacity: 0.8 },
  { left: "55%", top: "52%", size: 3, delay: "0.55s", duration: "5.2s", opacity: 0.7 },
  { left: "63%", top: "50%", size: 5, delay: "1.55s", duration: "3.2s", opacity: 0.75 },
  { left: "39%", top: "56%", size: 5, delay: "0.85s", duration: "4.4s", opacity: 0.8, blur: true },
  { left: "49%", top: "58%", size: 8, delay: "2.2s", duration: "2.7s", opacity: 0.9, blur: true },
  { left: "57%", top: "57%", size: 4, delay: "1.25s", duration: "3.7s", opacity: 0.7 },
  { left: "44%", top: "62%", size: 6, delay: "0.05s", duration: "4.1s", opacity: 0.85 },
  { left: "52%", top: "64%", size: 5, delay: "1.9s", duration: "3.0s", opacity: 0.75 },
  { left: "41%", top: "68%", size: 4, delay: "0.7s", duration: "5.0s", opacity: 0.65 },
  { left: "48%", top: "70%", size: 7, delay: "2.35s", duration: "3.5s", opacity: 0.85, blur: true },
  { left: "56%", top: "69%", size: 3, delay: "1.35s", duration: "2.4s", opacity: 0.6 },
];

const STAR_GLINTS: Glint[] = [
  { left: "50%", top: "12%", delay: "0.8s", duration: "5.2s" },
  { left: "43%", top: "30%", delay: "2.4s", duration: "6.1s" },
  { left: "58%", top: "33%", delay: "1.1s", duration: "4.4s" },
  { left: "46%", top: "48%", delay: "3.6s", duration: "5.8s" },
  { left: "54%", top: "55%", delay: "0.3s", duration: "3.8s" },
  { left: "40%", top: "60%", delay: "4.2s", duration: "6.8s" },
  { left: "60%", top: "62%", delay: "1.9s", duration: "4.9s" },
];

type Props = {
  reduceMotion?: boolean;
};

/**
 * Lightweight DOM/CSS lighting layer ABOVE the static photoreal tree.
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
            width: light.size,
            height: light.size,
            marginLeft: -light.size / 2,
            marginTop: -light.size / 2,
            opacity: light.opacity,
            background: `radial-gradient(circle,
              rgba(255,245,190,1) 0%,
              rgba(255,205,90,0.9) 25%,
              rgba(255,170,40,0.35) 55%,
              transparent 75%)`,
            filter: light.blur ? "blur(0.6px)" : undefined,
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
            width: 10,
            height: 10,
            marginLeft: -5,
            marginTop: -5,
            animation: `gt-star-glint ${g.duration} ease-in-out ${g.delay} infinite`,
            willChange: "opacity, transform",
          }}
        />
      ))}

      <style>{`
        .gt-tree-light {
          transform: scale(0.9);
        }
        @keyframes gt-tree-twinkle {
          0%, 100% { opacity: 0.45; transform: scale(0.8); }
          45% { opacity: 1; transform: scale(1.2); }
          70% { opacity: 0.65; transform: scale(0.95); }
        }
        .gt-star-glint {
          opacity: 0;
          background:
            linear-gradient(90deg, transparent 42%, rgba(255,245,210,0.95) 50%, transparent 58%),
            linear-gradient(0deg, transparent 42%, rgba(255,245,210,0.95) 50%, transparent 58%);
          clip-path: polygon(50% 0%, 58% 42%, 100% 50%, 58% 58%, 50% 100%, 42% 58%, 0% 50%, 42% 42%);
        }
        @keyframes gt-star-glint {
          0%, 100% { opacity: 0; transform: scale(0); }
          40% { opacity: 0.85; transform: scale(1); }
          55% { opacity: 0.4; transform: scale(0.7); }
          70% { opacity: 0; transform: scale(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .gt-tree-light,
          .gt-star-glint { animation: none !important; opacity: 0.55 !important; }
          .gt-star-glint { opacity: 0 !important; }
        }
      `}</style>
    </div>
  );
}
