import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { trackStoryEvent } from "../analytics";
import { activePrintProvider } from "../generation/printProvider";
import { saveOrder } from "../draftStore";
import type { StoryOrder } from "../types";
import { ExampleAudioPlayer } from "./ExampleAudioPlayer";
import { MemoryFilm } from "./MemoryFilm";

type Props = {
  order: StoryOrder;
  onChange: (order: StoryOrder) => void;
};

export function BuyerDashboard({ order, onChange }: Props) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const giftPath = useMemo(
    () => `/gift/${order.recipientToken}`,
    [order.recipientToken],
  );
  const giftUrl = useMemo(() => {
    if (typeof window === "undefined") return giftPath;
    return `${window.location.origin}${giftPath}`;
  }, [giftPath]);

  function persist(next: StoryOrder) {
    saveOrder(next);
    onChange(next);
  }

  async function approve() {
    const next: StoryOrder = {
      ...order,
      status: "READY_TO_SEND",
      approvedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    persist(next);
    trackStoryEvent("gift_approved", { order_status: next.status });
    setNote("Gift approved. You can copy the link or download the QR card.");
  }

  async function markSent() {
    const next: StoryOrder = {
      ...order,
      status: "SENT",
      sentAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    persist(next);
    trackStoryEvent("gift_sent", { order_status: next.status });
    setNote("Marked as sent. Recipient notifications stay off until you share the link yourself.");
  }

  async function downloadCard() {
    setBusy(true);
    try {
      const html = await activePrintProvider.giftCardHtml({
        recipientName: order.draft.recipientName || "Someone special",
        fromName: order.content?.fromName || "You",
        giftUrl,
        dedication: order.content?.dedication || "",
      });
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `gift-card-${order.draft.recipientName || "story"}.html`;
      a.click();
      URL.revokeObjectURL(url);
      setNote("Gift card HTML downloaded — open and Print → Save as PDF.");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(giftUrl);
      setNote("Private gift link copied.");
    } catch {
      setNote(giftUrl);
    }
  }

  return (
    <div className="cs-dashboard">
      <div className="cs-brand">
        <Link to="/christmas-story" className="cs-brand__name" style={{ color: "inherit", textDecoration: "none" }}>
          Digital Gifter
        </Link>
        <span className="cs-status">{order.status.replaceAll("_", " ")}</span>
      </div>

      <div><p className="cs-kicker">Made by you. Meant for them.</p><h1 className="cs-display" style={{ fontSize: "2.8rem", margin: 0 }}>
        A gift for {order.draft.recipientName || "someone special"}.
      </h1></div>
      <p className="cs-section__lead">Take a moment to read their story and explore the recipient view. Approval is yours to give.</p>
      {order.checkoutMode !== "live" ? <p className="cs-preview-banner" role="note">Local test gift · No payment taken. This link works only in this browser. Song, film and card generation are mocked; delivery to another device is not enabled.</p> : null}
      <details className="cs-order-details"><summary>Order details</summary>
      <p style={{ color: "var(--cs-ivory-soft)", margin: 0 }}>
        Order {order.id} · {order.draft.recipientName || "Recipient"} · $
        {(order.priceCents / 100).toFixed(0)} · checkout mode: {order.checkoutMode}
      </p>

      </details>
      {order.content ? (
        <>
          <div className="cs-panel">
            <p className="cs-kicker">01 · The dedication</p><h2>Your words, to keep.</h2>
            <p>{order.content.dedication}</p>
          </div>
          <ExampleAudioPlayer song={order.content.song} />
          <div className="cs-panel">
            <p className="cs-kicker">02 · The memories</p><h2>{order.content.film.title}</h2>
            <p>
              {order.content.film.frames.length} frame
              {order.content.film.frames.length === 1 ? "" : "s"} ·{" "}
              {order.content.film.videoUrl ? "Video available to review" : "Photo sequence only · finished film not available"}
            </p>
            <MemoryFilm film={order.content.film} />
          </div>
        </>
      ) : (
        <p>Content still generating…</p>
      )}

      <section className="cs-dashboard__actions" aria-labelledby="cs-review-actions"><p className="cs-kicker">03 · Your review</p><h2 id="cs-review-actions">Ready when you are.</h2>
      <Link className="cs-btn cs-btn--ghost" to={giftPath} target="_blank" rel="noreferrer">Preview their complete gift ↗ <span className="cs-microcopy">(new tab)</span></Link>
      <div className="cs-cta-row">
        <button
          type="button"
          className="cs-btn cs-btn--primary"
          onClick={() => void approve()}
          disabled={order.status === "READY_TO_SEND" || order.status === "SENT" || order.status === "OPENED"}
        >
          {order.checkoutMode === "live" ? "Approve final gift" : "Approve test gift"}
        </button>
        <button type="button" className="cs-btn cs-btn--ghost" onClick={() => void copyLink()}>
          Copy private link
        </button>
        <button
          type="button"
          className="cs-btn cs-btn--ghost"
          disabled={busy}
          onClick={() => void downloadCard()}
        >
          {busy ? "Preparing card…" : "Download printable card (HTML)"}
        </button>
        <button
          type="button"
          className="cs-btn cs-btn--ghost"
          onClick={() => void markSent()}
          disabled={order.status !== "READY_TO_SEND" && order.status !== "APPROVED"}
        >
          Mark as sent
        </button>
      </div>

      </section>
      <details className="cs-customize"><summary>Plan a delivery time <span>Saved locally only · automatic sending is not enabled</span></summary><div className="cs-customize__fields">
      <label className="cs-field">
        <span>Preferred delivery time (timezone: {order.draft.scheduleTz})</span>
        <input
          type="datetime-local"
          value={order.draft.scheduleAt?.slice(0, 16) ?? ""}
          onChange={(e) => {
            const next = {
              ...order,
              draft: {
                ...order.draft,
                scheduleAt: e.target.value ? new Date(e.target.value).toISOString() : null,
              },
              updatedAt: new Date().toISOString(),
            };
            persist(next);
          }}
        />
      </label>
      <p style={{ fontSize: "0.85rem", color: "var(--cs-ivory-soft)" }}>
        Scheduling stores the intent locally in this MVP. Server-side delivery jobs are not enabled.
        We never email the recipient before your approval.
      </p>

      </div></details>
      {note ? <p className="cs-preview-banner" role="status">{note}</p> : null}
    </div>
  );
}
