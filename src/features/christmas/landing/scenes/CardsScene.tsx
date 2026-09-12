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

const INSIDE: Record<CardTheme, string> = {
  elegant: "With gold light and quiet joy — Merry Christmas.",
  family: "The table is full. So is the heart. Merry Christmas.",
  romantic: "All I want this Christmas is closer to you.",
  funny: "We checked the list twice. You’re still on it.",
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
  const [open, setOpen] = useState(true);

  return (
    <SceneShell
      id="cards"
      kicker={t("cards.kicker")}
      title={t("cards.h2")}
      lede={t("cards.lede")}
      visual={
        <div className={`xmas-card-flip ${open ? "is-open" : ""}`}>
          <button
            type="button"
            className="xmas-card-flip__inner"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            style={{ width: "100%", border: 0, padding: 0, background: "transparent", cursor: "pointer" }}
          >
            <div className="xmas-card-face">
              <img src={LANDING_ASSETS.card} alt={t("cards.alt")} width={1152} height={864} loading="lazy" />
            </div>
            <div className="xmas-card-face xmas-card-face--back">{INSIDE[theme]}</div>
          </button>
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
            onClick={() => {
              setTheme(key);
              setOpen(true);
            }}
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
