import { useEffect, useRef, useState } from "react";
import type { StoryGiftContent } from "../types";
import { ExampleAudioPlayer } from "./ExampleAudioPlayer";
import { MemoryFilm } from "./MemoryFilm";

type Props = {
  content: StoryGiftContent;
  isDemo?: boolean;
  onOpened?: () => void;
  onDemoPlay?: () => void;
  onReaction?: (text: string) => void;
  giftUrl?: string;
};

export function RecipientExperience({ content, isDemo, onOpened, onDemoPlay }: Props) {
  const [opened, setOpened] = useState(false);
  const [photoIndex, setPhotoIndex] = useState<number | null>(null);
  const openedOnce = useRef(false);
  const storyHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (opened) storyHeading.current?.focus();
  }, [opened]);

  useEffect(() => {
    if (photoIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPhotoIndex(null);
      if (e.key === "ArrowRight") setPhotoIndex((n) => n === null ? null : (n + 1) % content.film.frames.length);
      if (e.key === "ArrowLeft") setPhotoIndex((n) => n === null ? null : (n - 1 + content.film.frames.length) % content.film.frames.length);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [photoIndex, content.film.frames.length]);

  function openGift() {
    if (openedOnce.current) return;
    openedOnce.current = true;
    setOpened(true);
    onOpened?.();
  }

  return (
    <main className={`cs-gift ${opened ? "cs-gift--opened" : ""}`}>
      {isDemo ? (
        <p className="cs-preview-banner cs-gift__sample" role="note">
          Fictional Christmas sample · Illustrative photos and sample film · Personalized vocal song is not yet available
        </p>
      ) : null}
      {!opened ? (
        <div className="cs-gift__welcome">
          <div className="cs-v2-snow" aria-hidden="true">✦ ✧ ❄ ✧ ✦</div>
          <p className="cs-kicker">Someone made you a Christmas surprise</p>
          <div className="cs-v2-cover" role="img" aria-label="Festive Christmas lights and a warm memory"><img src={content.film.frames[0]?.src || "/assets/christmas-story-demo/emma-poster.jpg"} alt="Christmas memory, fictional example" /></div>
          <h1>{content.welcomeTitle}</h1>
          <p className="cs-gift__intro">A song. A little film. Your favorite memories. And a letter written only for you. All waiting inside.</p>
          <button type="button" className="cs-envelope" onClick={openGift} aria-label="Open your gift">
            <span className="cs-envelope__fold" aria-hidden="true" />
            <span className="cs-seal" aria-hidden="true">{content.fromName.slice(0, 1)}</span>
            <span className="cs-envelope__label">Unwrap my Christmas gift <span aria-hidden="true">↗</span></span>
          </button>
          <p className="cs-gift__signature">With love, <span>{content.fromName}</span></p>
          <p className="cs-microcopy">Take your time. Nothing plays until you choose.</p>
        </div>
      ) : (
        <article className="cs-gift__story">
          <header className="cs-gift__chapter cs-dedication cs-v2-dedication">
            <p className="cs-kicker">Merry Christmas · A gift from {content.fromName}</p>
            <img className="cs-v2-open-cover" src={content.film.frames[0]?.src || "/assets/christmas-story-demo/emma-poster.jpg"} alt="Festive illustrated memory" />
            <h1 ref={storyHeading} tabIndex={-1}>{content.welcomeTitle}</h1>
            <blockquote>{content.dedication}</blockquote>
            <nav className="cs-chapter-nav" aria-label="Your gift"><a href="#gift-film">Your film</a><a href="#gift-album">Your photos</a><a href="#gift-song">Your song</a><a href="#gift-surprise">Secret letter</a></nav>
          </header>
          <section className="cs-gift__chapter cs-v2-film" id="gift-film" aria-labelledby="gift-film-title">
            <p className="cs-kicker">01 / Watch the moments</p>
            <h2 id="gift-film-title">{content.film.title}</h2>
            <p>Press play to see these Christmas memories come alive. Nothing plays before you choose.</p>
            <MemoryFilm film={content.film} />
          </section>
          <section className="cs-gift__chapter cs-v2-album-section" id="gift-album" aria-labelledby="gift-album-title">
            <p className="cs-kicker">02 / Keep these close</p><h2 id="gift-album-title">A little album of us.</h2>
            <p>Tap any photo to open it. Every picture in a purchased gift comes from the person who made it.</p>
            <div className="cs-v2-album">
              {content.film.frames.map((frame, i) => <button className="cs-v2-album__tile" key={i} type="button" onClick={() => setPhotoIndex(i)} aria-label={`Open memory ${i + 1}: ${frame.caption || "Christmas memory"}`}>
                <img src={frame.src} alt={frame.caption || `Memory ${i + 1}`} loading="lazy" /><span>{frame.caption || `Memory ${i + 1}`}</span>
              </button>)}
            </div>
          </section>
          <section className="cs-gift__chapter cs-v2-song" id="gift-song" aria-labelledby="gift-song-title">
            <p className="cs-kicker">03 / Made to be heard</p><h2 id="gift-song-title">A song with your name in it.</h2>
            <p>{isDemo ? "In a finished gift, you will hear an original song. This fictional demo currently contains sample lyrics only; no vocal audio has been delivered." : "The words they wrote for you, set to music."}</p>
            <ExampleAudioPlayer song={content.song} onPlay={onDemoPlay} />
          </section>
          <section className="cs-gift__chapter cs-v2-letter" id="gift-surprise" aria-labelledby="gift-surprise-title">
            <p className="cs-kicker">04 / Just between you two</p><h2 id="gift-surprise-title">One last Christmas surprise.</h2>
            <details className="cs-surprise"><summary><span className="cs-seal" aria-hidden="true">✉</span><span>{content.surpriseLabel}</span><span className="cs-microcopy">Break the seal to read your private letter</span></summary><p>{content.surpriseReveal}</p></details>
          </section>
          {photoIndex !== null ? <div className="cs-v2-lightbox" role="dialog" aria-modal="true" aria-label="Photo album enlarged memory" onClick={() => setPhotoIndex(null)}>
            <div className="cs-v2-lightbox__inside" onClick={e => e.stopPropagation()}>
              <button type="button" className="cs-v2-lightbox__close" onClick={() => setPhotoIndex(null)} aria-label="Close photo">×</button>
              <img src={content.film.frames[photoIndex]?.src} alt={content.film.frames[photoIndex]?.caption || "Album memory"} />
              <p>{content.film.frames[photoIndex]?.caption}</p>
              <div className="cs-v2-lightbox__controls">
                <button type="button" onClick={() => setPhotoIndex((photoIndex - 1 + content.film.frames.length) % content.film.frames.length)}>← Previous</button>
                <span>{photoIndex + 1} / {content.film.frames.length}</span>
                <button type="button" onClick={() => setPhotoIndex((photoIndex + 1) % content.film.frames.length)}>Next →</button>
              </div>
            </div>
          </div> : null}
          <footer className="cs-gift__chapter cs-gift__closing"><span className="cs-ornament" aria-hidden="true">✧</span><p className="cs-kicker">Always, with love</p><h2>{content.finalMessage}</h2><p className="cs-gift__signature">{content.fromName}</p><a className="cs-text-link" href="#gift-memories">Return to your memories ↑</a></footer>
        </article>
      )}
    </main>
  );
}
