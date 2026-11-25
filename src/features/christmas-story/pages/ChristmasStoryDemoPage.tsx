import { useEffect } from "react";
import { Link } from "react-router-dom";
import { trackStoryEvent } from "../analytics";
import { RecipientExperience } from "../components/RecipientExperience";
import { DEMO_GIFT } from "../data/demoGift";
import "../styles/christmasStory.css";
import "../styles/christmasStoryV2.css";

const FONT_HREF =
  "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Source+Sans+3:wght@400;500;600;700&display=swap";

export default function ChristmasStoryDemoPage() {
  useEffect(() => {
    if (!document.querySelector(`link[href="${FONT_HREF}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = FONT_HREF;
      document.head.appendChild(link);
    }
    document.title = "Example Gift · Digital Gifter";
    const m = document.createElement("meta");
    m.name = "robots";
    m.content = "noindex,nofollow";
    document.head.appendChild(m);
    trackStoryEvent("demo_play", { source: "demo_page" });
    return () => {
      m.remove();
    };
  }, []);

  return (
    <div className="cs-root cs-v2">
      <nav className="cs-demo-nav" aria-label="Sample gift navigation">
        <Link className="cs-text-link" to="/christmas-story">← Back to the collection</Link>
        <Link className="cs-btn cs-btn--ghost" to="/christmas-story/create">
          Create Their Gift
        </Link>
      </nav>
      <RecipientExperience
        content={DEMO_GIFT}
        isDemo
        onDemoPlay={() => trackStoryEvent("demo_play", { source: "audio" })}
      />
    </div>
  );
}
