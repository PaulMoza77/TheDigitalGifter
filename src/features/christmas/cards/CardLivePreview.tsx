import { useEffect, useRef, useState } from "react";
import { getCardLayout, getCardStyle, type CardLayoutKey } from "./cardStyles";
import { renderChristmasCard } from "./cardRenderer";

type Props = {
  message: string;
  styleKey: string;
  layoutKey?: CardLayoutKey;
  recipientName?: string;
  fromName?: string;
  photo: HTMLImageElement | null;
  year?: string;
  label: string;
  emptyLabel: string;
  /** Wrap the canvas PNG in a physical card + envelope stage. */
  physical?: boolean;
  asideNote?: string;
};

/**
 * Debounced client canvas preview — same renderer as the final PNG.
 * Optional physical framing keeps the finished card as the visual hero.
 */
export function CardLivePreview({
  message,
  styleKey,
  layoutKey = "square",
  recipientName,
  fromName,
  photo,
  year,
  label,
  emptyLabel,
  physical = true,
  asideNote,
}: Props) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const gen = useRef(0);
  const style = getCardStyle(styleKey);
  const layout = getCardLayout(layoutKey);

  useEffect(() => {
    const id = ++gen.current;
    const timer = window.setTimeout(() => {
      setBusy(true);
      const composed = message.trim()
        ? message
        : year
          ? `Merry Christmas ${year}`
          : "Merry Christmas";
      void renderChristmasCard({
        message: composed,
        styleKey,
        layoutKey,
        recipientName,
        fromName,
        photo,
        projectRef: "preview",
      })
        .then((rendered) => {
          if (gen.current !== id) return;
          setDataUrl(rendered.dataUrl);
        })
        .catch(() => {
          if (gen.current !== id) return;
          setDataUrl(null);
        })
        .finally(() => {
          if (gen.current === id) setBusy(false);
        });
    }, 160);
    return () => window.clearTimeout(timer);
  }, [message, styleKey, layoutKey, recipientName, fromName, photo, year]);

  const frame = (
    <div
      className={`ccm-live ccm-live--${layoutKey}`}
      aria-label={label}
      aria-busy={busy || undefined}
      style={{ aspectRatio: `${layout.width} / ${layout.height}` }}
    >
      {dataUrl ? (
        <img
          src={dataUrl}
          alt={label}
          width={layout.width}
          height={layout.height}
          decoding="async"
        />
      ) : (
        <div
          className="ccm-live__empty"
          style={{
            background: `linear-gradient(160deg, ${style.bgTop}, ${style.bgBottom})`,
            color: style.text,
          }}
        >
          {emptyLabel}
        </div>
      )}
      <span className="ccm-live__grain" aria-hidden="true" />
    </div>
  );

  if (!physical) return frame;

  return (
    <div className={`ccm-physical-stage ccm-physical-stage--${layoutKey}`}>
      <div className="ccm-envelope" aria-hidden="true" />
      <div className="ccm-card-object">{frame}</div>
      {asideNote ? (
        <p className="ccm-aside-note" aria-hidden="true">
          {asideNote}
        </p>
      ) : null}
    </div>
  );
}
