import { useEffect, useId, useRef, useState } from "react";
import {
  formatMoney,
  retailerFromUrl,
  type WishlistItem,
} from "./wishlistApi";
import { priorityMark } from "./letterModel";

type Props = {
  item: WishlistItem;
  open: boolean;
  onClose: () => void;
  onSave: (patch: {
    external_url?: string | null;
    budget_amount?: number | null;
    preference_size?: string;
    preference_color?: string;
    note?: string;
    priority?: string;
    image_url?: string | null;
  }) => void | Promise<void>;
  onRemove?: () => void | Promise<void>;
  busy?: boolean;
};

export function WishDetailSheet({ item, open, onClose, onSave, onRemove, busy }: Props) {
  const titleId = useId();
  const [link, setLink] = useState(item.external_url || "");
  const [price, setPrice] = useState(item.budget_amount != null ? String(item.budget_amount) : "");
  const [size, setSize] = useState(item.preference_size || "");
  const [color, setColor] = useState(item.preference_color || "");
  const [note, setNote] = useState(item.note || "");
  const [priority, setPriority] = useState(item.priority || "would_love");
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setLink(item.external_url || "");
    setPrice(item.budget_amount != null ? String(item.budget_amount) : "");
    setSize(item.preference_size || "");
    setColor(item.preference_color || "");
    setNote(item.note || "");
    setPriority(item.priority || "would_love");
  }, [open, item]);

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
        ref={panelRef}
        className="wl-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="wl-sheet__title">
          Wish details
        </h2>
        <p className="wl-sheet__wish">{item.title}</p>

        <label className="wl-sheet__field">
          <span>Link</span>
          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://"
            inputMode="url"
            autoComplete="url"
          />
        </label>
        <label className="wl-sheet__field">
          <span>Price</span>
          <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder="e.g. 39" />
        </label>
        <div className="wl-sheet__row">
          <label className="wl-sheet__field">
            <span>Size</span>
            <input value={size} maxLength={40} onChange={(e) => setSize(e.target.value)} />
          </label>
          <label className="wl-sheet__field">
            <span>Color</span>
            <input value={color} maxLength={40} onChange={(e) => setColor(e.target.value)} />
          </label>
        </div>
        <label className="wl-sheet__field">
          <span>Note</span>
          <input value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="Any details…" />
        </label>

        <fieldset className="wl-sheet__priority">
          <legend>Priority</legend>
          <label>
            <input
              type="radio"
              name="priority"
              checked={priority === "really_want"}
              onChange={() => setPriority("really_want")}
            />
            Mark as favorite ❤️
          </label>
          <label>
            <input
              type="radio"
              name="priority"
              checked={priority === "would_love"}
              onChange={() => setPriority("would_love")}
            />
            Would love ★
          </label>
          <label>
            <input
              type="radio"
              name="priority"
              checked={priority === "nice_to_have"}
              onChange={() => setPriority("nice_to_have")}
            />
            Nice to have
          </label>
        </fieldset>

        <div className="wl-sheet__actions">
          <button
            type="button"
            className="wl-action wl-action--primary"
            disabled={busy}
            onClick={() =>
              void onSave({
                external_url: link.trim() || null,
                budget_amount: price.trim() === "" ? null : Number(price),
                preference_size: size,
                preference_color: color,
                note,
                priority,
              })
            }
          >
            Done
          </button>
          <button type="button" className="wl-action wl-action--ghost" onClick={onClose}>
            Cancel
          </button>
          {onRemove ? (
            <button type="button" className="wl-action wl-action--danger" disabled={busy} onClick={() => void onRemove()}>
              Remove wish
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

type MetaProps = {
  item: Pick<WishlistItem, "external_url" | "budget_amount" | "currency" | "priority" | "image_url">;
  locale?: string;
  onOpenLink?: () => void;
};

export function WishLineMeta({ item, locale = "en", onOpenLink }: MetaProps) {
  const money = formatMoney(item.budget_amount, item.currency, locale);
  const store = retailerFromUrl(item.external_url);
  if (!item.external_url && !money && !item.image_url) return null;

  return (
    <div className="wl-wish-line__meta">
      {item.image_url ? (
        <img className="wl-wish-line__polaroid" src={item.image_url} alt="" loading="lazy" />
      ) : null}
      {item.external_url ? (
        <a
          href={item.external_url}
          target="_blank"
          rel="noopener noreferrer"
          className="wl-wish-line__gift-link"
          onClick={(e) => {
            e.stopPropagation();
            onOpenLink?.();
          }}
        >
          View gift ↗{money ? ` · approx. ${money}` : store ? ` · ${store}` : ""}
        </a>
      ) : money ? (
        <span className="wl-wish-line__gift-link">approx. {money}</span>
      ) : null}
    </div>
  );
}

export function WishPriorityMark({ priority }: { priority?: string | null }) {
  const mark = priorityMark(priority);
  if (!mark) return null;
  return (
    <span className="wl-wish-line__heart" aria-hidden>
      {mark}
    </span>
  );
}
