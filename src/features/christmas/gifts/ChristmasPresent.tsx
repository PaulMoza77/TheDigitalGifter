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
  style?: string;
  ribbon?: string;
};

type Props = {
  present: PresentVisual;
  state: "available" | "opening" | "opened" | "locked";
  onSelect: (id: string) => void;
  reduceMotion?: boolean;
  selected?: boolean;
  attention?: boolean;
};

/**
 * Invisible hotspot over a gift in the photo/video.
 * Locked gifts stay clickable so desktop can open “Get more chances”.
 */
export function ChristmasPresent({
  present,
  state,
  onSelect,
  reduceMotion,
  selected = false,
  attention = false,
}: Props) {
  const available = state === "available";
  const opening = state === "opening";
  const opened = state === "opened";
  // Keep locked gifts clickable (opens more-chances). Only block while opening.
  const canPress = state !== "opening";
  const showGlowIdle = available || state === "locked";

  function activate() {
    if (!canPress) return;
    onSelect(present.id);
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (!canPress) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      activate();
    }
  }

  return (
    <button
      type="button"
      aria-label={
        available
          ? `Open Christmas gift ${present.id.replace("_", " ")}`
          : opened
            ? "Already opened gift"
            : "Gift locked — get more chances to open another"
      }
      aria-pressed={selected}
      aria-disabled={!canPress || opened}
      // IMPORTANT: do not use disabled for locked — desktop clicks were swallowed.
      disabled={opening}
      onClick={activate}
      onKeyDown={onKeyDown}
      className={`gt-hotspot absolute touch-manipulation outline-none ${
        showGlowIdle && !reduceMotion ? "gt-hotspot-interactive" : ""
      } ${attention && available && !reduceMotion ? "gt-hotspot-attention" : ""} ${
        opening ? "gt-hotspot-opening" : ""
      } ${selected && available ? "gt-hotspot-selected" : ""}`}
      style={{
        left: `${present.leftPct}%`,
        top: `${present.topPct}%`,
        width: `${present.widthPct}%`,
        height: `${present.heightPct}%`,
        zIndex: 20 + present.depth,
        cursor: canPress && !opened ? "pointer" : opened ? "default" : "pointer",
        background: "transparent",
        border: "none",
        borderRadius: 12,
        opacity: opened ? 0.45 : 1,
        boxShadow: "none",
        transition: reduceMotion
          ? "opacity 150ms ease"
          : "transform 200ms cubic-bezier(0.22,1,0.36,1), opacity 200ms ease",
      }}
    >
      <span aria-hidden className="gt-hotspot-glow" />
      <style>{`
        .gt-hotspot-glow {
          position: absolute;
          inset: -14%;
          border-radius: 16px;
          pointer-events: none;
          opacity: 0;
          background:
            radial-gradient(ellipse at 50% 55%,
              rgba(255,230,150,0.5) 0%,
              rgba(255,190,90,0.22) 40%,
              transparent 70%);
          box-shadow:
            inset 0 0 0 2px rgba(255,236,190,0.65),
            0 0 22px rgba(255,200,110,0.55),
            0 0 42px rgba(255,170,60,0.32);
          transition: opacity 160ms ease, transform 200ms ease;
          transform: scale(0.94);
        }
        @media (hover: hover) and (pointer: fine) {
          .gt-hotspot-interactive:hover:not(:disabled) .gt-hotspot-glow {
            opacity: 1;
            transform: scale(1);
          }
          .gt-hotspot-interactive:hover:not(:disabled) {
            transform: translateY(-2px) scale(1.04);
          }
        }
        .gt-hotspot-interactive:focus-visible .gt-hotspot-glow,
        .gt-hotspot-selected .gt-hotspot-glow {
          opacity: 1;
          transform: scale(1);
        }
        .gt-hotspot-interactive:active:not(:disabled) {
          transform: scale(0.97);
        }
        .gt-hotspot-opening .gt-hotspot-glow {
          opacity: 1;
          transform: scale(1.1);
          animation: gt-hotspot-bloom 700ms ease-out forwards;
        }
        .gt-hotspot-attention .gt-hotspot-glow {
          animation: gt-hotspot-nudge 1.15s ease-in-out 1;
        }
        @keyframes gt-hotspot-bloom {
          0% { opacity: 0.55; filter: brightness(1); }
          45% { opacity: 1; filter: brightness(1.3); }
          100% { opacity: 0.9; filter: brightness(1.1); }
        }
        @keyframes gt-hotspot-nudge {
          0%, 100% { opacity: 0; transform: scale(0.94); }
          45%, 55% { opacity: 0.9; transform: scale(1.02); }
        }
        @media (prefers-reduced-motion: reduce) {
          .gt-hotspot-attention .gt-hotspot-glow,
          .gt-hotspot-opening .gt-hotspot-glow { animation: none !important; opacity: 0.75; }
        }
      `}</style>
    </button>
  );
}
