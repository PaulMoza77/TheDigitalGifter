import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { trackStoryEvent } from "../analytics";
import { RecipientExperience } from "../components/RecipientExperience";
import { DEMO_GIFT, DEMO_RECIPIENT_TOKEN } from "../data/demoGift";
import { getOrderByRecipientToken, saveOrder } from "../draftStore";
import { fetchRecipientGift, isStoryApiEnabled } from "../storyApi";
import type { StoryGiftContent, StoryOrder } from "../types";
import "../styles/christmasStory.css";

const FONT_HREF =
  "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Source+Sans+3:wght@400;500;600;700&display=swap";

/**
 * Private recipient gift.
 * In server mode, the Edge authorization decision is authoritative: never
 * fall back to browser-local content after a server denial or network error.
 * The local test gift remains available only with the backend feature disabled.
 */
export default function GiftRecipientPage() {
  const { token } = useParams();
  const [content, setContent] = useState<StoryGiftContent | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [order, setOrder] = useState<StoryOrder | null>(null);
  const [resolvedToken, setResolvedToken] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  useEffect(() => {
    if (!document.querySelector(`link[href="${FONT_HREF}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = FONT_HREF;
      document.head.appendChild(link);
    }
    document.title = "A gift for you";
    let robots = document.querySelector('meta[name="robots"]');
    if (!robots) {
      robots = document.createElement("meta");
      robots.setAttribute("name", "robots");
      document.head.appendChild(robots);
    }
    robots.setAttribute("content", "noindex,nofollow,noarchive");
    document.querySelectorAll('meta[property^="og:"], meta[name^="twitter:"]').forEach((n) => n.remove());

    let cancelled = false;
    setResolvedToken(token);
    setOrder(null);
    setIsDemo(false);
    setContent(null);
    setErrorCode(null);
    setLoading(true);

    async function load() {
      if (!token) {
        if (!cancelled) setLoading(false);
        return;
      }
      if (token === DEMO_RECIPIENT_TOKEN) {
        if (!cancelled) {
          setContent(DEMO_GIFT);
          setIsDemo(true);
          setLoading(false);
        }
        return;
      }

      if (isStoryApiEnabled()) {
        try {
          const res = await fetchRecipientGift(token, { markOpened: false });
          if (cancelled) return;
          if (res.ok && res.data.gift?.content) {
            setContent(res.data.gift.content);
          } else {
            setErrorCode(res.ok ? "content_not_ready" : res.code);
          }
        } catch {
          if (!cancelled) setErrorCode("service_unavailable");
        } finally {
          if (!cancelled) setLoading(false);
        }
        return;
      }

      // Local test-mode fallback is intentionally unavailable in server mode.
      let found: StoryOrder | null = null;
      try { found = getOrderByRecipientToken(token); }
      catch { /* Browser storage can be blocked. */ }
      if (cancelled) return;
      if (found?.content) {
        setOrder(found);
        setContent(found.content);
      }
      setLoading(false);
    }
    void load();
    return () => { cancelled = true; };
  }, [token]);

  async function onOpened() {
    if (isDemo) {
      trackStoryEvent("gift_opened", { is_demo: true });
      return;
    }
    if (token && isStoryApiEnabled()) {
      try {
        const res = await fetchRecipientGift(token, { markOpened: true });
        if (res.ok) trackStoryEvent("gift_opened", { is_demo: false });
        else setErrorCode(res.code);
      } catch {
        setErrorCode("service_unavailable");
      }
      return;
    }
    if (order) {
      if (order.status !== "OPENED") {
        const next: StoryOrder = {
          ...order,
          status: "OPENED",
          openedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        try { saveOrder(next); } catch { /* Local demo persistence optional. */ }
        setOrder(next);
      }
      trackStoryEvent("gift_opened", { is_demo: false });
    }
  }

  return (
    <div className="cs-root">
      {resolvedToken !== token || loading ? (
        <main className="cs-gift" aria-busy="true"><p role="status">Preparing your gift…</p></main>
      ) : content ? (
        <RecipientExperience
          key={token}
          content={content}
          isDemo={isDemo}
          onOpened={() => void onOpened()}
          onDemoPlay={() => trackStoryEvent("demo_play", { source: "recipient_audio" })}
          onReaction={(text) => {
            if (text) trackStoryEvent("recipient_reaction", { length: text.length });
          }}
        />
      ) : (
        <main className="cs-gift">
          <div className="cs-gift__stage">
            <h1>Gift unavailable</h1>
            <p>
              {errorCode === "access_revoked" || errorCode === "not_delivered"
                ? "This gift is not available yet, or access was revoked."
                : errorCode === "access_expired"
                  ? "This gift link has expired."
                  : errorCode === "service_unavailable" || errorCode === "invoke_failed"
                    ? "We couldn't load this gift right now. Please try again later."
                    : errorCode === "content_not_ready"
                      ? "This gift is being prepared and is not ready to open yet."
                      : "This private link is invalid, expired, or not available."}
            </p>
            <Link className="cs-btn cs-btn--ghost" to="/christmas-story">
              Digital Gifter
            </Link>
          </div>
        </main>
      )}
    </div>
  );
}
