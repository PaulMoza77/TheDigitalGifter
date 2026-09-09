import { LANDING_ASSETS } from "../assets";
import { landingT, type ChristmasLandingLocale } from "../copy";
import { SceneShell } from "../SceneShell";

export function WishlistScene({
  locale,
  onCta,
}: {
  locale: ChristmasLandingLocale;
  onCta: () => void;
}) {
  const t = (key: string) => landingT(key, locale);

  return (
    <SceneShell
      id="wishlist"
      kicker={t("wishlist.kicker")}
      title={t("wishlist.h2")}
      lede={t("wishlist.lede")}
      reverse
      visual={
        <figure className="xmas-photo">
          <img src={LANDING_ASSETS.wishlist} alt={t("wishlist.alt")} width={1152} height={864} loading="lazy" />
        </figure>
      }
    >
      <div className="xmas-actions">
        <button type="button" className="xmas-btn xmas-btn--gold" onClick={onCta}>
          {t("wishlist.cta")}
        </button>
      </div>
    </SceneShell>
  );
}
