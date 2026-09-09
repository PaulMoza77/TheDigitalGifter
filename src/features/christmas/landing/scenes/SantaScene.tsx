import { useEffect, useState, type FormEvent } from "react";
import { landingT, type ChristmasLandingLocale } from "../copy";
import { isLikelyKidName, sanitizeKidName } from "../handoff";
import { SantaPresence } from "../SantaPresence";
import { SceneShell } from "../SceneShell";
import { useInViewOnce } from "../useInViewOnce";

export function SantaScene({
  locale,
  onViewed,
  onInputStarted,
  onSubmit,
}: {
  locale: ChristmasLandingLocale;
  onViewed: () => void;
  onInputStarted: () => void;
  onSubmit: (name: string) => void;
}) {
  const t = (key: string) => landingT(key, locale);
  const { ref, inView } = useInViewOnce<HTMLDivElement>();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (inView) onViewed();
  }, [inView, onViewed]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const next = sanitizeKidName(name);
    if (!isLikelyKidName(next)) {
      setError(t("santa.error"));
      return;
    }
    setError(null);
    onSubmit(next);
  }

  return (
    <div ref={ref}>
      <SceneShell
        id="santa"
        className="xmas-santa-scene"
        kicker={t("santa.kicker")}
        title={t("santa.h2")}
        lede={t("santa.lede")}
        visual={
          <div className="xmas-santa">
            <p className="xmas-bubble" aria-hidden="true">
              {t("santa.bubble")}
            </p>
            <SantaPresence alt={t("santa.alt")} />
          </div>
        }
      >
        <form onSubmit={handleSubmit}>
          <label className="xmas-field">
            <span>{t("santa.label")}</span>
            <input
              name="kidName"
              autoComplete="off"
              maxLength={40}
              placeholder={t("santa.placeholder")}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!started && e.target.value.trim()) {
                  setStarted(true);
                  onInputStarted();
                }
              }}
            />
          </label>
          {error ? <p className="xmas-error">{error}</p> : null}
          <div className="xmas-actions">
            <button type="submit" className="xmas-btn xmas-btn--gold">
              {t("santa.cta")}
            </button>
          </div>
        </form>
      </SceneShell>
    </div>
  );
}
