import { useEffect } from "react";
import { GiftCreator } from "../components/GiftCreator";
import "../styles/christmasStory.css";
import "../styles/christmasStoryV2.css";

const FONT_HREF =
  "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Source+Sans+3:wght@400;500;600;700&display=swap";

export default function ChristmasStoryCreatePage() {
  useEffect(() => {
    if (!document.querySelector(`link[href="${FONT_HREF}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = FONT_HREF;
      document.head.appendChild(link);
    }
    document.title = "Create Their Gift · Digital Gifter";
  }, []);

  return (
    <div className="cs-root cs-v2">
      <main className="cs-shell">
        <GiftCreator />
      </main>
    </div>
  );
}
