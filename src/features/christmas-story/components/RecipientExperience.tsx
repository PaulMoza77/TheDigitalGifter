import { useEffect, useMemo, useState } from "react";
import type { StoryGiftContent } from "../types";
import { ExampleAudioPlayer } from "./ExampleAudioPlayer";

type Step =
  | "welcome"
  | "unwrap"
  | "from"
  | "dedication"
  | "story"
  | "song"
  | "film"
  | "surprise"
  | "final"
  | "keepsakes";

type Props = {
  content: StoryGiftContent;
  isDemo?: boolean;
  onOpened?: () => void;
  onDemoPlay?: () => void;
  onReaction?: (text: string) => void;
  giftUrl?: string;
};

const STEPS: Step[] = [
  "welcome",
  "unwrap",
  "from",
  "dedication",
  "story",
  "song",
  "film",
  "surprise",
  "final",
  "keepsakes",
];

export function RecipientExperience({
  content,
  isDemo,
  onOpened,
  onDemoPlay,
  onReaction,
  giftUrl,
}: Props) {
  const [step, setStep] = useState<Step>("welcome");
  const [filmIdx, setFilmIdx] = useState(0);
  const [surpriseOpen, setSurpriseOpen] = useState(false);
  const [reaction, setReaction] = useState("");
  const [openedLogged, setOpenedLogged] = useState(false);
  const reduceMotion = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  useEffect(() => {
    if (step === "film") {
      if (reduceMotion) return;
      const id = window.setInterval(() => {
        setFilmIdx((i) => (i + 1) % Math.max(1, content.film.frames.length));
      }, 3200);
      return () => window.clearInterval(id);
    }
  }, [step, content.film.frames.length, reduceMotion]);

  function next() {
    const i = STEPS.indexOf(step);
    const n = STEPS[Math.min(i + 1, STEPS.length - 1)];
    if (n === "from" && !openedLogged) {
      setOpenedLogged(true);
      onOpened?.();
    }
    setStep(n);
  }

  const frame = content.film.frames[filmIdx] ?? content.film.frames[0];

  return (
    <div className="cs-gift">
      <div className="cs-gift__stage">
        {isDemo ? (
          <p className="cs-preview-banner" role="note">
            Sample experience · fictional demo data · not a real customer gift
          </p>
        ) : null}

        {step === "welcome" ? (
          <>
            <p className="cs-kicker">A private Christmas gift</p>
            <h1>{content.welcomeTitle}</h1>
            <p>Something was made only for you. Take your time.</p>
            <button type="button" className="cs-btn cs-btn--primary" onClick={next}>
              Continue
            </button>
          </>
        ) : null}

        {step === "unwrap" ? (
          <>
            <button
              type="button"
              className="cs-envelope"
              onClick={next}
              aria-label="Tap to unwrap the gift"
            >
              <span>Tap to unwrap</span>
            </button>
            <p>No account needed. This page stays private.</p>
          </>
        ) : null}

        {step === "from" ? (
          <>
            <p className="cs-kicker">From</p>
            <h1>{content.fromName}</h1>
            <p>They wanted you to feel this — not just read it.</p>
            <button type="button" className="cs-btn cs-btn--primary" onClick={next}>
              Read the dedication
            </button>
          </>
        ) : null}

        {step === "dedication" ? (
          <>
            <p className="cs-kicker">Dedication</p>
            <h1 className="cs-display" style={{ fontSize: "1.85rem" }}>
              {content.dedication}
            </h1>
            <button type="button" className="cs-btn cs-btn--primary" onClick={next}>
              Continue the story
            </button>
          </>
        ) : null}

        {step === "story" ? (
          <>
            <p className="cs-kicker">Your story</p>
            {content.storyParagraphs.map((p) => (
              <p key={p.slice(0, 24)}>{p}</p>
            ))}
            <button type="button" className="cs-btn cs-btn--primary" onClick={next}>
              Reveal the song
            </button>
          </>
        ) : null}

        {step === "song" ? (
          <>
            <p className="cs-kicker">The song</p>
            <ExampleAudioPlayer song={content.song} onPlay={onDemoPlay} />
            <button type="button" className="cs-btn cs-btn--ghost" onClick={next}>
              Watch the memory film
            </button>
          </>
        ) : null}

        {step === "film" ? (
          <>
            <p className="cs-kicker">{content.film.title}</p>
            <div className="cs-film" aria-live="polite">
              {frame?.src ? (
                <img className="cs-film__img" src={frame.src} alt="" />
              ) : (
                <p className="cs-film__frame">{frame?.caption}</p>
              )}
            </div>
            {frame?.src && frame.caption ? <p>{frame.caption}</p> : null}
            {content.film.isExample ? (
              <p className="cs-preview-banner">Example memory sequence</p>
            ) : null}
            <button type="button" className="cs-btn cs-btn--primary" onClick={next}>
              One more surprise
            </button>
          </>
        ) : null}

        {step === "surprise" ? (
          <>
            <p className="cs-kicker">A quiet surprise</p>
            <button
              type="button"
              className={`cs-scratch ${surpriseOpen ? "is-open" : ""}`}
              onClick={() => setSurpriseOpen(true)}
            >
              {surpriseOpen ? content.surpriseReveal : content.surpriseLabel}
            </button>
            <button
              type="button"
              className="cs-btn cs-btn--primary"
              onClick={next}
              disabled={!surpriseOpen}
            >
              Final message
            </button>
          </>
        ) : null}

        {step === "final" ? (
          <>
            <p className="cs-kicker">With love</p>
            <h1 style={{ fontSize: "1.9rem" }}>{content.finalMessage}</h1>
            <button type="button" className="cs-btn cs-btn--primary" onClick={next}>
              Keepsakes
            </button>
          </>
        ) : null}

        {step === "keepsakes" ? (
          <>
            <p className="cs-kicker">Keepsakes</p>
            <p>
              In a completed gift you can download the song, film, and printable card. This{" "}
              {isDemo ? "demo" : "preview"} shows the ritual end-to-end.
            </p>
            {giftUrl ? (
              <p style={{ fontSize: "0.85rem", wordBreak: "break-all" }}>{giftUrl}</p>
            ) : null}
            <label className="cs-field" style={{ textAlign: "left" }}>
              <span>Optional reaction</span>
              <textarea
                value={reaction}
                onChange={(e) => setReaction(e.target.value)}
                placeholder="A few words for the person who sent this…"
                maxLength={280}
              />
            </label>
            <button
              type="button"
              className="cs-btn cs-btn--ghost"
              onClick={() => onReaction?.(reaction.trim())}
              disabled={!reaction.trim()}
            >
              Send reaction
            </button>
            <p style={{ fontSize: "0.85rem", opacity: 0.75, marginTop: "1rem" }}>
              Loved this?{" "}
              <a href="/christmas-story" style={{ color: "var(--cs-gold-bright)" }}>
                Create a gift for someone special
              </a>
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
}
