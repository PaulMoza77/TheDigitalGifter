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
  const openedOnce = useRef(false);
  const storyHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (opened) storyHeading.current?.focus();
  }, [opened]);

  function openGift() {
    if (openedOnce.current) return;
    openedOnce.current = true;
    setOpened(true);
    onOpened?.();
  }

  return (
    <main className={`cs-gift ${opened ? "cs-gift--opened" : ""}`}>
      {isDemo ? <p className="cs-preview-banner cs-gift__sample" role="note">Fictional sample gift · Media previews only</p> : null}
      {!opened ? (
        <div className="cs-gift__welcome">
          <p className="cs-kicker">A Christmas gift, just for you</p>
          <h1>{content.welcomeTitle}</h1>
          <p className="cs-gift__intro">Some things are too special for an ordinary message.</p>
          <button type="button" className="cs-envelope" onClick={openGift} aria-label="Open your gift">
            <span className="cs-envelope__fold" aria-hidden="true" />
            <span className="cs-seal" aria-hidden="true">{content.fromName.slice(0, 1)}</span>
            <span className="cs-envelope__label">Open your gift <span aria-hidden="true">↗</span></span>
          </button>
          <p className="cs-gift__signature">With love, <span>{content.fromName}</span></p>
          <p className="cs-microcopy">Take your time. Nothing plays until you choose.</p>
        </div>
      ) : (
        <article className="cs-gift__story">
          <header className="cs-gift__chapter cs-dedication">
            <p className="cs-kicker">From {content.fromName}, with love</p>
            <h1 ref={storyHeading} tabIndex={-1}>{content.welcomeTitle}</h1>
            <blockquote>{content.dedication}</blockquote>
            <span className="cs-ornament" aria-hidden="true">✧</span>
            <nav className="cs-chapter-nav" aria-label="Your gift"><a href="#gift-memories">Memories</a><a href="#gift-song">Song</a><a href="#gift-film">Film</a><a href="#gift-surprise">Surprise</a></nav>
          </header>
          <section className="cs-gift__chapter" id="gift-memories" aria-labelledby="gift-memories-title"><p className="cs-kicker">The moments that matter</p><h2 id="gift-memories-title">A story only we could tell.</h2><div className="cs-story-prose">{content.storyParagraphs.map((p, i) => <p key={i}>{p}</p>)}</div></section>
          <section className="cs-gift__chapter" id="gift-song" aria-labelledby="gift-song-title"><p className="cs-kicker">For the things words can’t quite say</p><h2 id="gift-song-title">This one is for you.</h2><ExampleAudioPlayer song={content.song} onPlay={onDemoPlay} /></section>
          <section className="cs-gift__chapter" id="gift-film" aria-labelledby="gift-film-title"><p className="cs-kicker">Little moments. Everything.</p><h2 id="gift-film-title">{content.film.title}</h2><MemoryFilm film={content.film} /></section>
          <section className="cs-gift__chapter" id="gift-surprise" aria-labelledby="gift-surprise-title"><p className="cs-kicker">One more thing</p><h2 id="gift-surprise-title">A secret to keep.</h2><details className="cs-surprise"><summary><span className="cs-seal" aria-hidden="true">✧</span><span>{content.surpriseLabel}</span><span className="cs-microcopy">Open your hidden message</span></summary><p>{content.surpriseReveal}</p></details></section>
          <footer className="cs-gift__chapter cs-gift__closing"><span className="cs-ornament" aria-hidden="true">✧</span><p className="cs-kicker">Always, with love</p><h2>{content.finalMessage}</h2><p className="cs-gift__signature">{content.fromName}</p><a className="cs-text-link" href="#gift-memories">Return to your memories ↑</a></footer>
        </article>
      )}
    </main>
  );
}
