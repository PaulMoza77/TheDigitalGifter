import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { trackStoryEvent } from "../analytics";
import { activePrintProvider } from "../generation/printProvider";
import { saveOrder } from "../draftStore";
import {
  approveBuyerOrder,
  buyerPreviewOrder,
  isStoryApiEnabled,
  markBuyerOrderSent,
  readRecipientToken,
  requestMediaRevision,
  scheduleBuyerOrder,
} from "../storyApi";
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
  const [revisionReason, setRevisionReason] = useState("");

  const mediaReady =
    Boolean(order.content?.song?.audioUrl) &&
    order.content?.song?.status === "ready" &&
    Boolean(order.content?.film?.videoUrl) &&
    order.content?.film?.status === "ready";
  const mediaPending =
    order.content?.song?.status === "pending" ||
    order.content?.film?.status === "pending" ||
    (!order.content?.song?.audioUrl && !order.content?.song?.isExample) ||
    (!order.content?.film?.videoUrl && !order.content?.film?.isExample);

  const recipientToken = useMemo(
    () => readRecipientToken(order.id) || order.recipientToken,
    [order.id, order.recipientToken],
  );
  const giftPath = useMemo(() => `/gift/${recipientToken}`, [recipientToken]);
  const giftUrl = useMemo(() => {
    if (typeof window === "undefined") return giftPath;
    return `${window.location.origin}${giftPath}`;
  }, [giftPath]);

  function persist(next: StoryOrder) {
    saveOrder(next);
    onChange(next);
  }

  async function requestRevision(kind: "song" | "film") {
    if (!revisionReason.trim()) {
      setNote("Please describe the revision you need.");
      return;
    }
    if (isStoryApiEnabled()) {
      const res = await requestMediaRevision(order.id, kind, revisionReason.trim());
      if (!res.ok) {
        setNote(res.message || `Revision request failed (${res.code}).`);
        return;
      }
      setNote(`Revision requested for the ${kind}. Production will update this gift.`);
      return;
    }
    setNote(`Revision noted locally for the ${kind}. Connect the durable API for server tracking.`);
  }

  async function approve() {
    if (isStoryApiEnabled()) {
      if (mediaPending && !mediaReady) {
        setNote("Media is still in production. Approval stays blocked until song and film are ready.");
        return;
      }
      const res = await approveBuyerOrder(order.id);
      if (res.ok) {
        const next: StoryOrder = {
          ...order,
          status: "READY_TO_SEND",
          approvedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        persist(next);
        trackStoryEvent("gift_approved", { order_status: next.status });
        setNote("Gift approved on server. You can copy the link or download the QR card.");
        // Buyer preview must never mark recipient OPENED
        void buyerPreviewOrder(order.id);
        return;
      }
      // Never claim an approved gift if server approval fails.
      setNote(res.message || `Approval failed (${res.code}). The gift was not approved.`);
      return;
    }
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
    if (isStoryApiEnabled()) {
      const res = await markBuyerOrderSent(order.id);
      if (res.ok) {
        const next: StoryOrder = {
          ...order,
          status: "SENT",
          sentAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        persist(next);
        trackStoryEvent("gift_sent", { order_status: next.status });
        setNote("Marked as sent. Recipient access is now enabled server-side.");
        return;
      }
      // No optimistic local SENT state on backend denial or network failure.
      setNote(res.message || `Delivery status update failed (${res.code}). Recipient access was not enabled.`);
      return;
    }
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
      {order.status === "CHECKOUT_PENDING" ? (
        <p className="cs-preview-banner" role="status">
          Payment pending · Stripe TEST session created. This order is not marked paid until the
          verified webhook confirms it.
        </p>
      ) : null}
      {order.status === "FAILED" || order.status === "CANCELLED" ? (
        <p className="cs-preview-banner" role="alert">
          Checkout {order.status.toLowerCase()}. No charge was completed for this gift.
        </p>
      ) : null}
      {order.checkoutMode === "disabled" ? (
        <p className="cs-preview-banner" role="note">
          Local test gift · No payment taken. Song, film and card generation are mocked.
        </p>
      ) : null}
      <details className="cs-order-details"><summary>Order details</summary>
      <p style={{ color: "var(--cs-ivory-soft)", margin: 0 }}>
        Order {order.id} · {order.draft.recipientName || "Recipient"} · $
        {(order.priceCents / 100).toFixed(0)} · checkout mode: {order.checkoutMode} · status:{" "}
        {order.status.replaceAll("_", " ")}
      </p>

      </details>
      {order.content ? (
        <>
          <div className="cs-panel">
            <p className="cs-kicker">01 · The dedication</p><h2>Your words, to keep.</h2>
            <p>{order.content.dedication}</p>
          </div>
          <ExampleAudioPlayer song={order.content.song} />
          {!order.content.song.audioUrl && !order.content.song.isExample ? (
            <p className="cs-media-note" role="status">
              Song status: {order.content.song.status}. A finished licensed master is not available yet.
            </p>
          ) : null}
          <div className="cs-panel">
            <p className="cs-kicker">02 · The memories</p><h2>{order.content.film.title}</h2>
            <p>
              {order.content.film.frames.length} frame
              {order.content.film.frames.length === 1 ? "" : "s"} ·{" "}
              {order.content.film.videoUrl
                ? "Video available to review"
                : "Finished memory film not available yet"}
            </p>
            <MemoryFilm film={order.content.film} />
          </div>
        </>
      ) : (
        <p>Content still generating…</p>
      )}

      <section className="cs-dashboard__actions" aria-labelledby="cs-review-actions"><p className="cs-kicker">03 · Your review</p><h2 id="cs-review-actions">Ready when you are.</h2>
      {mediaPending && !order.content?.song?.isExample ? (
        <p className="cs-preview-banner" role="status">
          Production in progress — song and/or film are not ready. This gift will not be marked READY until both deliverables are available.
        </p>
      ) : null}
      <Link className="cs-btn cs-btn--ghost" to={giftPath} target="_blank" rel="noreferrer">Preview their complete gift ↗ <span className="cs-microcopy">(new tab)</span></Link>
      <div className="cs-cta-row">
        <button
          type="button"
          className="cs-btn cs-btn--primary"
          onClick={() => void approve()}
          disabled={
            order.status === "CHECKOUT_PENDING" ||
            order.status === "FAILED" ||
            order.status === "CANCELLED" ||
            order.status === "READY_TO_SEND" ||
            order.status === "SENT" ||
            order.status === "OPENED"
          }
        >
          {order.checkoutMode === "live" ? "Approve final gift" : "Approve gift"}
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
      <label className="cs-field" style={{ marginTop: "1rem" }}>
        <span>Request a limited revision</span>
        <input
          type="text"
          value={revisionReason}
          onChange={(e) => setRevisionReason(e.target.value)}
          placeholder="e.g. Softer chorus / slower photo pacing"
        />
      </label>
      <div className="cs-cta-row">
        <button type="button" className="cs-btn cs-btn--ghost" onClick={() => void requestRevision("song")}>
          Revise song
        </button>
        <button type="button" className="cs-btn cs-btn--ghost" onClick={() => void requestRevision("film")}>
          Revise film
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
            const scheduleAt = e.target.value ? new Date(e.target.value).toISOString() : null;
            const next = {
              ...order,
              draft: {
                ...order.draft,
                scheduleAt,
              },
              updatedAt: new Date().toISOString(),
            };
            persist(next);
            if (isStoryApiEnabled()) {
              void scheduleBuyerOrder(order.id, scheduleAt, order.draft.scheduleTz);
            }
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
