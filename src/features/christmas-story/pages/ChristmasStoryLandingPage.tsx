import { useEffect } from "react";
import { StoryLanding } from "../components/StoryLanding";
import "../styles/christmasStory.css";

const FONT_HREF =
  "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Source+Sans+3:wght@400;500;600;700&display=swap";

function ensureFonts() {
  if (typeof document === "undefined") return;
  if (document.querySelector(`link[href="${FONT_HREF}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = FONT_HREF;
  document.head.appendChild(link);
}

export default function ChristmasStoryLandingPage() {
  useEffect(() => {
    ensureFonts();
    document.title = "Digital Gifter · Our Christmas Story";
    const robots = document.querySelector('meta[name="robots"]');
    // Landing is public/indexable when live; keep soft for MVP staging.
    if (!robots) {
      const m = document.createElement("meta");
      m.name = "robots";
      m.content = "noindex,nofollow";
      document.head.appendChild(m);
    }
  }, []);

  return (
    <div className="cs-root">
      <StoryLanding />
    </div>
  );
}
