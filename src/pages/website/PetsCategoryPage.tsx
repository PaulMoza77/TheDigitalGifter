import { motion } from "framer-motion";
import { ArrowRight, Cat, Dog, Heart, Smile } from "lucide-react";
import { Link } from "react-router-dom";

const petTemplates = [
  {
    id: "dogs",
    title: "Dogs",
    description: "Cute, funny and emotional cards for dog lovers.",
    icon: Dog,
    path: "/generator?category=pets&type=dogs",
  },
  {
    id: "cats",
    title: "Cats",
    description: "Sweet and playful cards for cat memories.",
    icon: Cat,
    path: "/generator?category=pets&type=cats",
  },
  {
    id: "pet-loss",
    title: "Pet Loss",
    description: "Gentle cards for remembering a loved pet.",
    icon: Heart,
    path: "/generator?category=pets&type=pet-loss",
  },
  {
    id: "funny-pets",
    title: "Funny Pets",
    description: "Light, viral-style cards made for sharing.",
    icon: Smile,
    path: "/generator?category=pets&type=funny-pets",
  },
];

export default function PetsCategoryPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(251,146,60,0.20),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(34,197,94,0.14),transparent_30%)]" />

      <section className="relative z-10 mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <motion.div
          className="mx-auto mb-12 max-w-3xl text-center"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.25em] text-orange-300">
            Pets
          </p>

          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            Because pets are family too.
          </h1>

          <p className="mt-5 text-lg leading-8 text-white/70">
            Create adorable, funny or deeply emotional cards for dogs, cats,
            pet memories and moments worth keeping.
          </p>
        </motion.div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {petTemplates.map((item, index) => {
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
                  className="group flex min-h-[280px] flex-col justify-between rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-xl transition hover:-translate-y-1 hover:border-orange-400/40 hover:bg-white/[0.07]"
                >
                  <div>
                    <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
                      <Icon className="h-7 w-7 text-orange-200" />
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