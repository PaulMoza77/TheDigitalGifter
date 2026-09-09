import { useEffect, useId } from "react";

type Props = {
  open: boolean;
  title: string;
  shareUrl: string;
  onClose: () => void;
  onCopy: () => void;
  onWhatsApp: () => void;
  onShare: () => void;
  hint?: string | null;
};

export function ShareWishlistSheet({
  open,
  title,
  shareUrl,
  onClose,
  onCopy,
  onWhatsApp,
  onShare,
  hint,
}: Props) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="wl-sheet-backdrop" role="presentation" onClick={onClose}>
      <div
        className="wl-sheet wl-sheet--share"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="wl-sheet__headline">
          Your Christmas Wishlist is ready 🎄
        </h2>
        <p className="wl-sheet__sub">{title}</p>
        <p className="wl-sheet__reassure">People can reserve gifts without spoiling the surprise.</p>

        <div className="wl-sheet__actions wl-sheet__actions--stack">
          <button type="button" className="wl-action wl-action--primary" onClick={onCopy}>
            Copy link
          </button>
          <button type="button" className="wl-action wl-action--soft" onClick={onWhatsApp}>
            WhatsApp
          </button>
          <button type="button" className="wl-action wl-action--soft" onClick={onShare}>
            Share
          </button>
        </div>

        {hint ? <p className="wl-sheet__hint">{hint}</p> : null}
        {shareUrl ? <p className="wl-sheet__url">{shareUrl}</p> : null}

        <button type="button" className="wl-action wl-action--ghost" onClick={onClose}>
          Keep writing
        </button>
      </div>
    </div>
  );
}
