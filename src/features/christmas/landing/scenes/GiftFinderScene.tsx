import { useMemo, useState } from "react";
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

  const visual = useMemo(
    () => (
      <div className="xmas-gifts" aria-hidden="true">
        <div className="xmas-gifts__tree" />
        <div className="xmas-gifts__trunk" />
        {GIFT_FINDER_LANDING_RECIPIENTS.slice(0, 3).map((key) => (
          <div key={key} className={`xmas-gift ${who === key ? "is-lit" : ""}`} />
        ))}
        {who ? <div className="xmas-label">{t(LABELS[who])}</div> : null}
      </div>
    ),
    [who, locale],
  );

  return (
    <SceneShell
      id="gift-finder"
      kicker={t("finder.kicker")}
      title={t("finder.h2")}
      lede={t("finder.lede")}
      visual={visual}
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
            onClick={() => {
              setWho(key);
              onSelect(key);
            }}
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
