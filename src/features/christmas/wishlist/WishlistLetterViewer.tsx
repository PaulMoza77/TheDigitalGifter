import { useState } from "react";
import { Link } from "react-router-dom";
import type { SharedWishlist, WishlistItem } from "./wishlistApi";
import { parseLetterDescription, signatureFromTitle } from "./letterModel";
import { WishlistLetterShell } from "./WishlistLetterShell";
import { WishLineMeta, WishPriorityMark } from "./WishDetailSheet";

type Props = {
  shared: SharedWishlist;
  busy: boolean;
  error: string | null;
  myReservations: Record<string, string>;
  viralTitle: string;
  viralCta: string;
  giftFinderLabel: string;
  onReserve: (item: WishlistItem) => Promise<void>;
  onMarkPurchased: (item: WishlistItem) => Promise<void>;
  onExternalClick: (item: WishlistItem) => void;
  onCreateMine: () => void;
};

export function WishlistLetterViewer({
  shared,
  busy,
  error,
  myReservations,
  viralTitle,
  viralCta,
  giftFinderLabel,
  onReserve,
  onMarkPurchased,
  onExternalClick,
  onCreateMine,
}: Props) {
  const framing = parseLetterDescription(shared.description);
  const signature = framing.signature || signatureFromTitle(shared.title);
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = shared.items.find((i) => i.id === activeId) || null;

  return (
    <>
      <WishlistLetterShell ariaLabel={shared.title}>
        <h1 className="wl-ink-title wl-ink-title--static">{shared.title}</h1>
        <div className="wl-ink-divider" aria-hidden>
          <span>♡</span>
        </div>

        <p className="wl-ink-salutation wl-ink-salutation--static">{framing.salutation}</p>
        {framing.intro ? <p className="wl-ink-intro wl-ink-intro--static">{framing.intro}</p> : null}

        {error ? (
          <p className="wl-alert" role="alert">
            {error}
          </p>
        ) : null}

        {busy && shared.items.length === 0 ? (
          <p className="wl-hint">Loading…</p>
        ) : (
          <ol className="wl-wish-lines" aria-label="Wishlist items">
            {shared.items.map((item, index) => {
              const taken = item.reservation_status === "reserved" || item.reservation_status === "purchased";
              const mine = Boolean(myReservations[item.id]);
              return (
                <li key={item.id} className={`wl-wish-line ${taken ? "wl-wish-line--taken" : ""}`}>
                  <span className="wl-wish-line__num" aria-hidden>
                    {index + 1}.
                  </span>
                  <div className="wl-wish-line__body">
                    <button
                      type="button"
                      className="wl-wish-line__read"
                      onClick={() => setActiveId(item.id === activeId ? null : item.id)}
                      aria-expanded={activeId === item.id}
                    >
                      <span className="wl-ink-wish wl-ink-wish--static">{item.title}</span>
                      <WishPriorityMark priority={item.priority} />
                    </button>
                    <WishLineMeta item={item} onOpenLink={() => onExternalClick(item)} />
                    {taken ? (
                      <p className="wl-wish-line__taken-note">
                        {item.reservation_status === "purchased" ? "Already taken care of ✓" : "Already taken care of ✓"}
                      </p>
                    ) : null}
                    {mine && item.reservation_status === "reserved" ? (
                      <button
                        type="button"
                        className="wl-wish-line__reserve-btn"
                        disabled={busy}
                        onClick={() => void onMarkPurchased(item)}
                      >
                        Mark purchased
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        <div className="wl-letter-closing">
          <p className="wl-ink-thanks">Thank you for making Christmas magical.</p>
          <p className="wl-ink-closing wl-ink-closing--static">{framing.closing}</p>
          {signature ? <p className="wl-ink-signature wl-ink-signature--static">{signature}</p> : null}
        </div>
      </WishlistLetterShell>

      {active && !(active.reservation_status === "reserved" || active.reservation_status === "purchased") ? (
        <div className="wl-sheet-backdrop" role="presentation" onClick={() => setActiveId(null)}>
          <div
            className="wl-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Reserve gift"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="wl-sheet__title">Want to get this{signature ? ` for ${signature}` : ""}?</h2>
            <p className="wl-sheet__wish">{active.title}</p>
            <WishLineMeta item={active} onOpenLink={() => onExternalClick(active)} />
            <div className="wl-sheet__actions">
              <button
                type="button"
                className="wl-action wl-action--primary"
                disabled={busy}
                onClick={() => {
                  void onReserve(active).then(() => setActiveId(null));
                }}
              >
                Reserve this gift
              </button>
              <button type="button" className="wl-action wl-action--ghost" onClick={() => setActiveId(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="wl-viral wl-viral--letter">
        <h2>{viralTitle}</h2>
        <button type="button" className="wl-action wl-action--primary" onClick={onCreateMine}>
          {viralCta}
        </button>
        <p className="wl-finder-link">
          <Link to="/christmas/gift-finder">{giftFinderLabel}</Link>
        </p>
      </div>
    </>
  );
}
