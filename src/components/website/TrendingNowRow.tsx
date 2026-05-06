import { ArrowRight, Eye } from "lucide-react";
import { Link } from "react-router-dom";
import { occasions } from "@/constants/occasions";

const trendingItems = occasions.slice(0, 12);

export function TrendingNowRow() {
  return (
    <section className="relative z-10 mx-auto w-full max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white sm:text-3xl">
            Trending Now
          </h2>

          <p className="mt-1 text-sm text-white/50">
            Popular categories people are creating right now.
          </p>
        </div>

        <Link
          to="/templates"
          className="hidden items-center gap-2 text-sm font-medium text-white/70 transition hover:text-white sm:inline-flex"
        >
          View all
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="overflow-x-auto pb-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex gap-4">
          {trendingItems.map((item, index) => (
            <Link
              key={item.id}
              to={`/templates?occasion=${encodeURIComponent(item.id)}`}
              className="
                group relative shrink-0 overflow-hidden rounded-2xl border border-white/10
                bg-slate-900/70 shadow-lg transition-all duration-300
                hover:-translate-y-1 hover:border-white/20 hover:shadow-blue-500/20
                w-[calc((100vw-48px)/3)]
                sm:w-[220px]
                lg:w-[calc((100%-64px)/5)]
              "
            >
              <div className="relative aspect-[4/5] overflow-hidden">
                <img
                  src={item.image}
                  alt={item.title}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />

                <div className="absolute left-3 top-3 rounded-full border border-white/15 bg-black/45 px-2.5 py-1 text-[10px] font-medium text-white/80 backdrop-blur">
                  {item.category}
                </div>

                <div className="absolute bottom-3 left-3 right-3">
                  <div className="mb-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[10px] text-white/85 backdrop-blur">
                    <Eye className="h-3 w-3" />
                    {(12.5 - index * 0.7).toFixed(1)}K uses
                  </div>

                  <h3 className="line-clamp-2 text-sm font-semibold text-white sm:text-base">
                    {item.title}
                  </h3>

                  <p className="mt-1 line-clamp-1 text-xs text-white/55">
                    {item.label}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}