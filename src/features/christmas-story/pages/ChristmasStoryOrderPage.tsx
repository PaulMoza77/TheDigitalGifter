import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { BuyerDashboard } from "../components/BuyerDashboard";
import { getOrder } from "../draftStore";
import type { StoryOrder } from "../types";
import "../styles/christmasStory.css";

const FONT_HREF =
  "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Source+Sans+3:wght@400;500;600;700&display=swap";

export default function ChristmasStoryOrderPage() {
  const { orderId } = useParams();
  const [order, setOrder] = useState<StoryOrder | null>(null);

  useEffect(() => {
    if (!document.querySelector(`link[href="${FONT_HREF}"]`)) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = FONT_HREF;
      document.head.appendChild(link);
    }
    document.title = "Order · Digital Gifter";
    if (orderId) setOrder(getOrder(orderId));
  }, [orderId]);

  return (
    <div className="cs-root">
      <div className="cs-shell">
        {order ? (
          <BuyerDashboard order={order} onChange={setOrder} />
        ) : (
          <div className="cs-dashboard">
            <h1 className="cs-display">Order not found</h1>
            <p style={{ color: "var(--cs-ivory-soft)" }}>
              This MVP stores test orders in your browser. Create a gift to generate one.
            </p>
            <Link className="cs-btn cs-btn--primary" to="/christmas-story/create">
              Create Their Gift
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
