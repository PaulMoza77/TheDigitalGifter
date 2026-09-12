import { useState } from "react";
import { LANDING_ASSETS } from "../assets";
import { landingT, type ChristmasLandingLocale } from "../copy";
import { CARD_THEMES, type CardTheme } from "../handoff";
import { SceneShell } from "../SceneShell";

const LABELS: Record<CardTheme, string> = {
  elegant: "cards.elegant",
  family: "cards.family",
  romantic: "cards.romantic",
  funny: "cards.funny",
};

const INSIDE: Record<CardTheme, { kicker: string; line: string }> = {
  elegant: { kicker: "Elegant", line: "With gold light and quiet joy — Merry Christmas." },
  family: { kicker: "Family", line: "The table is full. So is the heart. Merry Christmas." },
  romantic: { kicker: "Romantic", line: "All I want this Christmas is closer to you." },
  funny: { kicker: "Funny", line: "We checked the list twice. You’re still on it." },
};

const COVERS: Record<CardTheme, string> = {
  elegant: LANDING_ASSETS.cardCoverElegant,
  family: LANDING_ASSETS.cardCoverFamily,
  romantic: LANDING_ASSETS.cardCoverRomantic,
  funny: LANDING_ASSETS.cardCoverFunny,
};

export function CardsScene({
  locale,
  onCta,
}: {
  locale: ChristmasLandingLocale;
  onCta: (theme: CardTheme) => void;
}) {
  const t = (key: string) => landingT(key, locale);
  const [theme, setTheme] = useState<CardTheme>("elegant");
  const [open, setOpen] = useState(false);
  const inside = INSIDE[theme];

  function pickTheme(next: CardTheme) {
    setTheme(next);
    setOpen(false);
  }

  return (
    <SceneShell
      id="cards"
      className="xmas-cards-scene"
      kicker={t("cards.kicker")}
      title={t("cards.h2")}
      lede={t("cards.lede")}
      visual={
        <div className={`xmas-card-desk xmas-card-desk--${theme}`}>
          <div className="xmas-card-desk__glow" aria-hidden="true" />
          <span className="xmas-card-spark xmas-card-spark--a" aria-hidden="true" />
          <span className="xmas-card-spark xmas-card-spark--b" aria-hidden="true" />
          <span className="xmas-card-spark xmas-card-spark--c" aria-hidden="true" />
          <div className="xmas-card-stack" aria-hidden="true">
            <span />
            <span />
          </div>
          <button
            type="button"
            className={`xmas-card-flip ${open ? "is-open" : ""}`}
            aria-expanded={open}
            aria-label={open ? inside.line : t("cards.hint")}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="xmas-card-flip__inner">
              <span className="xmas-card-face xmas-card-face--front">
                <picture key={theme}>
                  <source type="image/webp" srcSet={COVERS[theme]} />
                  <img
                    src={COVERS[theme].replace(".webp", ".jpg")}
                    alt=""
                    width={720}
                    height={960}
                  />
                </picture>
                <span className="xmas-card-shine" aria-hidden="true" />
                <span className="xmas-card-seal" aria-hidden="true" />
              </span>
              <span className="xmas-card-face xmas-card-face--back">
                <span className="xmas-card-inside">
                  <span className="xmas-card-inside__kicker">{inside.kicker}</span>
                  <span className="xmas-card-inside__line">{inside.line}</span>
                  <span className="xmas-card-inside__mark" aria-hidden="true">
                    The Digital Gifter
                  </span>
                </span>
              </span>
            </span>
          </button>
          <p className="xmas-card-hint">{t("cards.hint")}</p>
        </div>
      }
    >
      <div className="xmas-tags" role="group" aria-label={t("cards.h2")}>
        {CARD_THEMES.map((key) => (
          <button
            key={key}
            type="button"
            className="xmas-tag"
            aria-pressed={theme === key}
            onClick={() => pickTheme(key)}
          >
            {t(LABELS[key])}
          </button>
        ))}
      </div>
      <div className="xmas-actions">
        <button type="button" className="xmas-btn xmas-btn--gold" onClick={() => onCta(theme)}>
          {t("cards.cta")}
        </button>
      </div>
    </SceneShell>
  );
}
