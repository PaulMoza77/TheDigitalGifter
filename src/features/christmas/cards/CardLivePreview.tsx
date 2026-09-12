import { useEffect, useRef, useState } from "react";
import { getCardStyle, type CardLayoutKey } from "./cardStyles";
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
};

/**
 * Debounced client canvas preview — same renderer as the final PNG.
 * Keeps the finished-card object as the hero during editing.
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
}: Props) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const gen = useRef(0);
  const style = getCardStyle(styleKey);

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
    }, 180);
    return () => window.clearTimeout(timer);
  }, [message, styleKey, layoutKey, recipientName, fromName, photo, year]);

  return (
    <div className="ccm-live" aria-label={label} aria-busy={busy || undefined}>
      {dataUrl ? (
        <img src={dataUrl} alt={label} width={1080} height={1080} />
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
    </div>
  );
}
