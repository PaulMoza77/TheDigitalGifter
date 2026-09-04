import type { KeyboardEvent } from "react";

export type PresentVisual = {
  id: string;
  style: string;
  width: number;
  height: number;
  leftPct: number;
  bottomPct: number;
  depth: number;
  ribbon: string;
};

const WRAP: Record<string, { body: string; lid: string; ribbon: string }> = {
  red: { body: "#b91c1c", lid: "#991b1b", ribbon: "#f5d76e" },
  gold: { body: "#b45309", lid: "#92400e", ribbon: "#fde68a" },
  green: { body: "#166534", lid: "#14532d", ribbon: "#fecaca" },
  blue: { body: "#1e3a5f", lid: "#172554", ribbon: "#f5d76e" },
  snow: { body: "#e8eef5", lid: "#d1dbe8", ribbon: "#b91c1c" },
  wine: { body: "#7f1d1d", lid: "#450a0a", ribbon: "#fbbf24" },
  forest: { body: "#14532d", lid: "#052e16", ribbon: "#fdba74" },
  ivory: { body: "#f5f0e6", lid: "#e7ddd0", ribbon: "#0f766e" },
};

type Props = {
  present: PresentVisual;
  state: "available" | "opening" | "opened" | "locked";
  scale?: number;
  onSelect: (id: string) => void;
  reduceMotion?: boolean;
};

export function ChristmasPresent({
  present,
  state,
  scale = 1,
  onSelect,
  reduceMotion,
}: Props) {
  const colors = WRAP[present.style] || WRAP.red!;
  const interactive = state === "available";
  const opening = state === "opening";
  const locked = state === "locked" || state === "opened";

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (!interactive) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(present.id);
    }
  }

  const w = present.width * scale;
  const h = present.height * scale;

  return (
    <button
      type="button"
      aria-label={
        interactive
          ? `Open Christmas present ${present.id.replace("_", " ")}`
          : state === "opened"
            ? "Already opened present"
            : "Present locked — one free gift per visitor"
      }
      disabled={!interactive}
      onClick={() => interactive && onSelect(present.id)}
      onKeyDown={onKeyDown}
      className="absolute touch-manipulation outline-none focus-visible:ring-2 focus-visible:ring-amber-200/80"
      style={{
        left: `${present.leftPct}%`,
        bottom: `${present.bottomPct}%`,
        width: w,
        height: h,
        zIndex: 10 + present.depth,
        cursor: interactive ? "pointer" : "default",
        transform: opening
          ? "translateY(-10px) scale(1.08)"
          : locked
            ? "scale(0.96)"
            : undefined,
        opacity: locked && state !== "opened" ? 0.55 : 1,
        filter: opening
          ? "drop-shadow(0 0 18px rgba(245,215,110,0.75))"
          : interactive
            ? "drop-shadow(0 8px 14px rgba(0,0,0,0.35))"
            : "drop-shadow(0 4px 8px rgba(0,0,0,0.25))",
        transition: reduceMotion
          ? "opacity 150ms ease"
          : "transform 420ms cubic-bezier(0.22,1,0.36,1), filter 420ms ease, opacity 300ms ease",
      }}
    >
      <span
        className="relative block h-full w-full"
        style={{
          borderRadius: 6,
          background: `linear-gradient(160deg, ${colors.lid} 0%, ${colors.body} 55%, ${colors.body} 100%)`,
          boxShadow: interactive
            ? `inset 0 1px 0 rgba(255,255,255,0.25), 0 0 0 1px rgba(255,255,255,0.08)`
            : `inset 0 1px 0 rgba(255,255,255,0.12)`,
        }}
      >
        {/* Lid */}
        <span
          aria-hidden
          className="absolute left-0 right-0 top-0"
          style={{
            height: "28%",
            borderRadius: "6px 6px 2px 2px",
            background: `linear-gradient(180deg, ${colors.lid}, ${colors.body})`,
            transform: opening && !reduceMotion ? "translateY(-8px) rotate(-4deg)" : undefined,
            transition: reduceMotion ? undefined : "transform 500ms ease",
          }}
        />
        {/* Vertical ribbon */}
        <span
          aria-hidden
          className="absolute top-0 bottom-0"
          style={{
            left: "42%",
            width: "16%",
            background: colors.ribbon,
            opacity: 0.92,
            boxShadow: interactive ? `0 0 10px ${colors.ribbon}55` : undefined,
          }}
        />
        {/* Horizontal ribbon */}
        <span
          aria-hidden
          className="absolute left-0 right-0"
          style={{
            top: "38%",
            height: "14%",
            background: colors.ribbon,
            opacity: 0.92,
          }}
        />
        {present.ribbon === "bow" ? (
          <span
            aria-hidden
            className="absolute"
            style={{
              left: "50%",
              top: "28%",
              width: "34%",
              height: "22%",
              transform: "translate(-50%, -50%)",
              background: colors.ribbon,
              borderRadius: "50%",
              boxShadow: `-10px 0 0 ${colors.ribbon}, 10px 0 0 ${colors.ribbon}`,
              opacity: 0.95,
            }}
          />
        ) : null}
        {interactive && !reduceMotion ? (
          <span
            aria-hidden
            className="absolute inset-0 rounded-md"
            style={{
              animation: "gt-present-shimmer 2.8s ease-in-out infinite",
              background:
                "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.18) 48%, transparent 62%)",
              backgroundSize: "200% 100%",
            }}
          />
        ) : null}
      </span>
      <style>{`
        @keyframes gt-present-shimmer {
          0% { background-position: 120% 0; opacity: 0.35; }
          50% { opacity: 0.7; }
          100% { background-position: -40% 0; opacity: 0.35; }
        }
        button:hover:not(:disabled) {
          transform: translateY(-6px) scale(1.04) !important;
        }
        @media (prefers-reduced-motion: reduce) {
          button:hover:not(:disabled) { transform: none !important; }
        }
      `}</style>
    </button>
  );
}
