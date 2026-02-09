import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";

function clsx(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(" ");
}

export default function BirthdayPage() {
  // păstrăm query dacă vrei (ex: ?ref=home), dar forțăm occasion=birthday
  const [sp] = useSearchParams();
  const next = new URLSearchParams(sp);
  next.set("occasion", "birthday");

  return (
    <div className="min-h-[calc(100vh-72px)] px-4 pb-16 pt-8">
      <div className="mx-auto max-w-6xl">
        {/* HERO */}
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/5 to-transparent p-6 md:p-10">
          <div className="absolute inset-0 pointer-events-none">
            {/* subtle glow */}
            <div className="absolute -top-24 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -bottom-24 right-10 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
          </div>

          <div className="relative">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80">
              🎂 Birthday Special — Limited Time
            </div>

            <h1 className="text-4xl font-extrabold tracking-tight text-white md:text-6xl">
              Create Amazing <span className="text-orange-300">Birthday</span>
              <br />
              Gifts with AI
            </h1>

            <p className="mt-4 max-w-2xl text-base text-white/70 md:text-lg">
              Transform your favorite photo into a personalized birthday design in seconds.
              Upload, customize, and let AI do the magic.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              {/* ✅ duce în flow-ul de generare (ca la Christmas), doar cu occasion=birthday */}
              <Link
                to={`/funnel/styleSelect?${next.toString()}`}
                className={clsx(
                  "inline-flex items-center gap-2 rounded-2xl px-5 py-3",
                  "bg-orange-200 text-black font-semibold shadow-lg shadow-black/30",
                  "hover:brightness-105 active:brightness-95 transition"
                )}
              >
                Start Creating <ArrowRight className="h-4 w-4" />
              </Link>

              {/* opțional: te duce la templates (îl lăsăm “coming soon” sau același loc ca Xmas) */}
              <Link
                to={`/templates?${next.toString()}`}
                className={clsx(
                  "inline-flex items-center gap-2 rounded-2xl px-5 py-3",
                  "border border-white/15 bg-white/5 text-white/90",
                  "hover:bg-white/10 transition"
                )}
              >
                View Templates
              </Link>
            </div>
          </div>
        </div>

        {/* PREVIEW GRID (placeholder până facem template-urile) */}
        <div className="mt-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">Templates</h2>
            <div className="text-sm text-white/60">Coming soon</div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              { title: "Party Balloons Card", desc: "Bright balloons + confetti energy." },
              { title: "Elegant Birthday Portrait", desc: "Clean, premium layout with glow." },
              { title: "Kids Birthday Moment", desc: "Warm, fun, family-first vibes." },
            ].map((t) => (
              <div
                key={t.title}
                className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-5"
              >
                <div className="mb-3 inline-flex rounded-full bg-orange-400/20 px-3 py-1 text-xs font-semibold text-orange-200">
                  Coming Soon
                </div>
                <div className="text-lg font-semibold text-white">{t.title}</div>
                <div className="mt-1 text-sm text-white/65">{t.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
