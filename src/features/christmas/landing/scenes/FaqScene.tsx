import { Link } from "react-router-dom";
import { landingT, type ChristmasLandingLocale } from "../copy";
import { LANDING_FAQS, LANDING_INTERNAL_LINKS } from "../seo";

export function FaqScene({ locale }: { locale: ChristmasLandingLocale }) {
  const t = (key: string) => landingT(key, locale);

  return (
    <section className="xmas-scene" aria-labelledby="christmas-faq-title">
      <div className="xmas-faq">
        <p className="xmas-kicker">Christmas</p>
        <h2 id="christmas-faq-title">{t("faq.h2")}</h2>
        {LANDING_FAQS.map((item) => (
          <details key={item.qKey}>
            <summary>{t(item.qKey)}</summary>
            <p>{t(item.aKey)}</p>
          </details>
        ))}
        <nav className="xmas-links" aria-label="Christmas experiences">
          {LANDING_INTERNAL_LINKS.map((link) => (
            <Link key={link.href} to={link.href}>
              {t(link.labelKey)}
            </Link>
          ))}
        </nav>
      </div>
    </section>
  );
}
