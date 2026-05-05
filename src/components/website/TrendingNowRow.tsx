import { ArrowRight, Eye } from "lucide-react";
import { Link } from "react-router-dom";
import { occasions } from "@/constants/occasions";

const trendingItems = occasions.slice(0, 12);

export function TrendingNowRow() {
  return (
    <section className="relative z-10 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 pb-20">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 className="text-2xl sm:text-3xl font-bold text-white">
          🔥 Trending Now
        </h2>

        <Link
          to="/templates"
          className="hidden sm:inline-flex items-center gap-2 text-sm font-medium text-white/70 hover:text-white transition"
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
              to={`/funnel/homepage/${item.id}`}
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

                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                <div className="absolute left-3 bottom-3 right-3">
                  <div className="mb-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[10px] text-white/85 backdrop-blur">
                    <Eye className="h-3 w-3" />
                    {(12.5 - index * 0.7).toFixed(1)}K uses
                  </div>

                  <h3 className="line-clamp-2 text-sm sm:text-base font-semibold text-white">
                    {item.title}
                  </h3>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}