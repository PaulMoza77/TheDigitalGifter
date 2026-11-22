import { useEffect, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { STORY_OFFER } from "../catalog";
import { trackStoryEvent } from "../analytics";
import type { CopyVariant } from "../types";

const FAQ = [
  {
    q: "Do I need an app?",
    a: "No. Everything works in the browser on a phone or computer.",
  },
  {
    q: "Is checkout secure?",
    a: "When live payments are enabled, checkout uses Stripe. This MVP keeps charges disabled until authorized.",
  },
  {
    q: "Will the recipient see the price?",
    a: "Never. The private gift page shows only the experience — no invoices, ads, or upsells mid-story.",
  },
  {
    q: "Can I review before they open it?",
    a: "Yes. You approve the song, film, and page before sending the link or printing the QR card.",
  },
  {
    q: "How long does creation take?",
    a: "Expect roughly 24–72 hours for song and film production plus quality check — not “instant AI song.”",
  },
  {
    q: "What about refunds and digital content rules?",
    a: "Policies for immediate digital supply require express consent under EU rules where applicable. Final legal copy is pending counsel approval; defective gifts remain eligible for support.",
  },
];

function resolveVariant(raw: string | null): CopyVariant {
  if (raw === "song" || raw === "personalized_song") return "personalized_song";
  return "emotion_story";
}

export function StoryLanding() {
  const [params] = useSearchParams();
  const variant = useMemo(() => resolveVariant(params.get("v")), [params]);

  useEffect(() => {
    trackStoryEvent("landing_view", { copy_variant: variant });
  }, [variant]);

  const copy =
    variant === "personalized_song"
      ? {
          headline: "Imagine hearing their name in a song made just for them.",
          lead: "We turn your memories into an original song, a cinematic film, and a private surprise they can open on any phone.",
        }
      : {
          headline: "Some people deserve more than an ordinary gift.",
          lead: "Turn your favorite memories into a personal song, a beautiful film, and a surprise made just for them. One story. One unforgettable gift.",
        };

  return (
    <>
      <a className="cs-skip" href="#cs-main">
        Skip to content
      </a>
      <div className="cs-shell" id="cs-main">
        <header className="cs-brand">
          <div className="cs-brand__name">Digital Gifter</div>
          <div className="cs-brand__meta">Our Christmas Story</div>
        </header>

        <section className="cs-hero" aria-labelledby="cs-hero-title">
          <div>
            <p className="cs-kicker">Premium personalized gift</p>
            <h1 id="cs-hero-title">{copy.headline}</h1>
            <p className="cs-hero__lead">{copy.lead}</p>
            <div className="cs-cta-row">
              <Link
                className="cs-btn cs-btn--primary"
                to="/christmas-story/create"
                onClick={() => trackStoryEvent("create_gift_click", { source: "hero" })}
              >
                Create Their Gift
              </Link>
              <Link
                className="cs-btn cs-btn--ghost"
                to="/christmas-story/demo"
                onClick={() => trackStoryEvent("demo_play", { source: "hero_secondary" })}
              >
                Watch a Real Example
              </Link>
            </div>
          </div>
          <aside className="cs-hero-visual" aria-label="Gift preview teaser">
            <div>
              <p className="cs-hero-visual__label">Private gift experience</p>
              <p className="cs-hero-visual__title">Unwrap. Listen. Remember.</p>
            </div>
            <p className="cs-hero-visual__note">
              Song · memory film · hidden surprise · printable QR card
            </p>
          </aside>
        </section>

        <section className="cs-section" aria-labelledby="cs-demo-title">
          <h2 id="cs-demo-title">See the gift, not just the features</h2>
          <p className="cs-section__lead">
            Open a full sample recipient experience with fictional data. Audio is an example
            demonstration — clearly labeled, never sold as a finished custom master.
          </p>
          <div className="cs-grid-3">
            <div className="cs-panel">
              <h3>Ceremonial opening</h3>
              <p>A private welcome and unwrap — not a homepage.</p>
            </div>
            <div className="cs-panel">
              <h3>Song reveal</h3>
              <p>Their name, lyrics, and a player built for this gift.</p>
            </div>
            <div className="cs-panel">
              <h3>Memory film</h3>
              <p>A short cinematic sequence from the photos you choose.</p>
            </div>
          </div>
          <div className="cs-cta-row" style={{ marginTop: "1.25rem" }}>
            <Link className="cs-btn cs-btn--primary" to="/christmas-story/demo">
              Open the interactive demo
            </Link>
          </div>
        </section>

        <section className="cs-section" aria-labelledby="cs-feel-title">
          <h2 id="cs-feel-title">What they will feel</h2>
          <p className="cs-section__lead">
            This is not a digital greeting card with extras. It is a story they can hear, see, and
            return to — made from what you already share.
          </p>
          <div className="cs-grid-3">
            <div className="cs-panel">
              <h3>Seen</h3>
              <p>The gift reflects your relationship, not a generic template.</p>
            </div>
            <div className="cs-panel">
              <h3>Safe</h3>
              <p>You approve everything before they receive the link.</p>
            </div>
            <div className="cs-panel">
              <h3>Simple</h3>
              <p>You answer a few questions. We build the experience.</p>
            </div>
          </div>
        </section>

        <section className="cs-section" aria-labelledby="cs-inside-title">
          <h2 id="cs-inside-title">What&apos;s inside</h2>
          <div className="cs-grid-4">
            {[
              ["Personal song", "Original track shaped around your story"],
              ["Memory film", "5–10 chosen frames with pacing and overlays"],
              ["Private page", "Unguessable link, optional PIN"],
              ["Hidden surprise", "One meaningful interaction — not a toy pack"],
              ["Printable card", "Elegant PDF with QR for under the tree"],
            ].map(([title, body]) => (
              <div className="cs-panel" key={title}>
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="cs-section" aria-labelledby="cs-how-title">
          <h2 id="cs-how-title">How it works</h2>
          <div className="cs-grid-3">
            <div className="cs-panel">
              <h3>1. Tell us about them</h3>
              <p>Name, relationship, and what makes them special.</p>
            </div>
            <div className="cs-panel">
              <h3>2. We create their story</h3>
              <p>Song, film, and page — then you review.</p>
            </div>
            <div className="cs-panel">
              <h3>3. Send the surprise</h3>
              <p>Share the link, schedule it, or print the QR card.</p>
            </div>
          </div>
        </section>

        <section className="cs-section" aria-labelledby="cs-price-title">
          <h2 id="cs-price-title">Pricing</h2>
          <div className="cs-price">
            <div>
              <p className="cs-kicker">{STORY_OFFER.name}</p>
              <p className="cs-price__amount">{STORY_OFFER.displayPrice}</p>
              <p className="cs-section__lead" style={{ marginBottom: "1rem" }}>
                {STORY_OFFER.promise}
              </p>
              <ul className="cs-price__list">
                {STORY_OFFER.includes.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="cs-panel">
              <h3>Delivery</h3>
              <p>{STORY_OFFER.timeline}</p>
              <p style={{ marginTop: "0.75rem" }}>{STORY_OFFER.taxesNote}</p>
              <Link
                className="cs-btn cs-btn--primary"
                style={{ marginTop: "1rem" }}
                to="/christmas-story/create"
                onClick={() => trackStoryEvent("create_gift_click", { source: "pricing" })}
              >
                Create Their Gift
              </Link>
            </div>
          </div>
        </section>

        <section className="cs-section cs-faq" aria-labelledby="cs-faq-title">
          <h2 id="cs-faq-title">Trust &amp; FAQ</h2>
          {FAQ.map((item) => (
            <details key={item.q}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </section>

        <section className="cs-section" aria-labelledby="cs-final-title">
          <h2 id="cs-final-title">Make this Christmas personal</h2>
          <p className="cs-section__lead">
            Start with three answers. See a preview. Decide when it feels right.
          </p>
          <div className="cs-cta-row">
            <Link
              className="cs-btn cs-btn--primary"
              to="/christmas-story/create"
              onClick={() => trackStoryEvent("create_gift_click", { source: "final" })}
            >
              Create Their Gift
            </Link>
            <Link className="cs-btn cs-btn--ghost" to="/christmas-story/demo">
              Watch a Real Example
            </Link>
          </div>
          <p style={{ marginTop: "1.25rem", fontSize: "0.8rem", opacity: 0.65 }}>
            Copy variant: {variant === "personalized_song" ? "song-led (?v=song)" : "emotion/story-led (default)"}
          </p>
        </section>
      </div>
    </>
  );
}
