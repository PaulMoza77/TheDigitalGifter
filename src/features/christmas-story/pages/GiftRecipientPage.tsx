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
 * Recipient gift experience.
 * Never shows pricing, invoices, or advertising inside the story flow.
 * Cross-device: prefers durable Edge lookup by hashed recipient token.
 */
export default function GiftRecipientPage() {
  const { token } = useParams();
  const [content, setContent] = useState<StoryGiftContent | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [order, setOrder] = useState<StoryOrder | null>(null);
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
    async function load() {
      if (!token) {
        setLoading(false);
        return;
      }
      if (token === DEMO_RECIPIENT_TOKEN) {
        setContent(DEMO_GIFT);
        setIsDemo(true);
        setLoading(false);
        return;
      }

      if (isStoryApiEnabled()) {
        const res = await fetchRecipientGift(token, { markOpened: false });
        if (cancelled) return;
        if (res.ok && res.data.gift?.content) {
          setContent(res.data.gift.content);
          setIsDemo(false);
          setErrorCode(null);
          setLoading(false);
          return;
        }
        if (!res.ok) setErrorCode(res.code);
      }

      const found = getOrderByRecipientToken(token);
      if (found?.content) {
        setOrder(found);
        setContent(found.content);
        setIsDemo(false);
      } else {
        setContent(null);
      }
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function onOpened() {
    trackStoryEvent("gift_opened", { is_demo: isDemo });
    if (isDemo) return;

    if (token && isStoryApiEnabled()) {
      // Only mark OPENED via explicit recipient action — never from buyer preview.
      await fetchRecipientGift(token, { markOpened: true });
    }

    if (order && order.status !== "OPENED") {
      const next: StoryOrder = {
        ...order,
        status: "OPENED",
        openedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      saveOrder(next);
      setOrder(next);
    }
  }

  return (
    <div className="cs-root">
      {loading ? (
        <div className="cs-gift">
          <div className="cs-gift__stage">
            <p>Opening your gift…</p>
          </div>
        </div>
      ) : content ? (
        <RecipientExperience
          content={content}
          isDemo={isDemo}
          onOpened={() => void onOpened()}
          onDemoPlay={() => trackStoryEvent("demo_play", { source: "recipient_audio" })}
          onReaction={(text) => {
            if (text) trackStoryEvent("recipient_reaction", { length: text.length });
          }}
        />
      ) : (
        <div className="cs-gift">
          <div className="cs-gift__stage">
            <h1>Gift unavailable</h1>
            <p>
              {errorCode === "access_revoked" || errorCode === "not_delivered"
                ? "This gift is not available yet, or access was revoked."
                : errorCode === "access_expired"
                  ? "This gift link has expired."
                  : "This private link is invalid, expired, or not available."}
            </p>
            <Link className="cs-btn cs-btn--ghost" to="/christmas-story">
              Digital Gifter
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
