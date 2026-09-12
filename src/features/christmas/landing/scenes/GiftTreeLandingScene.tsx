import { useEffect, useRef } from "react";
import { ChristmasGiftsExperience } from "@/features/christmas/gifts/ChristmasGiftsPage";
import { landingT, type ChristmasLandingLocale } from "../copy";
import { useInViewOnce } from "../useInViewOnce";

/**
 * Landing section: the real interactive Christmas gift tree (hotspots + open flow),
 * framed cleanly under the cabin hero — not the abstract CSS triangle.
 */
export function GiftTreeLandingScene({
  locale,
  onViewed,
}: {
  locale: ChristmasLandingLocale;
  onViewed?: () => void;
}) {
  const t = (key: string) => landingT(key, locale);
  const { ref, inView } = useInViewOnce<HTMLElement>();
  const viewedRef = useRef(false);

  useEffect(() => {
    if (!inView || viewedRef.current) return;
    viewedRef.current = true;
    onViewed?.();
  }, [inView, onViewed]);

  return (
    <section
      id="gift-tree"
      ref={ref}
      className="xmas-scene xmas-gift-tree-landing"
      aria-labelledby="gift-tree-title"
    >
      <div className={`xmas-gift-tree-landing__intro xmas-reveal ${inView ? "is-in" : ""}`}>
        <p className="xmas-kicker">{t("gifts.kicker")}</p>
        <h2 id="gift-tree-title">{t("gifts.h2")}</h2>
        <p className="xmas-lede">{t("gifts.lede")}</p>
      </div>
      <div className={`xmas-gift-tree-landing__frame xmas-reveal ${inView ? "is-in" : ""}`}>
        <ChristmasGiftsExperience embedded />
      </div>
    </section>
  );
}
