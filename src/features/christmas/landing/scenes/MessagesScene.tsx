import { useEffect, useState } from "react";
import { LANDING_ASSETS } from "../assets";
import { landingT, type ChristmasLandingLocale } from "../copy";
import { MESSAGE_RECIPIENTS, MESSAGE_TONES } from "../handoff";
import { SceneShell } from "../SceneShell";
import { usePrefersReducedMotion } from "../usePrefersReducedMotion";

const RECIPIENT_KEYS: Record<(typeof MESSAGE_RECIPIENTS)[number], string> = {
  mom: "gifts.mom",
  dad: "gifts.dad",
  partner: "gifts.partner",
  friend: "gifts.friend",
};

const TONE_KEYS: Record<(typeof MESSAGE_TONES)[number], string> = {
  heartfelt: "messages.heartfelt",
  funny: "messages.funny",
  warm: "messages.warm",
};

const LINES: Record<string, string> = {
  "mom:heartfelt": "Thank you for the quiet ways you make this house feel like Christmas.",
  "mom:funny": "You still hide the good chocolate. We still love you anyway.",
  "mom:warm": "May your Christmas be as warm as the kitchen on the morning it snows.",
  "dad:heartfelt": "For the lights you always put up, and the love you never announce.",
  "dad:funny": "The tree is crooked. The love is not. Merry Christmas, Dad.",
  "dad:warm": "Wishing you a fire, a story, and a Christmas that finally slows down.",
  "partner:heartfelt": "All the quiet of winter, and you — that’s the gift.",
  "partner:funny": "I wrapped this message myself. Please clap.",
  "partner:warm": "Come closer. The year was long. Christmas is ours.",
  "friend:heartfelt": "Some friends are family we were lucky enough to find.",
  "friend:funny": "If we’re on the nice list, it’s because we were sneaky.",
  "friend:warm": "A cup of something warm, and the wish that we get more years like this.",
};

export function MessagesScene({
  locale,
  onCta,
}: {
  locale: ChristmasLandingLocale;
  onCta: (recipient: string, tone: string) => void;
}) {
  const t = (key: string) => landingT(key, locale);
  const reduced = usePrefersReducedMotion();
  const [who, setWho] = useState<(typeof MESSAGE_RECIPIENTS)[number]>("mom");
  const [tone, setTone] = useState<(typeof MESSAGE_TONES)[number]>("heartfelt");
  const full = LINES[`${who}:${tone}`] || LINES["mom:heartfelt"];
  const [typed, setTyped] = useState(reduced ? full : "");

  useEffect(() => {
    if (reduced) {
      setTyped(full);
      return;
    }
    setTyped("");
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setTyped(full.slice(0, i));
      if (i >= full.length) window.clearInterval(id);
    }, 28);
    return () => window.clearInterval(id);
  }, [full, reduced]);

  return (
    <SceneShell
      id="messages"
      className="xmas-messages-scene"
      kicker={t("messages.kicker")}
      title={t("messages.h2")}
      lede={t("messages.lede")}
      reverse
      visual={
        <div className={`xmas-message-letter xmas-message-letter--${tone}`}>
          <picture>
            <source type="image/webp" srcSet={LANDING_ASSETS.messageLetter} />
            <img
              src={LANDING_ASSETS.messageLetterJpg}
              alt={t("messages.alt")}
              width={880}
              height={1173}
            />
          </picture>
          <div className="xmas-message-ink">
            <p className="xmas-message-ink__to">
              {t("messages.for")} {t(RECIPIENT_KEYS[who])}
            </p>
            <p className="xmas-type" aria-live="polite">
              {typed}
              {reduced ? null : <span className="xmas-message-caret" aria-hidden="true" />}
            </p>
          </div>
        </div>
      }
    >
      <p className="xmas-kicker" style={{ marginTop: "1.1rem" }}>
        {t("messages.for")}
      </p>
      <div className="xmas-tags" role="group" aria-label={t("messages.for")}>
        {MESSAGE_RECIPIENTS.map((key) => (
          <button
            key={key}
            type="button"
            className="xmas-tag"
            aria-pressed={who === key}
            onClick={() => setWho(key)}
          >
            {t(RECIPIENT_KEYS[key])}
          </button>
        ))}
      </div>
      <p className="xmas-kicker" style={{ marginTop: "1rem" }}>
        {t("messages.tone")}
      </p>
      <div className="xmas-tags" role="group" aria-label={t("messages.tone")}>
        {MESSAGE_TONES.map((key) => (
          <button
            key={key}
            type="button"
            className="xmas-tag"
            aria-pressed={tone === key}
            onClick={() => setTone(key)}
          >
            {t(TONE_KEYS[key])}
          </button>
        ))}
      </div>
      <div className="xmas-actions">
        <button type="button" className="xmas-btn xmas-btn--gold" onClick={() => onCta(who, tone)}>
          {t("messages.cta")}
        </button>
      </div>
    </SceneShell>
  );
}
