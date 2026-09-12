import { useMemo, useState } from "react";
import { adventDayParts } from "../../tree/treeLogic";
import { LANDING_ASSETS } from "../assets";
import { landingT, type ChristmasLandingLocale } from "../copy";
import { SceneShell } from "../SceneShell";

export function AdventScene({
  locale,
  onInteract,
  onCta,
}: {
  locale: ChristmasLandingLocale;
  onInteract: (day: number) => void;
  onCta: () => void;
}) {
  const t = (key: string) => landingT(key, locale);
  const parts = useMemo(() => adventDayParts(new Date(), 2026), []);
  const today = parts.eligibleDay ?? 1;
  const [open, setOpen] = useState<number | null>(null);

  return (
    <SceneShell
      id="advent"
      kicker={t("advent.kicker")}
      title={t("advent.h2")}
      lede={t("advent.lede")}
      reverse
      visual={
        <div className="xmas-advent">
          <figure className="xmas-photo">
            <img src={LANDING_ASSETS.advent} alt={t("advent.alt")} width={1280} height={720} loading="lazy" />
          </figure>
          <div className="xmas-advent-grid" role="list">
            {Array.from({ length: 24 }, (_, i) => i + 1).map((day) => (
              <button
                key={day}
                type="button"
                className={`xmas-door ${day === today ? "is-today" : ""} ${open === day ? "is-open" : ""}`}
                aria-label={`${t("advent.today")} ${day}`}
                onClick={() => {
                  setOpen(day);
                  onInteract(day);
                }}
              >
                {day}
              </button>
            ))}
          </div>
        </div>
      }
    >
      <div className="xmas-actions">
        <button type="button" className="xmas-btn xmas-btn--gold" onClick={onCta}>
          {t("advent.cta")}
        </button>
      </div>
    </SceneShell>
  );
}
