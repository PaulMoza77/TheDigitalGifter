import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { trackStoryEvent } from "../analytics";
import { activePrintProvider } from "../generation/printProvider";
import { saveOrder } from "../draftStore";
import type { StoryOrder } from "../types";
import { ExampleAudioPlayer } from "./ExampleAudioPlayer";

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

      <h1 className="cs-display" style={{ fontSize: "2rem", margin: 0 }}>
        Buyer review
      </h1>
      <p style={{ color: "var(--cs-ivory-soft)", margin: 0 }}>
        Order {order.id} · {order.draft.recipientName || "Recipient"} · $
        {(order.priceCents / 100).toFixed(0)} · checkout mode: {order.checkoutMode}
      </p>

      {order.content ? (
        <>
          <div className="cs-panel">
            <h3>Dedication</h3>
            <p>{order.content.dedication}</p>
          </div>
          <ExampleAudioPlayer song={order.content.song} />
          <div className="cs-panel">
            <h3>Memory film</h3>
            <p>
              {order.content.film.frames.length} frame
              {order.content.film.frames.length === 1 ? "" : "s"} ·{" "}
              {order.content.film.videoUrl ? "MP4 ready" : "slideshow preview (MP4 export mocked)"}
            </p>
          </div>
        </>
      ) : (
        <p>Content still generating…</p>
      )}

      <div className="cs-cta-row">
        <button
          type="button"
          className="cs-btn cs-btn--primary"
          onClick={() => void approve()}
          disabled={order.status === "READY_TO_SEND" || order.status === "SENT" || order.status === "OPENED"}
        >
          Approve final gift
        </button>
        <button type="button" className="cs-btn cs-btn--ghost" onClick={() => void copyLink()}>
          Copy private link
        </button>
        <Link className="cs-btn cs-btn--ghost" to={giftPath} target="_blank" rel="noreferrer">
          Open recipient view
        </Link>
        <button
          type="button"
          className="cs-btn cs-btn--ghost"
          disabled={busy}
          onClick={() => void downloadCard()}
        >
          Download QR gift card
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

      <label className="cs-field">
        <span>Schedule delivery (timezone: {order.draft.scheduleTz})</span>
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

      {note ? <p className="cs-preview-banner">{note}</p> : null}
    </div>
  );
}
