import { motion } from "framer-motion";
import { ArrowRight, BookOpen, Cross, HeartHandshake, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

const spiritualTemplates = [
  {
    id: "bible-verses",
    title: "Bible Verses",
    description: "Beautiful cards with meaningful scripture-inspired messages.",
    icon: BookOpen,
    path: "/generator?category=spiritual&type=bible-verses",
  },
  {
    id: "prayers",
    title: "Prayers",
    description: "Warm prayer cards for comfort, hope and gratitude.",
    icon: Cross,
    path: "/generator?category=spiritual&type=prayers",
  },
  {
    id: "encouragement",
    title: "Encouragement",
    description: "Faith-filled messages for hard days and new beginnings.",
    icon: HeartHandshake,
    path: "/generator?category=spiritual&type=encouragement",
  },
  {
    id: "gratitude",
    title: "Gratitude",
    description: "Cards made to say thank you with depth and meaning.",
    icon: Sparkles,
    path: "/generator?category=spiritual&type=gratitude",
  },
];

export default function SpiritualCategoryPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.20),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.16),transparent_30%)]" />

      <section className="relative z-10 mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <motion.div
          className="mx-auto mb-12 max-w-3xl text-center"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.25em] text-violet-300">
            Spiritual
          </p>

          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            Share hope, faith and words that lift the soul.
          </h1>

          <p className="mt-5 text-lg leading-8 text-white/70">
            Create spiritual cards for encouragement, prayer, gratitude, Bible
            messages and meaningful moments.
          </p>
        </motion.div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {spiritualTemplates.map((item, index) => {
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
                  className="group flex min-h-[280px] flex-col justify-between rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-xl transition hover:-translate-y-1 hover:border-violet-400/40 hover:bg-white/[0.07]"
                >
                  <div>
                    <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
                      <Icon className="h-7 w-7 text-violet-200" />
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