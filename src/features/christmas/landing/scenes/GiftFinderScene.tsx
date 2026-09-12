import { useState, type CSSProperties } from "react";
import { LANDING_ASSETS } from "../assets";
import { landingT, type ChristmasLandingLocale } from "../copy";
import {
  type GiftFinderRecipient,
  GIFT_FINDER_LANDING_RECIPIENTS,
} from "../handoff";
import { SceneShell } from "../SceneShell";

const LABELS: Record<(typeof GIFT_FINDER_LANDING_RECIPIENTS)[number], string> = {
  mom: "gifts.mom",
  dad: "gifts.dad",
  partner: "gifts.partner",
  friend: "gifts.friend",
  child: "gifts.kids",
};

const REACTIONS: Record<(typeof GIFT_FINDER_LANDING_RECIPIENTS)[number], string> = {
  mom: "gifts.react.mom",
  dad: "gifts.react.dad",
  partner: "gifts.react.partner",
  friend: "gifts.react.friend",
  child: "gifts.react.kids",
};

/** Soft gift-tag positions over the still-life (percent of stage). */
const TAG_STYLE: Record<(typeof GIFT_FINDER_LANDING_RECIPIENTS)[number], CSSProperties> = {
  mom: { left: "14%", top: "62%" },
  dad: { left: "38%", top: "70%" },
  partner: { left: "58%", top: "58%" },
  friend: { left: "72%", top: "74%" },
  child: { left: "48%", top: "42%" },
};

export function GiftFinderScene({
  locale,
  onSelect,
  onCta,
}: {
  locale: ChristmasLandingLocale;
  onSelect: (recipient: GiftFinderRecipient) => void;
  onCta: (recipient: GiftFinderRecipient) => void;
}) {
  const t = (key: string) => landingT(key, locale);
  const [who, setWho] = useState<(typeof GIFT_FINDER_LANDING_RECIPIENTS)[number] | null>(null);

  function pick(next: (typeof GIFT_FINDER_LANDING_RECIPIENTS)[number]) {
    setWho(next);
    onSelect(next);
  }

  return (
    <SceneShell
      id="gift-finder"
      className="xmas-finder-scene"
      kicker={t("finder.kicker")}
      title={t("finder.h2")}
      lede={t("finder.lede")}
      visual={
        <div className={`xmas-finder-stage${who ? ` is-picked is-picked--${who}` : ""}`}>
          <div className="xmas-finder-stage__glow" aria-hidden="true" />
          <picture className="xmas-finder-stage__photo">
            <source type="image/webp" srcSet={LANDING_ASSETS.giftFinderStill} />
            <img
              src={LANDING_ASSETS.giftFinderStillJpg}
              alt={t("finder.alt")}
              width={1152}
              height={864}
              loading="lazy"
              decoding="async"
            />
          </picture>
          <div className="xmas-finder-stage__shade" aria-hidden="true" />
          <div className="xmas-finder-tags" role="group" aria-label={t("finder.h2")}>
            {GIFT_FINDER_LANDING_RECIPIENTS.map((key) => (
              <button
                key={key}
                type="button"
                className={`xmas-finder-tag${who === key ? " is-active" : ""}`}
                style={TAG_STYLE[key]}
                aria-pressed={who === key}
                onClick={() => pick(key)}
              >
                <span className="xmas-finder-tag__dot" aria-hidden="true" />
                {t(LABELS[key])}
              </button>
            ))}
          </div>
          <p className="xmas-finder-stage__hint">{t("finder.visualHint")}</p>
        </div>
      }
    >
      <p className="xmas-lede" style={{ marginTop: "0.8rem" }}>
        {t("finder.hint")}
      </p>
      <div className="xmas-tags" role="group" aria-label={t("finder.h2")}>
        {GIFT_FINDER_LANDING_RECIPIENTS.map((key) => (
          <button
            key={key}
            type="button"
            className="xmas-tag"
            aria-pressed={who === key}
            onClick={() => pick(key)}
          >
            {t(LABELS[key])}
          </button>
        ))}
      </div>
      <p className="xmas-react" aria-live="polite">
        {who ? t(REACTIONS[who]) : "\u00a0"}
      </p>
      <div className="xmas-actions">
        <button
          type="button"
          className="xmas-btn xmas-btn--gold"
          onClick={() => onCta(who || "mom")}
        >
          {t("finder.cta")}
        </button>
      </div>
    </SceneShell>
  );
}
