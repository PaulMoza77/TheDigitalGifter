import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { occasions } from "@/constants/occasions";

export default function OccasionsCategoryPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.20),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.14),transparent_30%)]" />

      <section className="relative z-10 mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <motion.div
          className="mx-auto mb-12 max-w-3xl text-center"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.25em] text-cyan-300">
            Occasions
          </p>

          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            Create cards for every moment that matters.
          </h1>

          <p className="mt-5 text-lg leading-8 text-white/70">
            Birthdays, weddings, anniversaries, holidays, graduations and life
            moments — choose the occasion and start with a beautiful template.
          </p>
        </motion.div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {occasions.map((occasion, index) => (
            <motion.div
              key={occasion.id}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
            >
              <Link
                to={`/funnel/homepage/${occasion.id}`}
                className="group block overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] shadow-xl transition hover:-translate-y-1 hover:border-cyan-400/40 hover:bg-white/[0.07]"
              >
                <div className="relative aspect-[4/5] overflow-hidden">
                  <img
                    src={occasion.image}
                    alt={occasion.title}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4">
                    <h2 className="text-xl font-bold">{occasion.title}</h2>
                    <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-black">
                      Use template
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>
    </main>
  );
}