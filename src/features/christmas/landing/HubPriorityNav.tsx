import { landingT, type ChristmasLandingLocale } from "./copy";
import { hubSuiteByPriority } from "./hubIa";

export function HubPriorityNav({
  locale,
  onJump,
}: {
  locale: ChristmasLandingLocale;
  onJump: (sceneId: string) => void;
}) {
  const t = (key: string) => landingT(key, locale);
  const items = hubSuiteByPriority();

  return (
    <nav className="xmas-rail" id="christmas-suite" aria-label={t("nav.suite")}>
      <p className="xmas-rail__kicker">{t("nav.priority")}</p>
      <div className="xmas-rail__scroller">
        {items.map((item) => (
          <a
            key={item.key}
            className="xmas-rail__chip"
            href={`#${item.sceneId}`}
            onClick={(event) => {
              event.preventDefault();
              onJump(item.sceneId);
            }}
          >
            {t(item.navKey)}
          </a>
        ))}
      </div>
    </nav>
  );
}
