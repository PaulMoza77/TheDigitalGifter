import { motion } from "framer-motion";
import { ArrowRight, Heart, Smile, UserRound } from "lucide-react";
import { Link } from "react-router-dom";

const personalTemplates = [
  {
    id: "name",
    title: "Name Cards",
    description: "Personal messages built around a name.",
    icon: UserRound,
    path: "/generator?category=personal&type=name",
  },
  {
    id: "kids",
    title: "Kids",
    description: "Sweet, playful cards for children and family memories.",
    icon: Smile,
    path: "/generator?category=personal&type=kids",
  },
  {
    id: "love",
    title: "Love",
    description: "Romantic cards for someone special.",
    icon: Heart,
    path: "/generator?category=personal&type=love",
  },
  {
    id: "apology",
    title: "Apology",
    description: "Warm, emotional messages when words matter most.",
    icon: Heart,
    path: "/sorry",
  },
];

export default function PersonalCategoryPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(236,72,153,0.18),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.16),transparent_30%)]" />

      <section className="relative z-10 mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <motion.div
          className="mx-auto mb-12 max-w-3xl text-center"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.25em] text-pink-300">
            Personal
          </p>

          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            Make it feel made only for them.
          </h1>

          <p className="mt-5 text-lg leading-8 text-white/70">
            Create emotional cards using names, family moments, kids, love
            messages and personal memories.
          </p>
        </motion.div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {personalTemplates.map((item, index) => {
            const Icon = item.icon;

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Link
                  to={item.path}
                  className="group flex min-h-[280px] flex-col justify-between rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-xl transition hover:-translate-y-1 hover:border-pink-400/40 hover:bg-white/[0.07]"
                >
                  <div>
                    <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
                      <Icon className="h-7 w-7 text-pink-200" />
                    </div>

                    <h2 className="text-2xl font-bold">{item.title}</h2>
                    <p className="mt-3 text-sm leading-6 text-white/65">
                      {item.description}
                    </p>
                  </div>

                  <div className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-white">
                    Explore
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </section>
    </main>
  );
}