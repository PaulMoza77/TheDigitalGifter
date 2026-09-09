import { LANDING_ASSETS } from "../assets";
import { landingT, type ChristmasLandingLocale } from "../copy";

export function FinalCtaScene({
  locale,
  onCta,
  onBrowse,
}: {
  locale: ChristmasLandingLocale;
  onCta: () => void;
  onBrowse: () => void;
}) {
  const t = (key: string) => landingT(key, locale);

  return (
    <section className="xmas-hero xmas-finale" aria-labelledby="christmas-finale-title">
      <div className="xmas-hero__stage">
        <img
          className="xmas-hero__img"
          src={LANDING_ASSETS.finale}
          alt={t("finale.alt")}
          width={1280}
          height={720}
          loading="lazy"
        />
        <div className="xmas-hero__veil" />
        <div className="xmas-hero__flicker" aria-hidden="true" />
      </div>
      <div className="xmas-hero__content">
        <p className="xmas-kicker">{t("finale.kicker")}</p>
        <h2 id="christmas-finale-title">{t("finale.h2")}</h2>
        <p className="xmas-lede">{t("finale.lede")}</p>
        <div className="xmas-actions">
          <button type="button" className="xmas-btn xmas-btn--gold" onClick={onCta}>
            {t("finale.cta")}
          </button>
          <button type="button" className="xmas-btn xmas-btn--ghost" onClick={onBrowse}>
            {t("finale.secondary")}
          </button>
        </div>
      </div>
    </section>
  );
}
