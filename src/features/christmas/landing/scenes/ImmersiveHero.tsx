import { LANDING_ASSETS } from "../assets";
import { landingT, type ChristmasLandingLocale } from "../copy";
import { HeroAtmosphere } from "../HeroAtmosphere";
import { HeroCountdown } from "../HeroCountdown";

export function ImmersiveHero({
  locale,
  onPrimary,
  onExplore,
}: {
  locale: ChristmasLandingLocale;
  onPrimary: () => void;
  onExplore: () => void;
}) {
  const t = (key: string) => landingT(key, locale);

  return (
    <section className="xmas-hero" aria-labelledby="christmas-hero-title">
      <div className="xmas-hero__stage">
        <img
          className="xmas-hero__img"
          src={LANDING_ASSETS.hero}
          alt={t("hero.alt")}
          width={1280}
          height={720}
          fetchPriority="high"
          decoding="async"
        />
        <div className="xmas-hero__veil" />
        <HeroAtmosphere />
      </div>
      <div className="xmas-hero__content">
        <p className="xmas-kicker">{t("hero.eyebrow")}</p>
        <HeroCountdown locale={locale} />
        <h1 id="christmas-hero-title">{t("hero.h1")}</h1>
        <p className="xmas-lede">{t("hero.lede")}</p>
        <div className="xmas-actions">
          <button type="button" className="xmas-btn xmas-btn--gold" onClick={onPrimary}>
            {t("hero.cta")}
          </button>
          <button type="button" className="xmas-btn xmas-btn--ghost" onClick={onExplore}>
            {t("hero.secondary")}
          </button>
        </div>
      </div>
    </section>
  );
}
