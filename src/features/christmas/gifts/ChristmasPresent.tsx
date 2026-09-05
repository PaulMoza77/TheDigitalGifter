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
  /** Kept for layout identity / tests — not rendered as a fake gift */
  style?: string;
  ribbon?: string;
};

type Props = {
  present: PresentVisual;
  state: "available" | "opening" | "opened" | "locked";
  onSelect: (id: string) => void;
  reduceMotion?: boolean;
  selected?: boolean;
  /** Subtle one-at-a-time idle nudge attention (glow only). */
  attention?: boolean;
};

/**
 * Invisible hotspot over a gift already in the scene photo/video.
 * Hover / focus → warm glow. Click / tap → open.
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
          ? `Open Christmas gift ${present.id.replace("_", " ")}`
          : state === "opened"
            ? "Already opened gift"
            : "Gift locked — one free gift per visitor"
      }
      aria-pressed={selected}
      disabled={!interactive}
      onClick={() => interactive && onSelect(present.id)}
      onKeyDown={onKeyDown}
      className={`gt-hotspot absolute touch-manipulation outline-none ${
        interactive && !reduceMotion ? "gt-hotspot-interactive" : ""
      } ${attention && interactive && !reduceMotion ? "gt-hotspot-attention" : ""} ${
        opening ? "gt-hotspot-opening" : ""
      } ${selected && interactive ? "gt-hotspot-selected" : ""}`}
      style={{
        left: `${present.leftPct}%`,
        top: `${present.topPct}%`,
        width: `${present.widthPct}%`,
        height: `${present.heightPct}%`,
        zIndex: 20 + present.depth,
        cursor: interactive ? "pointer" : "default",
        background: "transparent",
        border: "none",
        borderRadius: 10,
        opacity: locked && state !== "opened" ? 0.4 : 1,
        // Invisible hit target — glow only via CSS classes / pseudo glow layer
        boxShadow: "none",
        transition: reduceMotion
          ? "opacity 150ms ease"
          : "transform 220ms cubic-bezier(0.22,1,0.36,1), opacity 200ms ease",
      }}
    >
      {/* Soft gold bloom — stays invisible until hover/focus/open */}
      <span aria-hidden className="gt-hotspot-glow" />
      <style>{`
        .gt-hotspot-glow {
          position: absolute;
          inset: -8%;
          border-radius: 14px;
          pointer-events: none;
          opacity: 0;
          background:
            radial-gradient(ellipse at 50% 55%,
              rgba(255,230,150,0.42) 0%,
              rgba(255,190,90,0.18) 42%,
              transparent 72%);
          box-shadow:
            inset 0 0 0 1.5px rgba(255,236,190,0.55),
            0 0 18px rgba(255,200,110,0.45),
            0 0 36px rgba(255,170,60,0.28);
          transition: opacity 180ms ease, transform 220ms ease;
          transform: scale(0.96);
        }
        @media (hover: hover) and (pointer: fine) {
          .gt-hotspot-interactive:hover:not(:disabled) .gt-hotspot-glow {
            opacity: 1;
            transform: scale(1);
          }
          .gt-hotspot-interactive:hover:not(:disabled) {
            transform: translateY(-2px) scale(1.03);
          }
        }
        .gt-hotspot-interactive:focus-visible .gt-hotspot-glow,
        .gt-hotspot-selected .gt-hotspot-glow {
          opacity: 1;
          transform: scale(1);
        }
        .gt-hotspot-interactive:focus-visible {
          outline: none;
        }
        .gt-hotspot-interactive:active:not(:disabled) {
          transform: scale(0.97);
        }
        .gt-hotspot-opening .gt-hotspot-glow {
          opacity: 1;
          transform: scale(1.08);
          animation: gt-hotspot-bloom 700ms ease-out forwards;
        }
        .gt-hotspot-attention .gt-hotspot-glow {
          animation: gt-hotspot-nudge 1.15s ease-in-out 1;
        }
        @keyframes gt-hotspot-bloom {
          0% { opacity: 0.55; filter: brightness(1); }
          45% { opacity: 1; filter: brightness(1.25); }
          100% { opacity: 0.9; filter: brightness(1.1); }
        }
        @keyframes gt-hotspot-nudge {
          0%, 100% { opacity: 0; transform: scale(0.96); }
          45%, 55% { opacity: 0.85; transform: scale(1.02); }
        }
        @media (prefers-reduced-motion: reduce) {
          .gt-hotspot-attention .gt-hotspot-glow,
          .gt-hotspot-opening .gt-hotspot-glow { animation: none !important; opacity: 0.75; }
        }
      `}</style>
    </button>
  );
}
