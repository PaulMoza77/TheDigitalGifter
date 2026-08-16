import { Link } from "react-router-dom";
import { PageHead } from "@/components/PageHead";

export type LegalSection = {
  id: string;
  title: string;
  paragraphs: string[];
};

export function LegalDocument(props: {
  title: string;
  description: string;
  updated: string;
  notice: string;
  sections: LegalSection[];
}) {
  return (
    <main className="min-h-screen bg-gradient-to-b from-[#060a12] to-[#0b1220] text-white">
      <PageHead title={props.title} description={props.description} />
      <div className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-xs uppercase tracking-wide text-white/50">
          Last updated {props.updated}
        </p>
        <h1 className="mt-2 text-4xl font-bold">{props.title}</h1>
        <p className="mt-4 rounded-xl border border-amber-200/20 bg-amber-400/10 p-4 text-sm leading-6 text-amber-100">
          {props.notice}
        </p>
        <div className="mt-8 space-y-8">
          {props.sections.map((section) => (
            <section key={section.id} id={section.id}>
              <h2 className="text-xl font-semibold">{section.title}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph} className="mt-3 text-sm leading-7 text-white/75">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </div>
        <p className="mt-8 text-sm text-white/60">
          Questions:{" "}
          <a className="underline" href="mailto:support@thedigitalgifter.com">
            support@thedigitalgifter.com
          </a>
          . Also see{" "}
          <Link className="underline" to="/terms">
            Terms
          </Link>
          ,{" "}
          <Link className="underline" to="/privacy">
            Privacy
          </Link>
          ,{" "}
          <Link className="underline" to="/refunds">
            Refunds
          </Link>
          , and{" "}
          <Link className="underline" to="/cookies">
            Cookies
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
