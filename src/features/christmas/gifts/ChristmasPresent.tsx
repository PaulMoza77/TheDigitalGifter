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
  { body: string; lid: string; ribbon: string; face: string }
> = {
  red: {
    body: "#6b1a22",
    lid: "#8b2430",
    ribbon: "#d4af6a",
    face: "#4a1016",
  },
  gold: {
    body: "#8a6a2e",
    lid: "#b08a3c",
    ribbon: "#f2e2b0",
    face: "#5c4518",
  },
  green: {
    body: "#1e3d2e",
    lid: "#2a5640",
    ribbon: "#d4af6a",
    face: "#12261c",
  },
  blue: {
    body: "#1a2a3c",
    lid: "#24384e",
    ribbon: "#c9a86a",
    face: "#0e1824",
  },
  snow: {
    body: "#e8e2d8",
    lid: "#f4efe8",
    ribbon: "#8b2430",
    face: "#d8d0c4",
  },
  wine: {
    body: "#4a1520",
    lid: "#6a1e2c",
    ribbon: "#e0c078",
    face: "#2e0c14",
  },
  forest: {
    body: "#163028",
    lid: "#1f4034",
    ribbon: "#c9a86a",
    face: "#0c1c18",
  },
  ivory: {
    body: "#f0ebe3",
    lid: "#faf7f2",
    ribbon: "#2a4a44",
    face: "#ddd5ca",
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
};

export function ChristmasPresent({
  present,
  state,
  scale = 1,
  onSelect,
  reduceMotion,
  boxTheme = "mystery_velvet",
  selected = false,
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
      className="absolute touch-manipulation outline-none focus-visible:ring-2 focus-visible:ring-amber-200/80"
      style={{
        left: `${present.leftPct}%`,
        bottom: `${present.bottomPct}%`,
        width: w,
        height: h,
        zIndex: 20 + present.depth,
        cursor: interactive ? "pointer" : "default",
        transform: opening
          ? "translateY(-12px) scale(1.1)"
          : selected
            ? "translateY(-8px) scale(1.06)"
            : locked
              ? "scale(0.95)"
              : undefined,
        opacity: locked && state !== "opened" ? 0.5 : 1,
        filter: opening || selected
          ? "drop-shadow(0 0 20px rgba(212,175,110,0.7))"
          : interactive
            ? "drop-shadow(0 10px 18px rgba(0,0,0,0.4))"
            : "drop-shadow(0 4px 10px rgba(0,0,0,0.28))",
        transition: reduceMotion
          ? "opacity 150ms ease"
          : "transform 420ms cubic-bezier(0.22,1,0.36,1), filter 420ms ease, opacity 300ms ease",
      }}
    >
      <span
        className="relative block h-full w-full"
        style={{
          borderRadius: 10,
          background: `linear-gradient(152deg, ${colors.lid} 0%, ${colors.body} 42%, ${colors.face} 100%)`,
          boxShadow: `inset 0 1px 0 ${theme.lidSheen}, inset 0 -10px 18px rgba(0,0,0,0.28), 0 0 0 1px rgba(255,255,255,0.1)`,
        }}
      >
        {/* Soft side bevel */}
        <span
          aria-hidden
          className="absolute inset-y-[8%] left-0 w-[10%] rounded-l-[10px]"
          style={{
            background: "linear-gradient(90deg, rgba(255,255,255,0.12), transparent)",
          }}
        />

        {/* 3D lid */}
        <span
          aria-hidden
          className="absolute left-0 right-0 top-0"
          style={{
            height: "28%",
            borderRadius: "10px 10px 2px 2px",
            background: `linear-gradient(180deg, ${colors.lid}, ${colors.body})`,
            boxShadow: `inset 0 1px 0 ${theme.lidSheen}, 0 2px 4px rgba(0,0,0,0.2)`,
            transform:
              opening && !reduceMotion ? "translateY(-11px) rotate(-6deg)" : undefined,
            transition: reduceMotion ? undefined : "transform 520ms ease",
          }}
        />

        {/* Ribbons */}
        <span
          aria-hidden
          className="absolute top-0 bottom-0"
          style={{
            left: "41%",
            width: "18%",
            background: `linear-gradient(90deg, transparent 0%, ${colors.ribbon} 28%, ${colors.ribbon} 72%, transparent 100%)`,
            opacity: 0.96,
            boxShadow: "inset 0 0 6px rgba(255,255,255,0.15)",
          }}
        />
        <span
          aria-hidden
          className="absolute left-0 right-0"
          style={{
            top: "38%",
            height: "14%",
            background: `linear-gradient(180deg, transparent 0%, ${colors.ribbon} 30%, ${colors.ribbon} 70%, transparent 100%)`,
            opacity: 0.96,
          }}
        />

        {/* Bow */}
        {(present.ribbon === "bow" || theme.mysteryMark) && (
          <span
            aria-hidden
            className="absolute"
            style={{
              left: "50%",
              top: "26%",
              width: "34%",
              height: "18%",
              transform: "translate(-50%, -50%)",
              background: colors.ribbon,
              borderRadius: "50%",
              boxShadow: `-10px 0 0 ${colors.ribbon}, 10px 0 0 ${colors.ribbon}, 0 2px 4px rgba(0,0,0,0.25)`,
              opacity: 0.96,
            }}
          />
        )}

        {/* Mystery mark */}
        {theme.mysteryMark ? (
          <span
            aria-hidden
            className="absolute inset-x-0 flex items-center justify-center font-serif font-semibold"
            style={{
              top: "52%",
              height: "36%",
              color: colors.ribbon,
              fontSize: Math.max(15, h * 0.3),
              textShadow: "0 1px 3px rgba(0,0,0,0.5)",
              opacity: 0.92,
              letterSpacing: "0.02em",
            }}
          >
            ?
          </span>
        ) : null}

        {interactive && !reduceMotion ? (
          <span
            aria-hidden
            className="absolute inset-0 rounded-[10px]"
            style={{
              animation: "gt-present-shimmer 3.2s ease-in-out infinite",
              background:
                "linear-gradient(110deg, transparent 28%, rgba(255,255,255,0.22) 48%, transparent 64%)",
              backgroundSize: "220% 100%",
            }}
          />
        ) : null}
      </span>
      <style>{`
        @keyframes gt-present-shimmer {
          0% { background-position: 130% 0; opacity: 0.3; }
          50% { opacity: 0.65; }
          100% { background-position: -50% 0; opacity: 0.3; }
        }
      `}</style>
    </button>
  );
}
