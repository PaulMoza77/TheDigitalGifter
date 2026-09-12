import { landingT, type ChristmasLandingLocale } from "../copy";
import { CabinHeroScene } from "../CabinHeroScene";
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
    <section className="xmas-hero xmas-hero--cabin" aria-labelledby="christmas-hero-title">
      <div className="xmas-hero__stage">
        <CabinHeroScene alt={t("hero.alt")} />
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
