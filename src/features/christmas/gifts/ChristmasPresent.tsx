import type { KeyboardEvent } from "react";
import { BOX_THEMES, type GiftBoxTheme } from "./sceneMoods";

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

const WRAP: Record<
  string,
  { body: string; lid: string; ribbon: string; face: string; side: string }
> = {
  red: {
    body: "#6b1a22",
    lid: "#8b2430",
    ribbon: "#d4af6a",
    face: "#4a1016",
    side: "#3a0c12",
  },
  gold: {
    body: "#8a6a2e",
    lid: "#b08a3c",
    ribbon: "#f2e2b0",
    face: "#5c4518",
    side: "#4a3814",
  },
  green: {
    body: "#1e3d2e",
    lid: "#2a5640",
    ribbon: "#d4af6a",
    face: "#12261c",
    side: "#0c1a14",
  },
  blue: {
    body: "#1a2a3c",
    lid: "#24384e",
    ribbon: "#c9a86a",
    face: "#0e1824",
    side: "#0a1218",
  },
  snow: {
    body: "#e8e2d8",
    lid: "#f4efe8",
    ribbon: "#8b2430",
    face: "#d8d0c4",
    side: "#c8c0b4",
  },
  wine: {
    body: "#4a1520",
    lid: "#6a1e2c",
    ribbon: "#e0c078",
    face: "#2e0c14",
    side: "#220910",
  },
  forest: {
    body: "#163028",
    lid: "#1f4034",
    ribbon: "#c9a86a",
    face: "#0c1c18",
    side: "#081410",
  },
  ivory: {
    body: "#f0ebe3",
    lid: "#faf7f2",
    ribbon: "#2a4a44",
    face: "#ddd5ca",
    side: "#cfc6ba",
  },
};

type Props = {
  present: PresentVisual;
  state: "available" | "opening" | "opened" | "locked";
  scale?: number;
  onSelect: (id: string) => void;
  reduceMotion?: boolean;
  boxTheme?: GiftBoxTheme;
  selected?: boolean;
  /** Subtle one-at-a-time idle nudge attention. */
  attention?: boolean;
};

export function ChristmasPresent({
  present,
  state,
  scale = 1,
  onSelect,
  reduceMotion,
  boxTheme = "mystery_velvet",
  selected = false,
  attention = false,
}: Props) {
  const colors = WRAP[present.style] || WRAP.red!;
  const theme = BOX_THEMES[boxTheme];
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

  let transform: string | undefined;
  if (opening) {
    transform = "translateY(-14px) scale(1.12)";
  } else if (selected) {
    transform = "translateY(-7px) scale(1.04)";
  } else if (locked) {
    transform = "scale(0.94)";
  }

  return (
    <button
      type="button"
      aria-label={
        interactive
          ? `Select Christmas gift ${present.id.replace("_", " ")}`
          : state === "opened"
            ? "Already opened gift"
            : "Gift locked — one free gift per visitor"
      }
      aria-pressed={selected}
      disabled={!interactive}
      onClick={() => interactive && onSelect(present.id)}
      onKeyDown={onKeyDown}
      className={`gt-present absolute touch-manipulation outline-none focus-visible:ring-2 focus-visible:ring-amber-200/80 ${
        interactive && !reduceMotion ? "gt-present-interactive" : ""
      } ${attention && interactive && !reduceMotion ? "gt-present-attention" : ""}`}
      style={{
        left: `${present.leftPct}%`,
        bottom: `${present.bottomPct}%`,
        width: w,
        height: h,
        zIndex: 20 + present.depth,
        cursor: interactive ? "pointer" : "default",
        transform,
        opacity: locked && state !== "opened" ? 0.48 : 1,
        filter:
          opening || selected
            ? "drop-shadow(0 0 22px rgba(255,210,120,0.95)) drop-shadow(0 8px 14px rgba(0,0,0,0.35))"
            : interactive
              ? "drop-shadow(0 0 14px rgba(255,200,110,0.72)) drop-shadow(0 8px 12px rgba(0,0,0,0.35))"
              : "drop-shadow(0 5px 12px rgba(0,0,0,0.3))",
        transition: reduceMotion
          ? "opacity 150ms ease"
          : "transform 220ms cubic-bezier(0.22,1,0.36,1), filter 220ms ease, opacity 200ms ease",
      }}
    >
      {/* Right side face for depth */}
      <span
        aria-hidden
        className="absolute"
        style={{
          top: "6%",
          right: "-7%",
          width: "14%",
          height: "88%",
          borderRadius: "0 8px 8px 0",
          background: `linear-gradient(180deg, ${colors.side}, ${colors.face})`,
          transform: "skewY(-8deg)",
          opacity: 0.85,
        }}
      />

      <span
        className="relative block h-full w-full"
        style={{
          borderRadius: 9,
          background: `linear-gradient(155deg, ${colors.lid} 0%, ${colors.body} 46%, ${colors.face} 100%)`,
          boxShadow: `inset 0 1px 0 ${theme.lidSheen}, inset 0 -10px 18px rgba(0,0,0,0.28), 0 0 0 1px rgba(255,255,255,0.1)`,
        }}
      >
        <span
          aria-hidden
          className="absolute inset-y-[8%] left-0 w-[11%] rounded-l-[9px]"
          style={{
            background: "linear-gradient(90deg, rgba(255,255,255,0.14), transparent)",
          }}
        />

        {/* Lid */}
        <span
          aria-hidden
          className="absolute left-[-3%] right-[-3%] top-0"
          style={{
            height: "28%",
            borderRadius: "9px 9px 2px 2px",
            background: `linear-gradient(180deg, ${colors.lid}, ${colors.body})`,
            boxShadow: `inset 0 1px 0 ${theme.lidSheen}, 0 3px 6px rgba(0,0,0,0.28)`,
            transform:
              opening && !reduceMotion ? "translateY(-12px) rotate(-7deg)" : undefined,
            transition: reduceMotion ? undefined : "transform 520ms ease",
          }}
        />

        {/* Ribbons */}
        <span
          aria-hidden
          className="absolute top-0 bottom-0"
          style={{
            left: "40%",
            width: "20%",
            background: `linear-gradient(90deg, transparent 0%, ${colors.ribbon} 26%, ${colors.ribbon} 74%, transparent 100%)`,
            boxShadow: "inset 0 0 8px rgba(255,255,255,0.18)",
          }}
        />
        <span
          aria-hidden
          className="absolute left-0 right-0"
          style={{
            top: "38%",
            height: "15%",
            background: `linear-gradient(180deg, transparent 0%, ${colors.ribbon} 28%, ${colors.ribbon} 72%, transparent 100%)`,
          }}
        />

        {(present.ribbon === "bow" || theme.mysteryMark) && (
          <span
            aria-hidden
            className="absolute"
            style={{
              left: "50%",
              top: "24%",
              width: "34%",
              height: "18%",
              transform: "translate(-50%, -50%)",
              background: colors.ribbon,
              borderRadius: "50%",
              boxShadow: `-10px 0 0 ${colors.ribbon}, 10px 0 0 ${colors.ribbon}, 0 2px 5px rgba(0,0,0,0.3)`,
            }}
          />
        )}

        {theme.mysteryMark ? (
          <span
            aria-hidden
            className="absolute inset-x-0 flex items-center justify-center font-serif font-semibold"
            style={{
              top: "52%",
              height: "36%",
              color: colors.ribbon,
              fontSize: Math.max(15, h * 0.3),
              textShadow: "0 1px 3px rgba(0,0,0,0.55)",
              opacity: 0.92,
            }}
          >
            ?
          </span>
        ) : null}
      </span>

      <style>{`
        @media (hover: hover) and (pointer: fine) {
          .gt-present-interactive:hover:not(:disabled) {
            transform: translateY(-5px) scale(1.025) !important;
            filter: drop-shadow(0 0 20px rgba(255,210,120,0.9)) drop-shadow(0 8px 14px rgba(0,0,0,0.35)) !important;
          }
        }
        .gt-present-interactive:active:not(:disabled) {
          transform: scale(0.97) !important;
        }
        @media (hover: hover) and (pointer: fine) {
          .gt-present-interactive:active:not(:disabled) {
            transform: translateY(-5px) scale(1.02) !important;
          }
        }
        .gt-present-attention {
          animation: gt-present-nudge 1.1s ease-in-out 1;
        }
        @keyframes gt-present-nudge {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-2px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .gt-present-attention { animation: none !important; }
        }
      `}</style>
    </button>
  );
}
