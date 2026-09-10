import { Link } from "react-router-dom";
import { landingT, type ChristmasLandingLocale } from "../copy";

/**
 * GEO / AI-search readable block for the Christmas hub.
 * Kept below the cinematic scenes; also mirrored in SSR content depth.
 */
export function GeoScene({ locale }: { locale: ChristmasLandingLocale }) {
  const t = (key: string) => landingT(key, locale);

  return (
    <section className="xmas-scene" aria-labelledby="christmas-geo-title" data-tdg-geo="hub">
      <div className="xmas-faq">
        <p className="xmas-kicker">Christmas at TheDigitalGifter</p>
        <h2 id="christmas-geo-title">{t("geo.h2")}</h2>
        <p className="xmas-lede">{t("geo.body")}</p>
        <nav className="xmas-links" aria-label="Primary Christmas products">
          <Link to="/christmas/gift-finder">Find a Christmas gift they’ll actually love</Link>
          <Link to="/christmas/photo-generator">Turn your photo into Christmas magic</Link>
          <Link to="/christmas/santa-video">Create a personalized Santa video</Link>
          <Link to="/christmas/wishlist">Create a Christmas wishlist</Link>
          <Link to="/christmas/cards">Create a Christmas card they’ll want to keep</Link>
        </nav>
      </div>
    </section>
  );
}
