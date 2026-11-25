import { Link } from "react-router-dom";
import { ChristmasPageHead } from "./ChristmasPageHead";
import { resolveChristmasSeoRequest } from "./ssrRegistry";

type Props = {
  path: string;
  ctaHref: string;
  ctaLabel: string;
  bullets: string[];
};

/**
 * Lightweight commercial intent page: unique copy from SEO registry + one CTA.
 * Not a doorway — each path must carry distinct intent in christmasSeoCore.
 */
export default function ChristmasCommercialGuidePage({ path, ctaHref, ctaLabel, bullets }: Props) {
  const resolved = resolveChristmasSeoRequest(path);
  const entry = resolved?.entry;
  const title = entry?.h1 || entry?.title || "Christmas gifts";
  const lede = entry?.lede || entry?.description || "";
  const body = entry?.h2Body || "";
  const h2 = entry?.h2 || "What to do next";

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 text-slate-100">
      <ChristmasPageHead path={path} />
      <p className="text-xs uppercase tracking-[0.18em] text-amber-200/80">The Digital Gifter</p>
      <h1 className="mt-3 font-serif text-3xl leading-tight sm:text-4xl">{title}</h1>
      <p className="mt-4 text-base leading-relaxed text-slate-300">{lede}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          to={ctaHref}
          className="inline-flex items-center rounded-full bg-emerald-800 px-5 py-3 text-sm font-semibold text-amber-50"
        >
          {ctaLabel}
        </Link>
        <Link to="/christmas" className="inline-flex items-center rounded-full border border-slate-600 px-5 py-3 text-sm text-slate-200">
          Christmas home
        </Link>
      </div>
      <section className="mt-10">
        <h2 className="font-serif text-2xl">{h2}</h2>
        {body ? <p className="mt-3 text-slate-300 leading-relaxed">{body}</p> : null}
        <ul className="mt-4 list-disc space-y-2 pl-5 text-slate-300">
          {bullets.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
      {(entry?.links || []).length ? (
        <nav className="mt-10 border-t border-slate-800 pt-6 text-sm" aria-label="Related">
          <p className="text-xs uppercase text-slate-500">Related</p>
          <ul className="mt-2 space-y-1">
            {entry!.links!.map((link) => (
              <li key={link.href}>
                <Link className="text-amber-100 underline-offset-2 hover:underline" to={link.href}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}
