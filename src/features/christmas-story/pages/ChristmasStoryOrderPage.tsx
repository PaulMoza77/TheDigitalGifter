import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { BuyerDashboard } from "../components/BuyerDashboard";
import { getOrder, saveOrder } from "../draftStore";
import {
  fetchBuyerOrder,
  isStoryApiEnabled,
  mapServerOrderToStoryOrder,
  redeemBuyerRecovery,
  requestBuyerRecovery,
  syncCheckoutStatus,
  writeBuyerAccessToken,
} from "../storyApi";
import type { StoryOrder } from "../types";
import "../styles/christmasStory.css";

const FONT_HREF =
  "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Source+Sans+3:wght@400;500;600;700&display=swap";

export default function ChristmasStoryOrderPage() {
  const { orderId } = useParams();
  const [params] = useSearchParams();
  const [order, setOrder] = useState<StoryOrder | null>(null);
  const [resolvedId, setResolvedId] = useState<string | undefined>(undefined);
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoveryToken, setRecoveryToken] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!document.querySelector(`link[href="${FONT_HREF}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = FONT_HREF;
      document.head.appendChild(link);
    }
    document.title = "Order · Digital Gifter";

    let cancelled = false;
    async function load() {
      setResolvedId(orderId);
      const checkout = params.get("checkout");
      let local: StoryOrder | null = null;
      try {
        local = orderId ? getOrder(orderId) : null;
      } catch {
        local = null;
      }

      if (orderId && isStoryApiEnabled()) {
        if (checkout === "cancel") {
          const sync = await syncCheckoutStatus(orderId, { markCancelled: true });
          if (!cancelled && sync.ok) {
            const mapped = mapServerOrderToStoryOrder(sync.data.order, local || undefined);
            saveOrder(mapped);
            setOrder(mapped);
            setStatusNote("Checkout cancelled. No payment was taken.");
            return;
          }
        }
        if (checkout === "success") {
          const sync = await syncCheckoutStatus(orderId);
          if (!cancelled && sync.ok) {
            const mapped = mapServerOrderToStoryOrder(sync.data.order, local || undefined);
            saveOrder(mapped);
            setOrder(mapped);
            if (sync.data.awaitsWebhook) {
              setStatusNote("Payment seen on Stripe TEST — waiting for verified webhook before marking paid.");
            } else if (sync.data.paidLocally) {
              setStatusNote("Payment verified. Your gift is being prepared.");
            } else {
              setStatusNote("Checkout returned — order is still pending payment confirmation.");
            }
          }
        }

        const remote = await fetchBuyerOrder(orderId);
        if (cancelled) return;
        if (remote.ok) {
          const mapped = mapServerOrderToStoryOrder(remote.data.order, local || undefined);
          saveOrder(mapped);
          setOrder(mapped);
          return;
        }
        // Denied / missing token: do not invent a successful local order.
        if (local && remote.code === "no_buyer_token") {
          setOrder(null);
          setStatusNote("Sign in with your order email to recover this gift on this device.");
          return;
        }
        setOrder(null);
        setStatusNote(remote.message || `Could not load order (${remote.code}).`);
        return;
      }

      if (!cancelled) setOrder(local);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [orderId, params]);

  async function onRequestRecovery() {
    setBusy(true);
    setStatusNote(null);
    try {
      const res = await requestBuyerRecovery(recoveryEmail.trim());
      if (!res.ok) {
        setStatusNote(res.message || `Recovery failed (${res.code}).`);
        return;
      }
      if (res.data.recoveryToken) {
        setRecoveryToken(res.data.recoveryToken);
        setStatusNote("Staging recovery token issued (email provider not wired). Redeem it below.");
      } else {
        setStatusNote("If that email has orders, a recovery link was prepared.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function onRedeemRecovery() {
    setBusy(true);
    setStatusNote(null);
    try {
      const res = await redeemBuyerRecovery(recoveryToken.trim());
      if (!res.ok) {
        setStatusNote(res.message || `Redeem failed (${res.code}).`);
        return;
      }
      writeBuyerAccessToken(res.data.buyerAccessToken);
      const mapped = mapServerOrderToStoryOrder(res.data.order, order || undefined);
      saveOrder(mapped);
      setOrder(mapped);
      setStatusNote("Order recovered on this device.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="cs-root">
      <main className="cs-shell">
        {resolvedId !== orderId ? (
          <p role="status" aria-busy="true">
            Opening your gift review…
          </p>
        ) : order ? (
          <>
            {statusNote ? (
              <p className="cs-preview-banner" role="status">
                {statusNote}
              </p>
            ) : null}
            <BuyerDashboard order={order} onChange={setOrder} />
          </>
        ) : (
          <div className="cs-dashboard">
            <h1 className="cs-display">Recover your order</h1>
            <p style={{ color: "var(--cs-ivory-soft)" }}>
              {statusNote ||
                "This gift is loaded from the server with your private buyer access. Use email recovery if you switched devices."}
            </p>
            {isStoryApiEnabled() ? (
              <div className="cs-panel" style={{ display: "grid", gap: "0.75rem", maxWidth: 420 }}>
                <label className="cs-field">
                  <span>Order email</span>
                  <input
                    type="email"
                    value={recoveryEmail}
                    onChange={(e) => setRecoveryEmail(e.target.value)}
                    autoComplete="email"
                  />
                </label>
                <button
                  type="button"
                  className="cs-btn cs-btn--primary"
                  disabled={busy || !recoveryEmail.includes("@")}
                  onClick={() => void onRequestRecovery()}
                >
                  Request recovery
                </button>
                <label className="cs-field">
                  <span>Recovery token</span>
                  <input
                    type="text"
                    value={recoveryToken}
                    onChange={(e) => setRecoveryToken(e.target.value)}
                    autoComplete="one-time-code"
                  />
                </label>
                <button
                  type="button"
                  className="cs-btn cs-btn--ghost"
                  disabled={busy || recoveryToken.length < 32}
                  onClick={() => void onRedeemRecovery()}
                >
                  Redeem access
                </button>
              </div>
            ) : null}
            <Link className="cs-btn cs-btn--primary" to="/christmas-story/create">
              Create Their Gift
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
