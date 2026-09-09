import { Link } from "react-router-dom";
import { SANTA_COPY } from "./santaCopy";
import { SANTA_DEMO_EXAMPLES } from "./santaExamples";
import { SantaDemoPlayer } from "./SantaDemoPlayer";

export function SantaLandingSections() {
  const { sections } = SANTA_COPY;

  return (
    <div className="mx-auto max-w-5xl space-y-20 px-4 pb-20 pt-12 sm:px-6">
      <section aria-labelledby="santa-examples-heading">
        <h2 id="santa-examples-heading" className="santa-display text-3xl text-[#F5EDE0] sm:text-4xl">
          {sections.examples.h2}
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#F5EDE0]/70 sm:text-base">
          {sections.examples.intro}
        </p>
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          {SANTA_DEMO_EXAMPLES.map((example, index) => (
            <SantaDemoPlayer key={example.id} example={example} featured={index === 0} />
          ))}
        </div>
      </section>

      <section aria-labelledby="santa-how-heading">
        <h2 id="santa-how-heading" className="santa-display text-3xl text-[#F5EDE0]">
          {sections.how.h2}
        </h2>
        <ol className="mt-8 grid gap-8 sm:grid-cols-3">
          {sections.how.steps.map((step, i) => (
            <li key={step.title} className="relative">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#d4af37]">
                Step {i + 1}
              </p>
              <h3 className="santa-display mt-2 text-xl text-[#F5EDE0]">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#F5EDE0]/70">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="santa-personal-heading">
        <h2 id="santa-personal-heading" className="santa-display text-3xl text-[#F5EDE0]">
          {sections.personal.h2}
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#F5EDE0]/75">
          {sections.personal.body}
        </p>
      </section>

      <section aria-labelledby="santa-proof-heading">
        <h2 id="santa-proof-heading" className="santa-display text-3xl text-[#F5EDE0]">
          {sections.proof.h2}
        </h2>
        <ul className="mt-8 grid gap-6 sm:grid-cols-3">
          {sections.proof.items.map((item) => (
            <li key={item.title}>
              <h3 className="font-semibold text-[#F5EDE0]">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#F5EDE0]/65">{item.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="santa-geo-heading">
        <h2 id="santa-geo-heading" className="sr-only">
          Create a Magical Message From Santa
        </h2>
        <h3 className="santa-display text-2xl text-[#F5EDE0]">{sections.geo.whatIs.q}</h3>
        <p className="mt-3 max-w-3xl text-base leading-relaxed text-[#F5EDE0]/75">
          {sections.geo.whatIs.a}
        </p>
      </section>

      <section aria-labelledby="santa-faq-heading">
        <h2 id="santa-faq-heading" className="santa-display text-3xl text-[#F5EDE0]">
          {sections.faq.h2}
        </h2>
        <dl className="mt-8 space-y-6">
          {sections.faq.items.map((item) => (
            <div key={item.q}>
              <dt className="font-semibold text-[#F5EDE0]">{item.q}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-[#F5EDE0]/70">{item.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="santa-trust-heading">
        <h2 id="santa-trust-heading" className="santa-display text-2xl text-[#F5EDE0]">
          {sections.trust.h2}
        </h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-[#F5EDE0]/65">
          {sections.trust.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="mt-6 text-sm text-[#F5EDE0]/55">
          Explore more:{" "}
          <Link className="text-[#d4af37] underline-offset-2 hover:underline" to="/christmas">
            Christmas hub
          </Link>
          {" · "}
          <Link
            className="text-[#d4af37] underline-offset-2 hover:underline"
            to="/christmas/photo-generator"
          >
            Christmas portrait
          </Link>
          {" · "}
          <Link className="text-[#d4af37] underline-offset-2 hover:underline" to="/christmas/cards">
            Christmas cards
          </Link>
          {" · "}
          <Link className="text-[#d4af37] underline-offset-2 hover:underline" to="/christmas/tree">
            Digital Christmas tree
          </Link>
        </p>
      </section>
    </div>
  );
}
