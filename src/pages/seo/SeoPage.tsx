import { useParams } from "react-router-dom";
import ChristmasResultSharePage from "@/features/christmas/ChristmasResultSharePage";
import SeoPageCore from "./SeoPageCore";

/**
 * Keep the existing SEO page implementation untouched while routing the
 * capability-gated /share/:generationId surface through the same catch-all.
 */
export default function SeoPage() {
  const { pageType } = useParams<{ pageType?: string }>();
  if (pageType === "share") return <ChristmasResultSharePage />;
  return <SeoPageCore />;
}
