import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { trackStoryEvent } from "../analytics";
import { RecipientExperience } from "../components/RecipientExperience";
import { DEMO_GIFT, DEMO_RECIPIENT_TOKEN } from "../data/demoGift";
import { getOrderByRecipientToken, saveOrder } from "../draftStore";
import type { StoryGiftContent, StoryOrder } from "../types";
import "../styles/christmasStory.css";

const FONT_HREF =
  "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Source+Sans+3:wght@400;500;600;700&display=swap";

/**
 * Recipient gift experience.
 * Never shows pricing, invoices, or advertising inside the story flow.
 */
export default function GiftRecipientPage() {
  const { token } = useParams();
  const [content, setContent] = useState<StoryGiftContent | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [order, setOrder] = useState<StoryOrder | null>(null);
  const [resolvedToken, setResolvedToken] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!document.querySelector(`link[href="${FONT_HREF}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = FONT_HREF;
      document.head.appendChild(link);
    }
    document.title = "A gift for you";
    // Prevent indexing / social scrapers leaking private content.
    let robots = document.querySelector('meta[name="robots"]');
    if (!robots) {
      robots = document.createElement("meta");
      robots.setAttribute("name", "robots");
      document.head.appendChild(robots);
    }
    robots.setAttribute("content", "noindex,nofollow,noarchive");

    // Strip open-graph style previews if present from shell.
    document.querySelectorAll('meta[property^="og:"], meta[name^="twitter:"]').forEach((n) => n.remove());

    setResolvedToken(token);
    setOrder(null);
    setIsDemo(false);
    setContent(null);
    if (!token) return;
    if (token === DEMO_RECIPIENT_TOKEN) {
      setContent(DEMO_GIFT);
      setIsDemo(true);
      return;
    }
    let found: StoryOrder | null = null;
    try { found = getOrderByRecipientToken(token); } catch { /* Storage may be unavailable. */ }
    if (found?.content) {
      setOrder(found);
      setContent(found.content);
      setIsDemo(false);
    } else {
      setContent(null);
    }
  }, [token]);

  function onOpened() {
    trackStoryEvent("gift_opened", { is_demo: isDemo });
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
      {resolvedToken !== token ? <main className="cs-gift" aria-busy="true"><p role="status">Preparing your gift…</p></main> : content ? (
        <RecipientExperience
          key={token}
          content={content}
          isDemo={isDemo}
          onOpened={onOpened}
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
              This private link is invalid, expired, or not available in this browser&apos;s local
              test store.
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
