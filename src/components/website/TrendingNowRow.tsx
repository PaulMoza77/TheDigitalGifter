import { ArrowRight, Eye, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { occasions } from "@/constants/occasions";

const priorityOccasions = [
  "birthday",
  "name_cards",
  "sorry",
  "anniversary",
  "mothers_day",
  "baby_reveal",
  "christmas",
  "valentines_day",
];

const trendingItems = priorityOccasions
  .map((id) => occasions.find((item) => item.id === id))
  .filter(Boolean)
  .slice(0, 8);

export function TrendingNowRow() {
  return (
    <section className="relative z-10 mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-yellow-200">
            <Sparkles className="h-3.5 w-3.5" />
            Popular right now
          </div>

          <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
            Start with a moment
          </h2>

          <p className="mt-2 max-w-xl text-sm leading-6 text-white/55 sm:text-base">
            Choose what you want to create and turn it into a personalized AI
            gift, card or memory.
          </p>
        </div>

        <Link
          to="/templates"
          className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white/75 transition hover:bg-white/10 hover:text-white sm:inline-flex"
        >
          View all
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {trendingItems.map((item, index) => {
          if (!item) return null;

          return (
            <Link
              key={item.id}
              to={`/generator?category=${encodeURIComponent(
                item.category
              )}&occasion=${encodeURIComponent(item.id)}`}
              className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] shadow-xl transition duration-300 hover:-translate-y-1 hover:border-yellow-300/40 hover:shadow-yellow-500/10"
            >
              <div className="relative aspect-[4/5] overflow-hidden">
                <img
                  src={item.image}
                  alt={item.title}
                  className="h-full w-full object-cover transition duration-700 group-hover:scale-110"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-transparent" />

                <div className="absolute left-3 top-3 rounded-full border border-white/15 bg-black/45 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white/80 backdrop-blur">
                  {item.category}
                </div>

                <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/50 px-2.5 py-1 text-[10px] font-semibold text-white/80 backdrop-blur">
                  <Eye className="h-3 w-3" />
                  {(12.5 - index * 0.6).toFixed(1)}K
                </div>

                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <h3 className="line-clamp-2 text-base font-black text-white sm:text-lg">
                    {item.title}
                  </h3>

                  <p className="mt-1 line-clamp-1 text-xs font-medium text-white/60">
                    {item.label}
                  </p>

                  <div className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-yellow-200 opacity-0 transition group-hover:opacity-100">
                    Create now
                    <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="mt-8 flex justify-center sm:hidden">
        <Link
          to="/templates"
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white/80"
        >
          View all templates
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}