import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, HeartHandshake } from "lucide-react";

function clsx(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(" ");
}

export default function SorryPage() {
  const [sp] = useSearchParams();
  const next = new URLSearchParams(sp);

  next.set("occasion", "sorry");

  return (
    <div className="min-h-[calc(100vh-72px)] px-4 pb-16 pt-8">
      <div className="mx-auto max-w-6xl">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/5 to-transparent p-6 md:p-10">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -top-24 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-rose-300/10 blur-3xl" />
            <div className="absolute -bottom-24 right-10 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
          </div>

          <div className="relative">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80">
              <HeartHandshake className="h-4 w-4 text-rose-200" />
              Sorry — honest & emotional
            </div>

            <h1 className="text-4xl font-extrabold tracking-tight text-white md:text-6xl">
              Say <span className="text-rose-300">I’m Sorry</span>
              <br />
              in a Beautiful Way
            </h1>

            <p className="mt-4 max-w-2xl text-base text-white/70 md:text-lg">
              Sometimes words are hard. Create a sincere, emotional apology card
              that helps you express what you truly feel.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to={`/funnel/styleSelect?${next.toString()}`}
                className={clsx(
                  "inline-flex items-center gap-2 rounded-2xl px-5 py-3",
                  "bg-rose-200 font-semibold text-black shadow-lg shadow-black/30",
                  "transition hover:brightness-105 active:brightness-95"
                )}
              >
                Create Apology Gift <ArrowRight className="h-4 w-4" />
              </Link>

              <Link
                to={`/templates?${next.toString()}`}
                className={clsx(
                  "inline-flex items-center gap-2 rounded-2xl px-5 py-3",
                  "border border-white/15 bg-white/5 text-white/90",
                  "transition hover:bg-white/10"
                )}
              >
                View Templates
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">Apology Styles</h2>
            <div className="text-sm text-white/60">Coming soon</div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              {
                title: "Deep Emotional Apology",
                desc: "A sincere design for when words are not enough.",
              },
              {
                title: "Romantic I’m Sorry",
                desc: "Soft, warm, and personal for someone you love.",
              },
              {
                title: "Forgiveness & Peace",
                desc: "Gentle visuals with a calm, hopeful feeling.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-5"
              >
                <div className="mb-3 inline-flex rounded-full bg-rose-400/20 px-3 py-1 text-xs font-semibold text-rose-200">
                  Coming Soon
                </div>

                <div className="text-lg font-semibold text-white">
                  {item.title}
                </div>

                <div className="mt-1 text-sm text-white/65">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}