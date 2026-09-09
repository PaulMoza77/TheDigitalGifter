import type { ReactNode } from "react";
import { LETTER_LABEL } from "./letterModel";

type Props = {
  children: ReactNode;
  ariaLabel: string;
  footerNote?: ReactNode;
  saveStatus?: "idle" | "saving" | "saved" | "error";
  className?: string;
};

export function WishlistLetterShell({ children, ariaLabel, footerNote, saveStatus = "idle", className = "" }: Props) {
  return (
    <div className={`wl-desk ${className}`.trim()}>
      <div className="wl-desk__scene" aria-hidden>
        <div className="wl-desk__fire" />
        <div className="wl-desk__tree" />
        <div className="wl-desk__window" />
        <div className="wl-desk__vignette" />
      </div>

      <article className="wl-parchment" role="region" aria-label={ariaLabel}>
        <div className="wl-parchment__edge" aria-hidden />
        <div className="wl-parchment__holly wl-parchment__holly--tl" aria-hidden />
        <div className="wl-parchment__holly wl-parchment__holly--tr" aria-hidden />
        <div className="wl-parchment__ribbon" aria-hidden />
        <div className="wl-parchment__inner">
          <p className="wl-parchment__label">{LETTER_LABEL}</p>
          {children}
          <p className="wl-parchment__flourish" aria-hidden>
            Good Things Ahead ♡
          </p>
        </div>
        <div className="wl-parchment__tree-doodle" aria-hidden />
      </article>

      <div className="wl-desk__props" aria-hidden>
        <span className="wl-desk__pen" />
        <span className="wl-desk__candle" />
      </div>

      {(saveStatus !== "idle" || footerNote) && (
        <div className="wl-desk__status" aria-live="polite">
          {saveStatus === "saving" ? <span className="wl-save-status">Saving…</span> : null}
          {saveStatus === "saved" ? <span className="wl-save-status wl-save-status--ok">Saved</span> : null}
          {saveStatus === "error" ? <span className="wl-save-status wl-save-status--err">Couldn’t save</span> : null}
          {footerNote}
        </div>
      )}
    </div>
  );
}
