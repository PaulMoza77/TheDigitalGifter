import { useState } from "react";
import { LANDING_ASSETS } from "../assets";
import { landingT, type ChristmasLandingLocale } from "../copy";
import { type PortraitVertical, PORTRAIT_VERTICALS } from "../handoff";
import { SceneShell } from "../SceneShell";
import { useInViewOnce } from "../useInViewOnce";

const LABELS: Record<PortraitVertical, string> = {
  family: "portraits.family",
  couples: "portraits.couples",
  pets: "portraits.pets",
};

const IMAGES: Record<PortraitVertical, { src: string; altKey: string }> = {
  family: { src: LANDING_ASSETS.portraitFamily, altKey: "portraits.alt.family" },
  couples: { src: LANDING_ASSETS.portraitCouple, altKey: "portraits.alt.couples" },
  pets: { src: LANDING_ASSETS.portraitPet, altKey: "portraits.alt.pets" },
};

export function PortraitScene({
  locale,
  onToggle,
  onCta,
}: {
  locale: ChristmasLandingLocale;
  onToggle: (vertical: PortraitVertical) => void;
  onCta: (vertical: PortraitVertical) => void;
}) {
  const t = (key: string) => landingT(key, locale);
  const [vertical, setVertical] = useState<PortraitVertical>("family");
  const { ref, inView } = useInViewOnce<HTMLDivElement>();
  const current = IMAGES[vertical];

  return (
    <SceneShell
      id="portraits"
      kicker={t("portraits.kicker")}
      title={t("portraits.h2")}
      lede={t("portraits.lede")}
      reverse
      visual={
        <div className="xmas-frame-wrap" ref={ref}>
          <figure className="xmas-frame">
            <div className={`xmas-frame__photo ${inView ? "is-magic" : ""}`}>
              <img
                className="is-back"
                src={LANDING_ASSETS.portraitFamilyBefore}
                alt={t("portraits.alt.before")}
              />
              <img src={current.src} alt={t(current.altKey)} />
            </div>
          </figure>
        </div>
      }
    >
      <div className="xmas-tags" role="tablist" aria-label={t("portraits.h2")}>
        {PORTRAIT_VERTICALS.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            className="xmas-tag"
            aria-selected={vertical === key}
            onClick={() => {
              setVertical(key);
              onToggle(key);
            }}
          >
            {t(LABELS[key])}
          </button>
        ))}
      </div>
      <div className="xmas-actions">
        <button type="button" className="xmas-btn xmas-btn--gold" onClick={() => onCta(vertical)}>
          {t("portraits.cta")}
        </button>
      </div>
    </SceneShell>
  );
}
