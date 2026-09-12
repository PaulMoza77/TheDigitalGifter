import { landingT, type ChristmasLandingLocale } from "../copy";
import { useInViewOnce } from "../useInViewOnce";

export function WorldTransition({ locale }: { locale: ChristmasLandingLocale }) {
  const { ref, inView } = useInViewOnce<HTMLElement>();
  const t = (key: string) => landingT(key, locale);

  return (
    <section
      id="christmas-world"
      ref={ref}
      className="xmas-scene xmas-transition"
      aria-labelledby="christmas-world-title"
    >
      <div className={`xmas-copy xmas-reveal ${inView ? "is-in" : ""}`}>
        <p className="xmas-kicker">{t("transition.kicker")}</p>
        <h2 id="christmas-world-title">{t("transition.h2")}</h2>
        <p className="xmas-lede">{t("transition.lede")}</p>
      </div>
    </section>
  );
}
