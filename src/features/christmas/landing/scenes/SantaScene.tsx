import { useEffect, useMemo, useState, type FormEvent } from "react";
import { landingT, type ChristmasLandingLocale } from "../copy";
import { isLikelyKidName, sanitizeKidName } from "../handoff";
import { SantaPresence } from "../SantaPresence";
import { SceneShell } from "../SceneShell";
import { useInViewOnce } from "../useInViewOnce";

function formatName(template: string, name: string): string {
  return template.replace(/\{name\}/g, name);
}

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
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [focused, setFocused] = useState(false);

  const placeholders = useMemo(
    () =>
      t("santa.placeholders")
        .split("|")
        .map((s) => s.trim())
        .filter(Boolean),
    // locale drives copy; landingT is stable for a given locale
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale],
  );

  const trimmed = sanitizeKidName(name);
  const personalized = isLikelyKidName(trimmed);

  useEffect(() => {
    if (inView) onViewed();
  }, [inView, onViewed]);

  useEffect(() => {
    if (focused || personalized || placeholders.length < 2) return;
    const id = window.setInterval(() => {
      setPlaceholderIndex((i) => (i + 1) % placeholders.length);
    }, 2800);
    return () => window.clearInterval(id);
  }, [focused, personalized, placeholders.length]);

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

  const title = personalized ? formatName(t("santa.h2Personalized"), trimmed) : t("santa.h2");
  const cta = personalized ? formatName(t("santa.ctaPersonalized"), trimmed) : t("santa.cta");
  const bubble = personalized
    ? formatName(t("santa.bubblePersonalized"), trimmed)
    : t("santa.bubble");
  const placeholder = placeholders[placeholderIndex] || t("santa.placeholder");

  return (
    <div ref={ref}>
      <SceneShell
        id="santa"
        className="xmas-santa-scene"
        kicker={t("santa.kicker")}
        title={title}
        lede={t("santa.lede")}
        visual={
          <div className="xmas-santa">
            <p className="xmas-bubble" role="status" aria-live="polite">
              {bubble}
            </p>
            <SantaPresence alt={t("santa.alt")} acknowledge={personalized} />
          </div>
        }
      >
        <form onSubmit={handleSubmit} noValidate>
          <label className="xmas-field" htmlFor="christmas-santa-kid-name">
            <span>{t("santa.label")}</span>
            <input
              id="christmas-santa-kid-name"
              name="kidName"
              autoComplete="off"
              spellCheck={false}
              maxLength={40}
              placeholder={placeholder}
              value={name}
              aria-invalid={error ? true : undefined}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
                if (!started && e.target.value.trim()) {
                  setStarted(true);
                  onInputStarted();
                }
              }}
            />
          </label>
          {error ? (
            <p className="xmas-error" role="alert">
              {error}
            </p>
          ) : (
            <p className="xmas-hint">{t("santa.reassurance")}</p>
          )}
          <div className="xmas-actions">
            <button type="submit" className="xmas-btn xmas-btn--gold">
              {cta}
            </button>
          </div>
        </form>
      </SceneShell>
    </div>
  );
}
