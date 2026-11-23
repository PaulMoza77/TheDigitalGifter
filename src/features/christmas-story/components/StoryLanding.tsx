import { useEffect, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { STORY_OFFER } from "../catalog";
import { trackStoryEvent } from "../analytics";
import type { CopyVariant } from "../types";

const FAQ = [
  ["What will they open?", "A personal story with a dedication, song, memory film and a hidden message. Explore the fictional sample to see how it feels. Sample audio and film are not finished custom media."],
  ["Do they need an account or an app?", "No. The gift opens in a browser on a phone or computer, without an account."],
  ["Can I review it first?", "Yes. The buyer review lets you check the dedication and media before approving the gift. In this preview, generation and approval are test-only."],
  ["Can I send a gift from this preview?", "This version saves test gifts in this browser only. Shared access on another device and scheduled delivery are not enabled yet."],
  ["When will the finished gift be ready?", STORY_OFFER.timeline],
  ["Will I be charged here?", "Payments are currently disabled. You can create a preview and a local test order without a card charge. Final digital-content terms will be available before live checkout."],
];

function resolveVariant(raw: string | null): CopyVariant {
  return raw === "song" || raw === "personalized_song" ? "personalized_song" : "emotion_story";
}

export function StoryLanding() {
  const [params] = useSearchParams();
  const variant = useMemo(() => resolveVariant(params.get("v")), [params]);
  const createPath = variant === "personalized_song" ? "/christmas-story/create?v=song" : "/christmas-story/create";
  useEffect(() => { trackStoryEvent("landing_view", { copy_variant: variant }); }, [variant]);

  return (
    <>
      <a className="cs-skip" href="#cs-main">Skip to content</a>
      <div className="cs-shell">
        <header className="cs-brand">
          <Link className="cs-brand__name" to="/christmas-story">Digital Gifter<span className="cs-brand__dot">.</span></Link>
          <a className="cs-nav-link" href="#cs-inside">The gift, explained <span aria-hidden="true">↗</span></a>
        </header>
        <main id="cs-main" tabIndex={-1}>
          <section className="cs-hero" aria-labelledby="cs-hero-title">
            <div className="cs-hero__copy">
              <p className="cs-kicker">The Christmas collection · Made personal</p>
              <h1 id="cs-hero-title">{variant === "personalized_song" ? "Imagine hearing their name in a song made just for them." : "Some people deserve more than an ordinary gift."}</h1>
              <p className="cs-hero__lead">{variant === "personalized_song" ? "Your memories, their name, an original song. Give them a story they can hear, see, and return to." : "Turn your favorite memories into a personal song, a beautiful film, and a surprise made just for them."}</p>
              <div className="cs-cta-row">
                <Link className="cs-btn cs-btn--primary" to={createPath} onClick={() => trackStoryEvent("create_gift_click", { source: "hero" })}>Create Their Gift <span aria-hidden="true">↗</span></Link>
                <Link className="cs-btn cs-btn--ghost" to="/christmas-story/demo" onClick={() => trackStoryEvent("demo_play", { source: "hero_secondary" })}>Explore a Sample Gift</Link>
              </div>
              <p className="cs-microcopy">For your partner, family, or someone who means everything.</p>
              <p className="cs-hero__offer">{STORY_OFFER.displayPrice} <span>for the complete gift · Preview before you decide</span></p>
            </div>
            <Link to="/christmas-story/demo" className="cs-gift-preview" aria-label="Explore Emma’s fictional sample gift">
              <div className="cs-gift-preview__border">
                <p className="cs-kicker">A little world, made for</p>
                <p className="cs-gift-preview__name">Emma</p>
                <span className="cs-gift-preview__rule" aria-hidden="true" />
                <p className="cs-gift-preview__dedication">For all the ordinary moments<br />you made extraordinary.</p>
                <div className="cs-seal" aria-hidden="true">E</div>
                <p className="cs-gift-preview__from">With love, Jordan</p>
                <div className="cs-gift-preview__footer"><span>Song · Film · A secret to keep</span><span aria-hidden="true">↗</span></div>
              </div>
              <span className="cs-sample-label">Fictional sample · Explore the opening</span>
            </Link>
          </section>
          <div className="cs-trust-strip" aria-label="Gift details"><span>Made from your memories</span><span>Reviewed by you</span><span>No app needed</span></div>
          <p className="cs-environment-note">You’re exploring a preview. Payments and cross-device delivery are not enabled.</p>

          <section className="cs-section cs-editorial" id="cs-inside" aria-labelledby="cs-inside-title">
            <div><p className="cs-kicker">More than a message</p><h2 id="cs-inside-title">Something to hear.<br />Something to hold onto.</h2><p className="cs-section__lead">The small things you remember become the heart of their gift.</p><Link className="cs-text-link" to="/christmas-story/demo">Step inside the sample <span aria-hidden="true">↗</span></Link></div>
            <ol className="cs-feature-list">
              <li><span className="cs-number">01</span><div><h3>Your story, set to music</h3><p>A personal song shaped around their name and the things you love about them.</p></div></li>
              <li><span className="cs-number">02</span><div><h3>Memories, brought together</h3><p>Your chosen photos, a dedication, and a film to return to.</p></div></li>
              <li><span className="cs-number">03</span><div><h3>One more thing, just for them</h3><p>A hidden message waiting at the end. Some words deserve their own moment.</p></div></li>
            </ol>
          </section>

          <section className="cs-section" aria-labelledby="cs-how-title">
            <p className="cs-kicker">From you, with love</p><h2 id="cs-how-title">You know them.<br />Start with that.</h2>
            <div className="cs-grid-3 cs-steps">
              {[ ["01", "Tell us about them", "Their name, your relationship, and what makes them special. Three answers to begin."], ["02", "Make it feel like you", "See a personalized preview. Add a memory, dedication or photos if you like."], ["03", "Review every detail", "Check their story and media in your buyer review before you approve."] ].map(([n, title, body]) => <div key={n}><span className="cs-number">{n}</span><h3>{title}</h3><p>{body}</p></div>)}
            </div>
          </section>

          <section className="cs-section" aria-labelledby="cs-price-title">
            <div className="cs-price">
              <div><p className="cs-kicker">One thoughtful gift</p><h2 id="cs-price-title">{STORY_OFFER.name}</h2><p className="cs-price__amount">{STORY_OFFER.displayPrice}</p><p className="cs-section__lead">{STORY_OFFER.promise}</p><Link className="cs-btn cs-btn--primary" to={createPath} onClick={() => trackStoryEvent("create_gift_click", { source: "pricing" })}>Create Their Gift <span aria-hidden="true">↗</span></Link></div>
              <div><ul className="cs-price__list">{STORY_OFFER.includes.map(item => <li key={item}>{item}</li>)}</ul><p className="cs-microcopy">{STORY_OFFER.timeline}</p><p className="cs-microcopy">{STORY_OFFER.taxesNote}</p><p className="cs-preview-banner">Preview mode · Song, film and printable card generation are mocked. No payment will be taken.</p></div>
            </div>
          </section>

          <section className="cs-section cs-faq cs-editorial" aria-labelledby="cs-faq-title">
            <div><p className="cs-kicker">A few thoughtful details</p><h2 id="cs-faq-title">Before you begin.</h2></div>
            <div>{FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</div>
          </section>
          <section className="cs-section cs-final-cta" aria-labelledby="cs-final-title"><p className="cs-kicker">For your person</p><h2 id="cs-final-title">Make this Christmas personal.</h2><p>Start with the things only you could tell us.</p><Link className="cs-btn cs-btn--primary" to={createPath} onClick={() => trackStoryEvent("create_gift_click", { source: "final" })}>Create Their Gift <span aria-hidden="true">↗</span></Link></section>
        </main>
        <footer className="cs-footer"><span className="cs-brand__name">Digital Gifter.</span><span>Thoughtfully given. Deeply personal.</span></footer>
      </div>
    </>
  );
}
