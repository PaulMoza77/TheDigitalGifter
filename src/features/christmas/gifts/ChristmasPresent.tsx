import type { KeyboardEvent } from "react";

export type PresentVisual = {
  id: string;
  /** Left edge as % of the source scene media */
  leftPct: number;
  /** Top edge as % of the source scene media */
  topPct: number;
  /** Width as % of the source scene media */
  widthPct: number;
  /** Height as % of the source scene media */
  heightPct: number;
  depth: number;
  /** Kept for layout identity / tests — not rendered */
  style?: string;
  ribbon?: string;
};

type Props = {
  present: PresentVisual;
  state: "available" | "opening" | "opened" | "locked";
  onSelect: (id: string) => void;
  reduceMotion?: boolean;
  selected?: boolean;
  /** Subtle one-at-a-time idle nudge attention (ring only). */
  attention?: boolean;
};

/**
 * Invisible hotspot aligned to a gift already in the scene photo/video.
 * No fake gift visuals — click target only.
 */
export function ChristmasPresent({
  present,
  state,
  onSelect,
  reduceMotion,
  selected = false,
  attention = false,
}: Props) {
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
      className={`gt-hotspot absolute touch-manipulation outline-none focus-visible:ring-2 focus-visible:ring-amber-100/70 ${
        interactive && !reduceMotion ? "gt-hotspot-interactive" : ""
      } ${attention && interactive && !reduceMotion ? "gt-hotspot-attention" : ""}`}
      style={{
        left: `${present.leftPct}%`,
        top: `${present.topPct}%`,
        width: `${present.widthPct}%`,
        height: `${present.heightPct}%`,
        zIndex: 20 + present.depth,
        cursor: interactive ? "pointer" : "default",
        background: "transparent",
        border: "none",
        borderRadius: 6,
        boxShadow:
          opening || selected
            ? "inset 0 0 0 2px rgba(255,230,170,0.55), 0 0 18px rgba(255,200,110,0.28)"
            : "none",
        opacity: locked && state !== "opened" ? 0.35 : 1,
        transform: opening ? "scale(1.04)" : selected ? "scale(1.02)" : undefined,
        transition: reduceMotion
          ? "opacity 150ms ease"
          : "transform 200ms cubic-bezier(0.22,1,0.36,1), box-shadow 200ms ease, opacity 200ms ease",
      }}
    >
      <style>{`
        @media (hover: hover) and (pointer: fine) {
          .gt-hotspot-interactive:hover:not(:disabled) {
            box-shadow: inset 0 0 0 1.5px rgba(255,230,170,0.4), 0 0 14px rgba(255,200,110,0.2) !important;
          }
        }
        .gt-hotspot-interactive:active:not(:disabled) {
          transform: scale(0.98) !important;
        }
        .gt-hotspot-attention {
          animation: gt-hotspot-pulse 1.1s ease-in-out 1;
        }
        @keyframes gt-hotspot-pulse {
          0%, 100% { box-shadow: none; }
          50% { box-shadow: inset 0 0 0 1.5px rgba(255,230,170,0.35), 0 0 12px rgba(255,200,110,0.18); }
        }
        @media (prefers-reduced-motion: reduce) {
          .gt-hotspot-attention { animation: none !important; }
        }
      `}</style>
    </button>
  );
}
